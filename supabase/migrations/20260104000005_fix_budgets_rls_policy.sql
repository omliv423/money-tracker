-- Fix budgets RLS policy - same issue as recurring_transactions and quick_entries
-- The "Allow all access to budgets" policy was never dropped

DROP POLICY IF EXISTS "Allow all access to budgets" ON budgets;

-- Ensure proper RLS policies exist
DROP POLICY IF EXISTS "budgets_select" ON budgets;
CREATE POLICY "budgets_select" ON budgets FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "budgets_insert" ON budgets;
CREATE POLICY "budgets_insert" ON budgets FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "budgets_update" ON budgets;
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

DROP POLICY IF EXISTS "budgets_delete" ON budgets;
CREATE POLICY "budgets_delete" ON budgets FOR DELETE USING (
  user_id = auth.uid()
);
