import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const SQL = `
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS promo_id bigint;
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2) DEFAULT 0;
ALTER TABLE receipt_items ADD COLUMN IF NOT EXISTS discount_amount numeric(12,2) DEFAULT 0;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS discount_sum numeric(12,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_receipt_items_promo ON receipt_items(promo_id);
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(200).json({
      message: 'Выполните этот SQL в Supabase SQL Editor:',
      sql: SQL,
    });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data, error } = await supabase.rpc('exec_sql', { query: SQL });
    if (error) {
      return res.status(200).json({ message: 'Выполните SQL вручную:', sql: SQL, error: error.message });
    }
    return res.status(200).json({ message: 'Миграция выполнена успешно!' });
  } catch (err) {
    return res.status(200).json({ message: 'Выполните SQL вручную:', sql: SQL, error: err.message });
  }
}
