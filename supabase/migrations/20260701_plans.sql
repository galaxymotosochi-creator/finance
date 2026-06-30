-- Таблица планов/целей
CREATE TABLE IF NOT EXISTS plans (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL DEFAULT 'month', -- month, quarter, year
  year INT NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  month INT, -- NULL для года и квартала
  quarter INT, -- 1-4, NULL для месяца и года
  target_type TEXT NOT NULL, -- revenue, profit, expense, sales_qty, new_clients, avg_check, procurement, marketing, payroll, unexpected
  target_amount NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS plans_user_period_idx ON plans(user_id, period, year);

-- Уникальность: один план на тип за период
CREATE UNIQUE INDEX IF NOT EXISTS plans_unique_target ON plans(user_id, period, year, COALESCE(month, 0), COALESCE(quarter, 0), target_type);
