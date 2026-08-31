-- Корзина: все удаления идут сюда с полной копией записи, восстановление до 30 дней
CREATE TABLE IF NOT EXISTS trash (
  id BIGINT PRIMARY KEY,
  user_id TEXT,
  table_name TEXT,
  record_id TEXT,
  data JSONB,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
GRANT ALL ON ALL TABLES IN SCHEMA public TO atlaspos;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO atlaspos;
