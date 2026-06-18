-- ============================================
-- МИГРАЦИЯ: ЧЕКИ И ПОЗИЦИИ ЧЕКОВ
-- Выполнить в Supabase → SQL Editor
-- ============================================

-- 1. ЧЕКИ (заголовки)
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_number INT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','unpaid','partially_paid')),
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  client_name TEXT DEFAULT '',
  shift_id UUID REFERENCES shifts(id) ON DELETE SET NULL,
  cashier_name TEXT DEFAULT '',
  source TEXT DEFAULT 'register' CHECK (source IN ('register','quick_sale')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ПОЗИЦИИ ЧЕКОВ (товары в чеке)
CREATE TABLE receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ИНДЕКСЫ
-- ============================================
CREATE INDEX idx_receipts_user_id ON receipts(user_id);
CREATE INDEX idx_receipts_date ON receipts(date);
CREATE INDEX idx_receipts_shift_id ON receipts(shift_id);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipt_items_receipt_id ON receipt_items(receipt_id);

-- ============================================
-- БЕЗОПАСНОСТЬ (Row Level Security)
-- ============================================
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own receipts"
  ON receipts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own receipt items"
  ON receipt_items FOR ALL USING (
    receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
  );
