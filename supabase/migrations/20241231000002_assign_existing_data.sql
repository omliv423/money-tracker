-- Migration: Assign existing data to user
-- Date: 2024-12-31

-- Assign all existing data to the first user
UPDATE accounts SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE categories SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE counterparties SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE transactions SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE recurring_transactions SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE quick_entries SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE budgets SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;
UPDATE settlements SET user_id = 'e58ec8a1-ce5d-41f8-acf7-e7f94aec56db' WHERE user_id IS NULL;

-- Add unique constraint for budgets (user_id, category_id)
-- Use DO block to check if constraint exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'budgets_user_category_unique'
  ) THEN
    ALTER TABLE budgets ADD CONSTRAINT budgets_user_category_unique UNIQUE(user_id, category_id);
  END IF;
END $$;
