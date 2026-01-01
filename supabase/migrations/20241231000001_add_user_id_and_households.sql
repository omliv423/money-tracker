-- Migration: Add user_id columns and create household tables for partner sharing
-- Date: 2024-12-31

-- ============================================================================
-- STEP 1: Add user_id columns to all relevant tables
-- ============================================================================

-- accounts
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);

-- categories (NULL = shared system categories)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- counterparties
ALTER TABLE counterparties ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_counterparties_user_id ON counterparties(user_id);

-- transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- recurring_transactions
ALTER TABLE recurring_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_recurring_transactions_user_id ON recurring_transactions(user_id);

-- quick_entries
ALTER TABLE quick_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_quick_entries_user_id ON quick_entries(user_id);

-- budgets
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);

-- Fix budgets unique constraint: should be (user_id, category_id) not just category_id
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_id_key;
-- We'll add the new constraint after user_id is populated

-- settlements
ALTER TABLE settlements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_settlements_user_id ON settlements(user_id);

-- ============================================================================
-- STEP 2: Create households tables for partner sharing
-- ============================================================================

-- Household (family unit)
CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '我が家の家計',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(owner_id)
);

CREATE INDEX IF NOT EXISTS idx_households_owner ON households(owner_id);

-- Household members
CREATE TABLE IF NOT EXISTS household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  invited_email TEXT,
  invited_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(household_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_household_members_user ON household_members(user_id);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_household_members_status ON household_members(status);

-- ============================================================================
-- STEP 3: Helper function to get user's household
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_household_id(uid UUID)
RETURNS UUID AS $$
  SELECT COALESCE(
    (SELECT id FROM households WHERE owner_id = uid),
    (SELECT household_id FROM household_members
     WHERE user_id = uid AND status = 'active'
     LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- STEP 4: Drop existing RLS policies (they are all USING (true))
-- ============================================================================

-- accounts
DROP POLICY IF EXISTS "Enable read access for all users" ON accounts;
DROP POLICY IF EXISTS "Enable insert for all users" ON accounts;
DROP POLICY IF EXISTS "Enable update for all users" ON accounts;
DROP POLICY IF EXISTS "Enable delete for all users" ON accounts;

-- categories
DROP POLICY IF EXISTS "Enable read access for all users" ON categories;
DROP POLICY IF EXISTS "Enable insert for all users" ON categories;
DROP POLICY IF EXISTS "Enable update for all users" ON categories;
DROP POLICY IF EXISTS "Enable delete for all users" ON categories;

-- counterparties
DROP POLICY IF EXISTS "Enable read access for all users" ON counterparties;
DROP POLICY IF EXISTS "Enable insert for all users" ON counterparties;
DROP POLICY IF EXISTS "Enable update for all users" ON counterparties;
DROP POLICY IF EXISTS "Enable delete for all users" ON counterparties;

-- transactions
DROP POLICY IF EXISTS "Enable read access for all users" ON transactions;
DROP POLICY IF EXISTS "Enable insert for all users" ON transactions;
DROP POLICY IF EXISTS "Enable update for all users" ON transactions;
DROP POLICY IF EXISTS "Enable delete for all users" ON transactions;

-- transaction_lines
DROP POLICY IF EXISTS "Enable read access for all users" ON transaction_lines;
DROP POLICY IF EXISTS "Enable insert for all users" ON transaction_lines;
DROP POLICY IF EXISTS "Enable update for all users" ON transaction_lines;
DROP POLICY IF EXISTS "Enable delete for all users" ON transaction_lines;

-- recurring_transactions
DROP POLICY IF EXISTS "Enable read access for all users" ON recurring_transactions;
DROP POLICY IF EXISTS "Enable insert for all users" ON recurring_transactions;
DROP POLICY IF EXISTS "Enable update for all users" ON recurring_transactions;
DROP POLICY IF EXISTS "Enable delete for all users" ON recurring_transactions;

-- recurring_transaction_lines
DROP POLICY IF EXISTS "Enable read access for all users" ON recurring_transaction_lines;
DROP POLICY IF EXISTS "Enable insert for all users" ON recurring_transaction_lines;
DROP POLICY IF EXISTS "Enable update for all users" ON recurring_transaction_lines;
DROP POLICY IF EXISTS "Enable delete for all users" ON recurring_transaction_lines;

-- quick_entries
DROP POLICY IF EXISTS "Enable read access for all users" ON quick_entries;
DROP POLICY IF EXISTS "Enable insert for all users" ON quick_entries;
DROP POLICY IF EXISTS "Enable update for all users" ON quick_entries;
DROP POLICY IF EXISTS "Enable delete for all users" ON quick_entries;

-- budgets
DROP POLICY IF EXISTS "Enable read access for all users" ON budgets;
DROP POLICY IF EXISTS "Enable insert for all users" ON budgets;
DROP POLICY IF EXISTS "Enable update for all users" ON budgets;
DROP POLICY IF EXISTS "Enable delete for all users" ON budgets;

-- settlements
DROP POLICY IF EXISTS "Enable read access for all users" ON settlements;
DROP POLICY IF EXISTS "Enable insert for all users" ON settlements;
DROP POLICY IF EXISTS "Enable update for all users" ON settlements;
DROP POLICY IF EXISTS "Enable delete for all users" ON settlements;

-- ============================================================================
-- STEP 5: Create new RLS policies with household support
-- ============================================================================

-- Helper: Check if user can access data (own data OR same household)
-- For now, we check: user_id = auth.uid() OR same household

-- ----- accounts -----
CREATE POLICY "accounts_select" ON accounts FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "accounts_insert" ON accounts FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

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

CREATE POLICY "accounts_delete" ON accounts FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- categories -----
-- Categories: user can see own + shared (user_id IS NULL) + household
CREATE POLICY "categories_select" ON categories FOR SELECT USING (
  user_id IS NULL  -- shared system categories
  OR user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "categories_insert" ON categories FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

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

CREATE POLICY "categories_delete" ON categories FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- counterparties -----
CREATE POLICY "counterparties_select" ON counterparties FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "counterparties_insert" ON counterparties FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

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

CREATE POLICY "counterparties_delete" ON counterparties FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- transactions -----
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (SELECT 1 FROM accounts WHERE accounts.id = account_id AND accounts.user_id = auth.uid())
);

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

CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- transaction_lines -----
-- Inherits access from parent transaction
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

CREATE POLICY "transaction_lines_insert" ON transaction_lines FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND t.user_id = auth.uid()
  )
);

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

CREATE POLICY "transaction_lines_delete" ON transaction_lines FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id
    AND t.user_id = auth.uid()
  )
);

