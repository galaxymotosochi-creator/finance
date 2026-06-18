// API: Создание таблиц чеков (однократный вызов)
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SQL = `
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receipt_number INT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','unpaid','partially_paid')),
  client_id UUID,
  client_name TEXT DEFAULT '',
  shift_id UUID,
  cashier_name TEXT DEFAULT '',
  source TEXT DEFAULT 'register' CHECK (source IN ('register','quick_sale')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES receipts(id) ON DELETE CASCADE,
  product_id UUID,
  product_name TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_receipts_user_id ON receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_date ON receipts(date);
CREATE INDEX IF NOT EXISTS idx_receipts_shift_id ON receipts(shift_id);
CREATE INDEX IF NOT EXISTS idx_receipts_status ON receipts(status);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipts' AND policyname = 'Users can manage their own receipts') THEN
    CREATE POLICY "Users can manage their own receipts" ON receipts FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'receipt_items' AND policyname = 'Users can manage their own receipt items') THEN
    CREATE POLICY "Users can manage their own receipt items" ON receipt_items FOR ALL USING (
      receipt_id IN (SELECT id FROM receipts WHERE user_id = auth.uid())
    );
  END IF;
END $$;
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      error: 'Supabase credentials not configured. Set SUPABASE_SERVICE_ROLE_KEY in Vercel env.',
      sql: SQL,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Выполняем SQL через REST API
    const { data, error } = await supabase.rpc('exec_sql', { query: SQL });

    if (error) {
      // exec_sql может не существовать — попробуем прямой SQL запрос
      const { error: sqlError } = await supabase
        .from('_migrations')
        .select('*', { count: 'exact', head: true });

      if (sqlError && sqlError.message?.includes('relation') || sqlError?.code === '42P01') {
        // Таблицы ещё не существуют — это нормально, RPC не поможет
        return res.status(200).json({
          message: 'SQL готов к выполнению. Вставьте его вручную в Supabase SQL Editor:',
          sql: SQL,
        });
      }
      return res.status(500).json({ error: error.message, sql: SQL });
    }

    return res.status(200).json({ message: 'Таблицы созданы успешно', data });
  } catch (err) {
    return res.status(500).json({ error: err.message, sql: SQL });
  }
}
