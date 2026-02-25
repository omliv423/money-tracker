


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."create_default_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Failed to create subscription for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_household_id"("uid" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT COALESCE(
    (SELECT id FROM households WHERE owner_id = uid),
    (SELECT household_id FROM household_members
     WHERE user_id = uid AND status = 'active'
     LIMIT 1)
  );
$$;


ALTER FUNCTION "public"."get_user_household_id"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_pending_invite"("hid" "uuid", "user_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid
    AND invited_email = user_email
    AND status = 'pending'
  );
$$;


ALTER FUNCTION "public"."has_pending_invite"("hid" "uuid", "user_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_household_member"("hid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid
    AND user_id = uid
    AND status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_household_member"("hid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_household_owner"("hid" "uuid", "uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM households
    WHERE id = hid
    AND owner_id = uid
  );
$$;


ALTER FUNCTION "public"."is_household_owner"("hid" "uuid", "uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_settlement_balances_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_settlement_balances_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "owner" "text" DEFAULT 'self'::"text" NOT NULL,
    "initial_balance" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "current_balance" integer DEFAULT 0,
    "user_id" "uuid",
    "opening_balance" integer DEFAULT 0,
    "balance_date" "date",
    "opening_date" "date",
    "is_shared" boolean DEFAULT false,
    "partner_user_id" "uuid",
    "partner_name" "text",
    "default_split_ratio" integer DEFAULT 50,
    CONSTRAINT "accounts_owner_check" CHECK (("owner" = ANY (ARRAY['self'::"text", 'shared'::"text"]))),
    CONSTRAINT "accounts_type_check" CHECK (("type" = ANY (ARRAY['bank'::"text", 'cash'::"text", 'card'::"text", 'investment'::"text", 'points'::"text"])))
);


ALTER TABLE "public"."accounts" OWNER TO "postgres";


COMMENT ON COLUMN "public"."accounts"."is_shared" IS '共有口座かどうか';



COMMENT ON COLUMN "public"."accounts"."partner_user_id" IS 'パートナーのユーザーID（登録済みの場合）';



COMMENT ON COLUMN "public"."accounts"."partner_name" IS 'パートナー名（未登録の場合）';



COMMENT ON COLUMN "public"."accounts"."default_split_ratio" IS '自分のデフォルト負担比率（%）';



CREATE TABLE IF NOT EXISTS "public"."analytics_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "event_name" character varying(100) NOT NULL,
    "event_data" "jsonb" DEFAULT '{}'::"jsonb",
    "page_path" character varying(500),
    "session_id" character varying(100),
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."analytics_events" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_daily_active_users" AS
 SELECT "date"("created_at") AS "date",
    "count"(DISTINCT "user_id") AS "active_users"
   FROM "public"."analytics_events"
  WHERE ("user_id" IS NOT NULL)
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."analytics_daily_active_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "plan" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "has_seen_about" boolean DEFAULT false,
    CONSTRAINT "subscriptions_plan_check" CHECK (("plan" = ANY (ARRAY['free'::"text", 'premium'::"text"]))),
    CONSTRAINT "subscriptions_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'canceled'::"text", 'past_due'::"text", 'trialing'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


COMMENT ON TABLE "public"."subscriptions" IS 'ユーザーのサブスクリプション情報（Stripe連携）';



COMMENT ON COLUMN "public"."subscriptions"."has_seen_about" IS '初回ログイン時のAboutモーダル表示済みフラグ';



CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "description" "text" NOT NULL,
    "account_id" "uuid" NOT NULL,
    "total_amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_date" "date",
    "is_cash_settled" boolean DEFAULT false,
    "counterparty_id" "uuid",
    "settled_amount" integer DEFAULT 0,
    "user_id" "uuid",
    "settlement_account_id" "uuid",
    "settlement_date" "date",
    "paid_by_other" boolean DEFAULT false
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_overview" AS
 SELECT ( SELECT "count"(*) AS "count"
           FROM "auth"."users") AS "total_users",
    ( SELECT "count"(*) AS "count"
           FROM "auth"."users"
          WHERE ("users"."created_at" > ("now"() - '7 days'::interval))) AS "new_users_7d",
    ( SELECT "count"(*) AS "count"
           FROM "auth"."users"
          WHERE ("users"."created_at" > ("now"() - '30 days'::interval))) AS "new_users_30d",
    ( SELECT "count"(*) AS "count"
           FROM "public"."subscriptions"
          WHERE (("subscriptions"."plan" = 'premium'::"text") AND ("subscriptions"."status" = 'active'::"text"))) AS "premium_users",
    ( SELECT "count"(*) AS "count"
           FROM "public"."transactions") AS "total_transactions",
    ( SELECT "count"(*) AS "count"
           FROM "public"."transactions"
          WHERE ("transactions"."created_at" > ("now"() - '7 days'::interval))) AS "transactions_7d",
    ( SELECT "count"(DISTINCT "transactions"."user_id") AS "count"
           FROM "public"."transactions"
          WHERE ("transactions"."created_at" > ("now"() - '7 days'::interval))) AS "active_users_7d";


ALTER VIEW "public"."analytics_overview" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_subscriptions" AS
 SELECT "plan",
    "status",
    "count"(*) AS "count"
   FROM "public"."subscriptions"
  GROUP BY "plan", "status";


ALTER VIEW "public"."analytics_subscriptions" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_transaction_volume" AS
 SELECT "date"("created_at") AS "date",
    "count"(*) AS "transaction_count",
    "sum"("total_amount") AS "total_amount"
   FROM "public"."transactions"
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."analytics_transaction_volume" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."analytics_user_signups" AS
 SELECT "date"("created_at") AS "date",
    "count"(*) AS "signups"
   FROM "auth"."users"
  GROUP BY ("date"("created_at"))
  ORDER BY ("date"("created_at")) DESC;


ALTER VIEW "public"."analytics_user_signups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."annual_budget_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "fiscal_year" integer NOT NULL,
    "month" integer NOT NULL,
    "category_id" "uuid",
    "budget_type" "text" NOT NULL,
    "planned_amount" integer NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "annual_budget_items_budget_type_check" CHECK (("budget_type" = ANY (ARRAY['income'::"text", 'expense'::"text"]))),
    CONSTRAINT "annual_budget_items_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."annual_budget_items" OWNER TO "postgres";


COMMENT ON TABLE "public"."annual_budget_items" IS '年間収支計画（月別・カテゴリ別）';



COMMENT ON COLUMN "public"."annual_budget_items"."fiscal_year" IS '年度（2024, 2025等）';



COMMENT ON COLUMN "public"."annual_budget_items"."month" IS '月（1-12）';



COMMENT ON COLUMN "public"."annual_budget_items"."budget_type" IS '種別（income/expense）';



COMMENT ON COLUMN "public"."annual_budget_items"."planned_amount" IS '計画額';



CREATE TABLE IF NOT EXISTS "public"."balance_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "name" "text" NOT NULL,
    "item_type" "text" NOT NULL,
    "category" "text",
    "balance" integer DEFAULT 0 NOT NULL,
    "balance_date" "date",
    "note" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."balance_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_id" "uuid",
    "monthly_amount" integer NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "parent_id" "uuid",
    "user_id" "uuid",
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'transfer'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."counterparties" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."counterparties" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "invited_email" "text",
    "invited_at" timestamp with time zone DEFAULT "now"(),
    "joined_at" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "invite_token" "text"
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" DEFAULT '我が家の家計'::"text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."households" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."quick_entries" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "account_id" "uuid",
    "category_id" "uuid",
    "line_type" "text" DEFAULT 'expense'::"text",
    "counterparty" "text",
    "is_active" boolean DEFAULT true,
    "use_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid"
);


