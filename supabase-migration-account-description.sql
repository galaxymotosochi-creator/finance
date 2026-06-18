-- ============================================
-- МИГРАЦИЯ: Описание для счетов
-- Выполнить в Supabase → SQL Editor
-- ============================================
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
