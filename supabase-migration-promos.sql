-- Миграция: добавление полей для учёта скидок в чеках

-- Добавляем поле promo_id и discount в receipt_items
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS promo_id bigint;
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0;

-- Добавляем поле суммы скидки в receipts
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS discount_sum numeric(12,2) DEFAULT 0;

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_receipt_items_promo ON receipt_items(promo_id);
