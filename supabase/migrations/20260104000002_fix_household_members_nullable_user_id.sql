-- Migration: Make user_id nullable in household_members for pending invitations
-- Date: 2026-01-04
-- Issue: Invitations cannot be created because user_id is NOT NULL, but we don't know
--        the user_id until the invited person accepts the invitation

-- Make user_id nullable
ALTER TABLE household_members ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing unique constraint (household_id, user_id)
-- because user_id can now be null for pending invitations
ALTER TABLE household_members DROP CONSTRAINT IF EXISTS household_members_household_id_user_id_key;

-- Add a partial unique constraint that only applies when user_id is not null
-- This ensures each user can only be a member of a household once
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_household_user
ON household_members(household_id, user_id) WHERE user_id IS NOT NULL;

-- Also ensure each email can only have one pending invitation per household
CREATE UNIQUE INDEX IF NOT EXISTS idx_household_members_household_email
ON household_members(household_id, invited_email) WHERE invited_email IS NOT NULL AND status = 'pending';

-- Update RLS policy for household_members_select to handle pending invitations
-- Users can see their own invitations by email
DROP POLICY IF EXISTS "household_members_select" ON household_members;
CREATE POLICY "household_members_select" ON household_members FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR (invited_email IS NOT NULL AND status = 'pending')
);

-- Update RLS policy for update to allow accepting invitations
DROP POLICY IF EXISTS "household_members_update" ON household_members;
CREATE POLICY "household_members_update" ON household_members FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR (invite_token IS NOT NULL AND status = 'pending')
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR (user_id = auth.uid())
);

-- Allow members to delete themselves (leave household)
DROP POLICY IF EXISTS "household_members_delete" ON household_members;
CREATE POLICY "household_members_delete" ON household_members FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM households h
    WHERE h.id = household_id
    AND h.owner_id = auth.uid()
  )
  OR user_id = auth.uid()
);
