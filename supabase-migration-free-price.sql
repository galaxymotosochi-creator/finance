-- ============================================
-- МИГРАЦИЯ: Свободная цена для товаров
-- Выполнить в Supabase → SQL Editor
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS free_price BOOLEAN DEFAULT false;