ALTER TABLE "public"."quick_entries" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_transaction_lines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recurring_transaction_id" "uuid",
    "amount" integer NOT NULL,
    "category_id" "uuid",
    "line_type" "text" NOT NULL,
    "counterparty" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recurring_transaction_lines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recurring_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "account_id" "uuid",
    "total_amount" integer NOT NULL,
    "day_of_month" integer,
    "payment_delay_days" integer DEFAULT 0,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "user_id" "uuid",
    "payment_month_offset" integer DEFAULT 0,
    "payment_day" integer
);


ALTER TABLE "public"."recurring_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_balances" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "counterparty" "text" NOT NULL,
    "receive_balance" integer DEFAULT 0 NOT NULL,
    "pay_balance" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settlement_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "settlement_id" "uuid" NOT NULL,
    "transaction_line_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settlement_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "counterparty" "text" NOT NULL,
    "amount" integer NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "account_id" "uuid",
    "type" "text" DEFAULT 'receive'::"text"
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transaction_lines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "amount" integer NOT NULL,
    "category_id" "uuid" NOT NULL,
    "line_type" "text" NOT NULL,
    "counterparty" "text",
    "is_settled" boolean DEFAULT false NOT NULL,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "amortization_months" integer DEFAULT 1,
    "amortization_start" "date",
    "amortization_end" "date",
    "settled_amount" integer DEFAULT 0,
    CONSTRAINT "transaction_lines_line_type_check" CHECK (("line_type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'asset'::"text", 'liability'::"text"])))
);


ALTER TABLE "public"."transaction_lines" OWNER TO "postgres";


ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annual_budget_items"
    ADD CONSTRAINT "annual_budget_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."annual_budget_items"
    ADD CONSTRAINT "annual_budget_items_user_id_fiscal_year_month_category_id_key" UNIQUE ("user_id", "fiscal_year", "month", "category_id");



ALTER TABLE ONLY "public"."balance_items"
    ADD CONSTRAINT "balance_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_category_unique" UNIQUE ("user_id", "category_id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."counterparties"
    ADD CONSTRAINT "counterparties_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_invite_token_key" UNIQUE ("invite_token");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_owner_id_key" UNIQUE ("owner_id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_transaction_lines"
    ADD CONSTRAINT "recurring_transaction_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_balances"
    ADD CONSTRAINT "settlement_balances_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlement_balances"
    ADD CONSTRAINT "settlement_balances_user_id_counterparty_key" UNIQUE ("user_id", "counterparty");



ALTER TABLE ONLY "public"."settlement_items"
    ADD CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "transaction_lines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_accounts_user_id" ON "public"."accounts" USING "btree" ("user_id");



CREATE INDEX "idx_analytics_events_created_at" ON "public"."analytics_events" USING "btree" ("created_at");



CREATE INDEX "idx_analytics_events_event_name" ON "public"."analytics_events" USING "btree" ("event_name");



CREATE INDEX "idx_analytics_events_user_id" ON "public"."analytics_events" USING "btree" ("user_id");



CREATE INDEX "idx_annual_budget_items_category" ON "public"."annual_budget_items" USING "btree" ("category_id");



CREATE INDEX "idx_annual_budget_items_user_year" ON "public"."annual_budget_items" USING "btree" ("user_id", "fiscal_year");



CREATE INDEX "idx_budgets_user_id" ON "public"."budgets" USING "btree" ("user_id");



CREATE INDEX "idx_categories_parent_id" ON "public"."categories" USING "btree" ("parent_id");



CREATE INDEX "idx_categories_user_id" ON "public"."categories" USING "btree" ("user_id");



CREATE INDEX "idx_counterparties_user_id" ON "public"."counterparties" USING "btree" ("user_id");



CREATE INDEX "idx_household_members_household" ON "public"."household_members" USING "btree" ("household_id");



CREATE UNIQUE INDEX "idx_household_members_household_email" ON "public"."household_members" USING "btree" ("household_id", "invited_email") WHERE (("invited_email" IS NOT NULL) AND ("status" = 'pending'::"text"));



CREATE UNIQUE INDEX "idx_household_members_household_user" ON "public"."household_members" USING "btree" ("household_id", "user_id") WHERE ("user_id" IS NOT NULL);



CREATE INDEX "idx_household_members_invite_token" ON "public"."household_members" USING "btree" ("invite_token");



CREATE INDEX "idx_household_members_status" ON "public"."household_members" USING "btree" ("status");



CREATE INDEX "idx_household_members_user" ON "public"."household_members" USING "btree" ("user_id");



CREATE INDEX "idx_households_owner" ON "public"."households" USING "btree" ("owner_id");



CREATE INDEX "idx_quick_entries_user_id" ON "public"."quick_entries" USING "btree" ("user_id");



CREATE INDEX "idx_recurring_transactions_user_id" ON "public"."recurring_transactions" USING "btree" ("user_id");



CREATE INDEX "idx_settlement_balances_counterparty" ON "public"."settlement_balances" USING "btree" ("counterparty");



CREATE INDEX "idx_settlement_balances_user_id" ON "public"."settlement_balances" USING "btree" ("user_id");



CREATE INDEX "idx_settlement_items_settlement_id" ON "public"."settlement_items" USING "btree" ("settlement_id");



CREATE INDEX "idx_settlement_items_transaction_line_id" ON "public"."settlement_items" USING "btree" ("transaction_line_id");



CREATE INDEX "idx_settlements_counterparty" ON "public"."settlements" USING "btree" ("counterparty");



CREATE INDEX "idx_settlements_date" ON "public"."settlements" USING "btree" ("date" DESC);



CREATE INDEX "idx_settlements_user_id" ON "public"."settlements" USING "btree" ("user_id");



CREATE INDEX "idx_subscriptions_stripe_customer_id" ON "public"."subscriptions" USING "btree" ("stripe_customer_id");



CREATE INDEX "idx_subscriptions_stripe_subscription_id" ON "public"."subscriptions" USING "btree" ("stripe_subscription_id");



CREATE INDEX "idx_subscriptions_user_id" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_transaction_lines_category" ON "public"."transaction_lines" USING "btree" ("category_id");



CREATE INDEX "idx_transaction_lines_counterparty" ON "public"."transaction_lines" USING "btree" ("counterparty") WHERE ("counterparty" IS NOT NULL);



CREATE INDEX "idx_transaction_lines_transaction" ON "public"."transaction_lines" USING "btree" ("transaction_id");



CREATE INDEX "idx_transaction_lines_unsettled" ON "public"."transaction_lines" USING "btree" ("counterparty", "is_settled") WHERE ("is_settled" = false);



CREATE INDEX "idx_transactions_account" ON "public"."transactions" USING "btree" ("account_id");



CREATE INDEX "idx_transactions_counterparty_id" ON "public"."transactions" USING "btree" ("counterparty_id");



CREATE INDEX "idx_transactions_date" ON "public"."transactions" USING "btree" ("date" DESC);



CREATE INDEX "idx_transactions_paid_by_other" ON "public"."transactions" USING "btree" ("paid_by_other") WHERE ("paid_by_other" = true);



CREATE INDEX "idx_transactions_payment_date" ON "public"."transactions" USING "btree" ("payment_date" DESC);



CREATE INDEX "idx_transactions_user_id" ON "public"."transactions" USING "btree" ("user_id");



CREATE OR REPLACE TRIGGER "settlement_balances_updated_at" BEFORE UPDATE ON "public"."settlement_balances" FOR EACH ROW EXECUTE FUNCTION "public"."update_settlement_balances_updated_at"();



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_partner_user_id_fkey" FOREIGN KEY ("partner_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."accounts"
    ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."analytics_events"
    ADD CONSTRAINT "analytics_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."annual_budget_items"
    ADD CONSTRAINT "annual_budget_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."annual_budget_items"
    ADD CONSTRAINT "annual_budget_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."balance_items"
    ADD CONSTRAINT "balance_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."counterparties"
    ADD CONSTRAINT "counterparties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."quick_entries"
    ADD CONSTRAINT "quick_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transaction_lines"
    ADD CONSTRAINT "recurring_transaction_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id");



ALTER TABLE ONLY "public"."recurring_transaction_lines"
    ADD CONSTRAINT "recurring_transaction_lines_recurring_transaction_id_fkey" FOREIGN KEY ("recurring_transaction_id") REFERENCES "public"."recurring_transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."recurring_transactions"
    ADD CONSTRAINT "recurring_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_balances"
    ADD CONSTRAINT "settlement_balances_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."settlement_items"
    ADD CONSTRAINT "settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_items"
    ADD CONSTRAINT "settlement_items_transaction_line_id_fkey" FOREIGN KEY ("transaction_line_id") REFERENCES "public"."transaction_lines"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "transaction_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transaction_lines"
    ADD CONSTRAINT "transaction_lines_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_counterparty_id_fkey" FOREIGN KEY ("counterparty_id") REFERENCES "public"."counterparties"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_settlement_account_id_fkey" FOREIGN KEY ("settlement_account_id") REFERENCES "public"."accounts"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Service role can read all" ON "public"."analytics_events" FOR SELECT USING ((("auth"."jwt"() ->> 'role'::"text") = 'service_role'::"text"));



CREATE POLICY "Users can delete own annual_budget_items" ON "public"."annual_budget_items" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own settlement_balances" ON "public"."settlement_balances" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can delete own settlement_items" ON "public"."settlement_items" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."settlements"
  WHERE (("settlements"."id" = "settlement_items"."settlement_id") AND ("settlements"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own annual_budget_items" ON "public"."annual_budget_items" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own events" ON "public"."analytics_events" FOR INSERT WITH CHECK ((("auth"."uid"() = "user_id") OR ("user_id" IS NULL)));



CREATE POLICY "Users can insert own settlement_balances" ON "public"."settlement_balances" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert own settlement_items" ON "public"."settlement_items" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settlements"
  WHERE (("settlements"."id" = "settlement_items"."settlement_id") AND ("settlements"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can manage their own balance_items" ON "public"."balance_items" USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own annual_budget_items" ON "public"."annual_budget_items" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own settlement_balances" ON "public"."settlement_balances" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own annual_budget_items" ON "public"."annual_budget_items" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view own settlement_balances" ON "public"."settlement_balances" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view own settlement_items" ON "public"."settlement_items" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."settlements"
  WHERE (("settlements"."id" = "settlement_items"."settlement_id") AND ("settlements"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."accounts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "accounts_delete" ON "public"."accounts" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "accounts_insert" ON "public"."accounts" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "accounts_select" ON "public"."accounts" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "accounts_update" ON "public"."accounts" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."analytics_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."annual_budget_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."balance_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "budgets_delete" ON "public"."budgets" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "budgets_insert" ON "public"."budgets" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "budgets_select" ON "public"."budgets" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "budgets_update" ON "public"."budgets" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete" ON "public"."categories" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_insert" ON "public"."categories" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "categories_select" ON "public"."categories" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR ("user_id" IS NULL) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."counterparties" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "counterparties_delete" ON "public"."counterparties" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "counterparties_insert" ON "public"."counterparties" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "counterparties_select" ON "public"."counterparties" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "counterparties_update" ON "public"."counterparties" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "household_members_delete" ON "public"."household_members" FOR DELETE USING (("public"."is_household_owner"("household_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "household_members_insert" ON "public"."household_members" FOR INSERT WITH CHECK ("public"."is_household_owner"("household_id", "auth"."uid"()));



CREATE POLICY "household_members_select" ON "public"."household_members" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR "public"."is_household_owner"("household_id", "auth"."uid"()) OR (("invited_email" IS NOT NULL) AND ("status" = 'pending'::"text"))));



CREATE POLICY "household_members_select_by_token" ON "public"."household_members" FOR SELECT USING ((("invite_token" IS NOT NULL) AND ("status" = 'pending'::"text")));



CREATE POLICY "household_members_update" ON "public"."household_members" FOR UPDATE USING (("public"."is_household_owner"("household_id", "auth"."uid"()) OR (("invite_token" IS NOT NULL) AND ("status" = 'pending'::"text")))) WITH CHECK (("public"."is_household_owner"("household_id", "auth"."uid"()) OR ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "households_delete" ON "public"."households" FOR DELETE USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "households_insert" ON "public"."households" FOR INSERT WITH CHECK (("owner_id" = "auth"."uid"()));



CREATE POLICY "households_select" ON "public"."households" FOR SELECT USING ((("owner_id" = "auth"."uid"()) OR "public"."is_household_member"("id", "auth"."uid"()) OR "public"."has_pending_invite"("id", (( SELECT "users"."email"
   FROM "auth"."users"
  WHERE ("users"."id" = "auth"."uid"())))::"text")));



CREATE POLICY "households_update" ON "public"."households" FOR UPDATE USING (("owner_id" = "auth"."uid"())) WITH CHECK (("owner_id" = "auth"."uid"()));



ALTER TABLE "public"."quick_entries" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "quick_entries_delete" ON "public"."quick_entries" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "quick_entries_insert" ON "public"."quick_entries" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "quick_entries_select" ON "public"."quick_entries" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "quick_entries_update" ON "public"."quick_entries" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."recurring_transaction_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_transaction_lines_delete" ON "public"."recurring_transaction_lines" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_transactions" "rt"
  WHERE (("rt"."id" = "recurring_transaction_lines"."recurring_transaction_id") AND ("rt"."user_id" = "auth"."uid"())))));



CREATE POLICY "recurring_transaction_lines_insert" ON "public"."recurring_transaction_lines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."recurring_transactions" "rt"
  WHERE (("rt"."id" = "recurring_transaction_lines"."recurring_transaction_id") AND ("rt"."user_id" = "auth"."uid"())))));



CREATE POLICY "recurring_transaction_lines_select" ON "public"."recurring_transaction_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_transactions" "rt"
  WHERE (("rt"."id" = "recurring_transaction_lines"."recurring_transaction_id") AND (("rt"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("rt"."user_id") = "public"."get_user_household_id"("auth"."uid"()))))))));



