-- Создаём недостающие таблицы
CREATE TABLE IF NOT EXISTS salary (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  employee_id BIGINT,
  employee_name TEXT DEFAULT '',
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  type TEXT DEFAULT 'salary',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  period_from TIMESTAMPTZ,
  period_to TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_from NUMERIC DEFAULT 0,
  paid_to NUMERIC DEFAULT 0,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheet_entries (
  id SERIAL PRIMARY KEY,
  user_id UUID,
  employee_id BIGINT,
  date DATE,
  hours NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'present',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loyalties (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  name TEXT DEFAULT '',
  discount NUMERIC DEFAULT 0,
  color TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS timesheets (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  employee_id BIGINT,
  employee_name TEXT DEFAULT '',
  date DATE,
  hours NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_categories (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  name TEXT DEFAULT '',
  type TEXT DEFAULT 'product',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON ALL TABLES IN SCHEMA public TO atlaspos;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO atlaspos;