-- ----- recurring_transactions -----
CREATE POLICY "recurring_transactions_select" ON recurring_transactions FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "recurring_transactions_insert" ON recurring_transactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "recurring_transactions_update" ON recurring_transactions FOR UPDATE USING (
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

CREATE POLICY "recurring_transactions_delete" ON recurring_transactions FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- recurring_transaction_lines -----
CREATE POLICY "recurring_transaction_lines_select" ON recurring_transaction_lines FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND (
      rt.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(rt.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "recurring_transaction_lines_insert" ON recurring_transaction_lines FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND rt.user_id = auth.uid()
  )
);

CREATE POLICY "recurring_transaction_lines_update" ON recurring_transaction_lines FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND (
      rt.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(rt.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND (
      rt.user_id = auth.uid()
      OR (
        get_user_household_id(auth.uid()) IS NOT NULL
        AND get_user_household_id(rt.user_id) = get_user_household_id(auth.uid())
      )
    )
  )
);

CREATE POLICY "recurring_transaction_lines_delete" ON recurring_transaction_lines FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND rt.user_id = auth.uid()
  )
);

-- ----- quick_entries -----
CREATE POLICY "quick_entries_select" ON quick_entries FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "quick_entries_insert" ON quick_entries FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "quick_entries_update" ON quick_entries FOR UPDATE USING (
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

CREATE POLICY "quick_entries_delete" ON quick_entries FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- budgets -----
CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "budgets_update" ON budgets FOR UPDATE USING (
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

CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- settlements -----
CREATE POLICY "settlements_select" ON settlements FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

CREATE POLICY "settlements_insert" ON settlements FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

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

CREATE POLICY "settlements_delete" ON settlements FOR DELETE USING (
  user_id = auth.uid()
);

-- ----- households -----
ALTER TABLE households ENABLE ROW LEVEL SECURITY;

CREATE POLICY "households_select" ON households FOR SELECT USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM household_members hm
    WHERE hm.household_id = id
    AND hm.user_id = auth.uid()
    AND hm.status = 'active'
  )
);

CREATE POLICY "households_insert" ON households FOR INSERT WITH CHECK (
  owner_id = auth.uid()
);

CREATE POLICY "households_update" ON households FOR UPDATE USING (
  owner_id = auth.uid()
) WITH CHECK (
  owner_id = auth.uid()
);

CREATE POLICY "households_delete" ON households FOR DELETE USING (
  owner_id = auth.uid()
);

-- ----- household_members -----
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_select" ON household_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
);

CREATE POLICY "household_members_insert" ON household_members FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
);

CREATE POLICY "household_members_update" ON household_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR (user_id = auth.uid() AND status = 'pending')
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR (user_id = auth.uid())
);

CREATE POLICY "household_members_delete" ON household_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
);
