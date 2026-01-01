-- Migration: Add invite_token column for link-based invitations
-- Date: 2024-12-31

-- Add invite_token column to household_members
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_household_members_invite_token ON household_members(invite_token);

-- Allow users to read invitations by token (for accepting invitations)
DROP POLICY IF EXISTS "household_members_select_by_token" ON household_members;
CREATE POLICY "household_members_select_by_token" ON household_members FOR SELECT USING (
  invite_token IS NOT NULL AND status = 'pending'
);
