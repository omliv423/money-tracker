-- URGENT: Fix data leak - remove "Allow all access" policies that were never dropped
-- These policies allow all users to see all data

-- Drop the insecure "Allow all access" policies
DROP POLICY IF EXISTS "Allow all access to recurring_transactions" ON recurring_transactions;
DROP POLICY IF EXISTS "Allow all access to recurring_transaction_lines" ON recurring_transaction_lines;
DROP POLICY IF EXISTS "Allow all access to quick_entries" ON quick_entries;

-- Ensure proper RLS policies exist (recreate if needed)
-- recurring_transactions
DROP POLICY IF EXISTS "recurring_transactions_select" ON recurring_transactions;
CREATE POLICY "recurring_transactions_select" ON recurring_transactions FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "recurring_transactions_insert" ON recurring_transactions;
CREATE POLICY "recurring_transactions_insert" ON recurring_transactions FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "recurring_transactions_update" ON recurring_transactions;
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

DROP POLICY IF EXISTS "recurring_transactions_delete" ON recurring_transactions;
CREATE POLICY "recurring_transactions_delete" ON recurring_transactions FOR DELETE USING (
  user_id = auth.uid()
);

-- recurring_transaction_lines
DROP POLICY IF EXISTS "recurring_transaction_lines_select" ON recurring_transaction_lines;
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

DROP POLICY IF EXISTS "recurring_transaction_lines_insert" ON recurring_transaction_lines;
CREATE POLICY "recurring_transaction_lines_insert" ON recurring_transaction_lines FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND rt.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "recurring_transaction_lines_update" ON recurring_transaction_lines;
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

DROP POLICY IF EXISTS "recurring_transaction_lines_delete" ON recurring_transaction_lines;
CREATE POLICY "recurring_transaction_lines_delete" ON recurring_transaction_lines FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM recurring_transactions rt
    WHERE rt.id = recurring_transaction_id
    AND rt.user_id = auth.uid()
  )
);

-- quick_entries
DROP POLICY IF EXISTS "quick_entries_select" ON quick_entries;
CREATE POLICY "quick_entries_select" ON quick_entries FOR SELECT USING (
  user_id = auth.uid()
  OR (
    get_user_household_id(auth.uid()) IS NOT NULL
    AND get_user_household_id(user_id) = get_user_household_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "quick_entries_insert" ON quick_entries;
CREATE POLICY "quick_entries_insert" ON quick_entries FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

DROP POLICY IF EXISTS "quick_entries_update" ON quick_entries;
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

DROP POLICY IF EXISTS "quick_entries_delete" ON quick_entries;
CREATE POLICY "quick_entries_delete" ON quick_entries FOR DELETE USING (
  user_id = auth.uid()
);
