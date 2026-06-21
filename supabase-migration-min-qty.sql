-- Добавляем колонку min_qty в таблицу products
ALTER TABLE products ADD COLUMN IF NOT EXISTS min_qty INTEGER DEFAULT 0;
