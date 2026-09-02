-- ============================================
-- МИГРАЦИЯ: ВОЗВРАТЫ ПО ЧЕКАМ (refund_*)
-- Выполнить в БД AtlasPos (VPS):
--   ALTER TABLE receipts ADD COLUMN IF NOT EXISTS ...
-- (уже выполнено 02.09.2026 на проде — файл для истории/чистых развёртываний)
-- ============================================

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS refund_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_date DATE,
  ADD COLUMN IF NOT EXISTS refund_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS refund_points NUMERIC(12,2) NOT NULL DEFAULT 0;
