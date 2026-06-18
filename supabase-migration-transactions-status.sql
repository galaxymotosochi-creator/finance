-- ============================================
-- МИГРАЦИЯ: Добавить колонки в transactions
-- Выполнить в Supabase → SQL Editor
-- ============================================

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'paid';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS category_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS account_id UUID;
