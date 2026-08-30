-- Фикс таблицы plans на проде (30.08.2026)
-- Таблица была создана старым скриптом (fix-more-tables.sql) без колонок month/quarter,
-- из-за чего сохранение планов всегда падало с ошибкой "column month does not exist".
ALTER TABLE plans ADD COLUMN IF NOT EXISTS month INT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS quarter INT;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS plans_user_period_idx ON plans(user_id, period, year);

-- Уникальность: один план на тип за период
CREATE UNIQUE INDEX IF NOT EXISTS plans_unique_target ON plans(user_id, period, year, COALESCE(month, 0), COALESCE(quarter, 0), target_type);
