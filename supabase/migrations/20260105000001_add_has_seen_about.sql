-- Add has_seen_about column to subscriptions table
-- This tracks whether the user has seen the About modal on first login

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS has_seen_about BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN subscriptions.has_seen_about IS '初回ログイン時のAboutモーダル表示済みフラグ';
