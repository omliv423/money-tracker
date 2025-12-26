-- Add transfer category for fund transfers between accounts
INSERT INTO categories (name, type, is_active)
VALUES ('資金移動', 'transfer', true)
ON CONFLICT DO NOTHING;

-- Add transfer fee category
INSERT INTO categories (name, type, is_active)
VALUES ('振込手数料', 'expense', true)
ON CONFLICT DO NOTHING;
