-- Migration: Allow pending invite recipients to see the household name
-- Date: 2026-02-22
-- Issue: When a user with a pending invitation opens the partner sharing page,
--        the JOIN to households returns null because the households_select RLS
--        policy only allows owners and active members. This causes a client-side
--        crash (TypeError: Cannot read property 'name' of null).

-- Create a helper function to check if a user has a pending invitation for a household
CREATE OR REPLACE FUNCTION has_pending_invite(hid UUID, user_email TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM household_members
    WHERE household_id = hid
    AND invited_email = user_email
    AND status = 'pending'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Update households_select to also allow pending invite recipients
DROP POLICY IF EXISTS "households_select" ON households;
CREATE POLICY "households_select" ON households FOR SELECT USING (
  owner_id = auth.uid()
  OR is_household_member(id, auth.uid())
  OR has_pending_invite(id, (SELECT email FROM auth.users WHERE id = auth.uid()))
);