CREATE POLICY "recurring_transaction_lines_update" ON "public"."recurring_transaction_lines" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."recurring_transactions" "rt"
  WHERE (("rt"."id" = "recurring_transaction_lines"."recurring_transaction_id") AND (("rt"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("rt"."user_id") = "public"."get_user_household_id"("auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."recurring_transactions" "rt"
  WHERE (("rt"."id" = "recurring_transaction_lines"."recurring_transaction_id") AND (("rt"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("rt"."user_id") = "public"."get_user_household_id"("auth"."uid"()))))))));



ALTER TABLE "public"."recurring_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recurring_transactions_delete" ON "public"."recurring_transactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "recurring_transactions_insert" ON "public"."recurring_transactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "recurring_transactions_select" ON "public"."recurring_transactions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "recurring_transactions_update" ON "public"."recurring_transactions" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."settlement_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlement_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlements_delete" ON "public"."settlements" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "settlements_insert" ON "public"."settlements" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "settlements_select" ON "public"."settlements" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "settlements_update" ON "public"."settlements" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions_insert" ON "public"."subscriptions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "subscriptions_select" ON "public"."subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "subscriptions_update" ON "public"."subscriptions" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."transaction_lines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transaction_lines_delete" ON "public"."transaction_lines" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_lines"."transaction_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "transaction_lines_insert" ON "public"."transaction_lines" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_lines"."transaction_id") AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "transaction_lines_select" ON "public"."transaction_lines" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_lines"."transaction_id") AND (("t"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("t"."user_id") = "public"."get_user_household_id"("auth"."uid"()))))))));



