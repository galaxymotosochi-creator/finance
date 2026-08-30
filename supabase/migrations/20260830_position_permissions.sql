-- Должности: колонка permissions отсутствовала — права доступа должности не сохранялись (молчаливый 500)
ALTER TABLE position_templates ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]';
