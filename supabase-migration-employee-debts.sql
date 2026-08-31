-- Долги сотрудников (недостачи по инвентаризации и др.)
-- status: pending (висит) / deducted (удержано из зарплаты) / written_off (прощено, ушло в расходы)
CREATE TABLE IF NOT EXISTS employee_debts (
  id BIGINT PRIMARY KEY,
  user_id TEXT,
  employee_id BIGINT,
  employee_name TEXT DEFAULT '',
  inventory_id BIGINT,
  amount NUMERIC DEFAULT 0,
  valuation TEXT DEFAULT 'cost',
  status TEXT DEFAULT 'pending',
  comment TEXT DEFAULT '',
  date TIMESTAMPTZ,
  deducted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON ALL TABLES IN SCHEMA public TO atlaspos;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO atlaspos;
