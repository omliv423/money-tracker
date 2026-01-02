-- 共有口座設定を追加
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT false;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS partner_user_id UUID REFERENCES auth.users(id);
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS default_split_ratio INTEGER DEFAULT 50;

-- コメント
COMMENT ON COLUMN accounts.is_shared IS '共有口座かどうか';
COMMENT ON COLUMN accounts.partner_user_id IS 'パートナーのユーザーID（登録済みの場合）';
COMMENT ON COLUMN accounts.partner_name IS 'パートナー名（未登録の場合）';
COMMENT ON COLUMN accounts.default_split_ratio IS '自分のデフォルト負担比率（%）';
