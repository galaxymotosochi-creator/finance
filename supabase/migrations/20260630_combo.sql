-- Добавляем колонки для комбо в products
ALTER TABLE products ADD COLUMN IF NOT EXISTS combo_items JSONB DEFAULT NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_custom BOOLEAN DEFAULT false;

-- Добавляем колонку для хранения состава комбо в receipt_items
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS combo_items JSONB DEFAULT NULL;
