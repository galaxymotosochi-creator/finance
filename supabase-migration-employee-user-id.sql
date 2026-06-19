-- Добавляем user_id в employees для привязки к Supabase Auth
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID;
