-- Migration: Fix infinite recursion in households RLS policies
-- Date: 2026-01-04
-- Issue: households_select references household_members, which references households back

-- Create a SECURITY DEFINER function to check household membership
-- This bypasses RLS and avoids the circular dependency
CREATE OR REPLACE FUNCTION is_household_member(hid UUID, uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid
    AND user_id = uid
    AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Create a function to check if user owns a household
CREATE OR REPLACE FUNCTION is_household_owner(hid UUID, uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM households
    WHERE id = hid
    AND owner_id = uid
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Fix households SELECT policy using the SECURITY DEFINER function
DROP POLICY IF EXISTS "households_select" ON households;
CREATE POLICY "households_select" ON households FOR SELECT USING (
  owner_id = auth.uid()
  OR is_household_member(id, auth.uid())
);

-- Fix household_members SELECT policy using the SECURITY DEFINER function
DROP POLICY IF EXISTS "household_members_select" ON household_members;
CREATE POLICY "household_members_select" ON household_members FOR SELECT USING (
  user_id = auth.uid()
  OR is_household_owner(household_id, auth.uid())
  OR (invited_email IS NOT NULL AND status = 'pending')
);

-- Fix household_members INSERT policy
DROP POLICY IF EXISTS "household_members_insert" ON household_members;
CREATE POLICY "household_members_insert" ON household_members FOR INSERT WITH CHECK (
  is_household_owner(household_id, auth.uid())
);

-- Fix household_members UPDATE policy
DROP POLICY IF EXISTS "household_members_update" ON household_members;
CREATE POLICY "household_members_update" ON household_members FOR UPDATE USING (
  is_household_owner(household_id, auth.uid())
  OR (invite_token IS NOT NULL AND status = 'pending')
) WITH CHECK (
  is_household_owner(household_id, auth.uid())
  OR (user_id = auth.uid())
);

-- Fix household_members DELETE policy
DROP POLICY IF EXISTS "household_members_delete" ON household_members;
CREATE POLICY "household_members_delete" ON household_members FOR DELETE USING (
  is_household_owner(household_id, auth.uid())
  OR user_id = auth.uid()
);
