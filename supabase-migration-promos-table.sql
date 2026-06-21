-- Создаём таблицу promos, если её нет
CREATE TABLE IF NOT EXISTS promos (
  id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  discount NUMERIC(5,2) DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  conditions JSONB DEFAULT '{"type":"all"}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Добавляем колонку conditions, если таблица уже есть
ALTER TABLE promos ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '{"type":"all"}'::jsonb;
