-- Analytics events table for tracking user actions
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_name VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_path VARCHAR(500),
  session_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_name ON analytics_events(event_name);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Enable RLS
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can insert their own events
CREATE POLICY "Users can insert own events" ON analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Only service role can read (for admin dashboard)
CREATE POLICY "Service role can read all" ON analytics_events
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- View: Daily active users
CREATE OR REPLACE VIEW analytics_daily_active_users AS
SELECT
  DATE(created_at) as date,
  COUNT(DISTINCT user_id) as active_users
FROM analytics_events
WHERE user_id IS NOT NULL
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: User signup stats
CREATE OR REPLACE VIEW analytics_user_signups AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as signups
FROM auth.users
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Subscription stats
CREATE OR REPLACE VIEW analytics_subscriptions AS
SELECT
  plan,
  status,
  COUNT(*) as count
FROM subscriptions
GROUP BY plan, status;

-- View: Transaction volume by day
CREATE OR REPLACE VIEW analytics_transaction_volume AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as transaction_count,
  SUM(total_amount) as total_amount
FROM transactions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- View: Overall metrics
CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  (SELECT COUNT(*) FROM auth.users) as total_users,
  (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '7 days') as new_users_7d,
  (SELECT COUNT(*) FROM auth.users WHERE created_at > NOW() - INTERVAL '30 days') as new_users_30d,
  (SELECT COUNT(*) FROM subscriptions WHERE plan = 'premium' AND status = 'active') as premium_users,
  (SELECT COUNT(*) FROM transactions) as total_transactions,
  (SELECT COUNT(*) FROM transactions WHERE created_at > NOW() - INTERVAL '7 days') as transactions_7d,
  (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE created_at > NOW() - INTERVAL '7 days') as active_users_7d;
