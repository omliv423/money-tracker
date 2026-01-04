-- URGENT: Fix all remaining "Allow all access" policies from schema.sql
-- These were never dropped by any migration

-- Drop ALL insecure "Allow all access" policies
DROP POLICY IF EXISTS "Allow all access to accounts" ON accounts;
DROP POLICY IF EXISTS "Allow all access to categories" ON categories;
DROP POLICY IF EXISTS "Allow all access to transactions" ON transactions;
DROP POLICY IF EXISTS "Allow all access to transaction_lines" ON transaction_lines;
DROP POLICY IF EXISTS "Allow all access to settlements" ON settlements;
DROP POLICY IF EXISTS "Allow all access to counterparties" ON counterparties;

-- Verify proper policies exist (recreate if needed)

-- accounts
DROP POLICY IF EXISTS "accounts_select" ON accounts;
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "accounts_insert" ON accounts;
CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "accounts_update" ON accounts;
CREATE POLICY "accounts_update" ON accounts FOR UPDATE USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
) WITH CHECK (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "accounts_delete" ON accounts;
CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (
  user_id = auth.uid()
);

-- categories
DROP POLICY IF EXISTS "categories_select" ON categories;
CREATE POLICY "categories_select" ON categories FOR SELECT USING (
  user_id = auth.uid()
  OR user_id IS NULL  -- system categories
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "categories_insert" ON categories;
CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "categories_update" ON categories;
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
) WITH CHECK (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "categories_delete" ON categories;
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (
  user_id = auth.uid()
);

-- transactions
DROP POLICY IF EXISTS "transactions_select" ON transactions;
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "transactions_insert" ON transactions;
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "transactions_update" ON transactions;
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
) WITH CHECK (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "transactions_delete" ON transactions;
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (
  user_id = auth.uid()
);

-- transaction_lines
DROP POLICY IF EXISTS "transaction_lines_select" ON transaction_lines;
CREATE POLICY "transaction_lines_select" ON transaction_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND (
      t.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(t.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "transaction_lines_insert" ON transaction_lines;
CREATE POLICY "transaction_lines_insert" ON transaction_lines FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND t.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "transaction_lines_update" ON transaction_lines;
CREATE POLICY "transaction_lines_update" ON transaction_lines FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND (
      t.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(t.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND (
      t.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(t.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
);

DROP POLICY IF EXISTS "transaction_lines_delete" ON transaction_lines;
CREATE POLICY "transaction_lines_delete" ON transaction_lines FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND t.user_id = auth.uid()
  )
);

-- settlements
DROP POLICY IF EXISTS "settlements_select" ON settlements;
CREATE POLICY "settlements_select" ON settlements FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "settlements_insert" ON settlements;
CREATE POLICY "settlements_insert" ON settlements FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "settlements_update" ON settlements;
CREATE POLICY "settlements_update" ON settlements FOR UPDATE USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
) WITH CHECK (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "settlements_delete" ON settlements;
CREATE POLICY "settlements_delete" ON settlements FOR DELETE USING (
  user_id = auth.uid()
);

-- counterparties
DROP POLICY IF EXISTS "counterparties_select" ON counterparties;
CREATE POLICY "counterparties_select" ON counterparties FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "counterparties_insert" ON counterparties;
CREATE POLICY "counterparties_insert" ON counterparties FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "counterparties_update" ON counterparties;
CREATE POLICY "counterparties_update" ON counterparties FOR UPDATE USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
) WITH CHECK (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "counterparties_delete" ON counterparties;
CREATE POLICY "counterparties_delete" ON counterparties FOR DELETE USING (
  user_id = auth.uid()
);
