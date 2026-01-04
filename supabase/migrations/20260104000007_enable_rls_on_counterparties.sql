-- Enable RLS on counterparties table (was never enabled!)
ALTER TABLE counterparties ENABLE ROW LEVEL SECURITY;

-- Recreate policies to ensure they're applied
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