CREATE POLICY "transaction_lines_update" ON "public"."transaction_lines" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_lines"."transaction_id") AND (("t"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("t"."user_id") = "public"."get_user_household_id"("auth"."uid"())))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."id" = "transaction_lines"."transaction_id") AND (("t"."user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("t"."user_id") = "public"."get_user_household_id"("auth"."uid"()))))))));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_delete" ON "public"."transactions" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "transactions_select" ON "public"."transactions" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



CREATE POLICY "transactions_update" ON "public"."transactions" FOR UPDATE USING ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"()))))) WITH CHECK ((("user_id" = "auth"."uid"()) OR (("public"."get_user_household_id"("auth"."uid"()) IS NOT NULL) AND ("public"."get_user_household_id"("user_id") = "public"."get_user_household_id"("auth"."uid"())))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_household_id"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_household_id"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_household_id"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."has_pending_invite"("hid" "uuid", "user_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."has_pending_invite"("hid" "uuid", "user_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_pending_invite"("hid" "uuid", "user_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_member"("hid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_member"("hid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_member"("hid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_household_owner"("hid" "uuid", "uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_household_owner"("hid" "uuid", "uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_household_owner"("hid" "uuid", "uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_settlement_balances_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_settlement_balances_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_settlement_balances_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."accounts" TO "anon";
GRANT ALL ON TABLE "public"."accounts" TO "authenticated";
GRANT ALL ON TABLE "public"."accounts" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_events" TO "anon";
GRANT ALL ON TABLE "public"."analytics_events" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_events" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_daily_active_users" TO "anon";
GRANT ALL ON TABLE "public"."analytics_daily_active_users" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_daily_active_users" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_overview" TO "anon";
GRANT ALL ON TABLE "public"."analytics_overview" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_overview" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."analytics_subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_transaction_volume" TO "anon";
GRANT ALL ON TABLE "public"."analytics_transaction_volume" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_transaction_volume" TO "service_role";



GRANT ALL ON TABLE "public"."analytics_user_signups" TO "anon";
GRANT ALL ON TABLE "public"."analytics_user_signups" TO "authenticated";
GRANT ALL ON TABLE "public"."analytics_user_signups" TO "service_role";



GRANT ALL ON TABLE "public"."annual_budget_items" TO "anon";
GRANT ALL ON TABLE "public"."annual_budget_items" TO "authenticated";
GRANT ALL ON TABLE "public"."annual_budget_items" TO "service_role";



GRANT ALL ON TABLE "public"."balance_items" TO "anon";
GRANT ALL ON TABLE "public"."balance_items" TO "authenticated";
GRANT ALL ON TABLE "public"."balance_items" TO "service_role";



GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."counterparties" TO "anon";
GRANT ALL ON TABLE "public"."counterparties" TO "authenticated";
GRANT ALL ON TABLE "public"."counterparties" TO "service_role";



GRANT ALL ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT ALL ON TABLE "public"."household_members" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."quick_entries" TO "anon";
GRANT ALL ON TABLE "public"."quick_entries" TO "authenticated";
GRANT ALL ON TABLE "public"."quick_entries" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_transaction_lines" TO "anon";
GRANT ALL ON TABLE "public"."recurring_transaction_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_transaction_lines" TO "service_role";



GRANT ALL ON TABLE "public"."recurring_transactions" TO "anon";
GRANT ALL ON TABLE "public"."recurring_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."recurring_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_balances" TO "anon";
GRANT ALL ON TABLE "public"."settlement_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_balances" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_items" TO "anon";
GRANT ALL ON TABLE "public"."settlement_items" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_items" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



GRANT ALL ON TABLE "public"."transaction_lines" TO "anon";
GRANT ALL ON TABLE "public"."transaction_lines" TO "authenticated";
GRANT ALL ON TABLE "public"."transaction_lines" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







