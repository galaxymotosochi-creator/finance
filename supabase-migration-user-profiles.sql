-- Таблица профилей пользователей (ФИО владельца аккаунта)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  last_name TEXT DEFAULT '',
  first_name TEXT DEFAULT '',
  patronymic TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own profile"
  ON user_profiles FOR ALL USING (auth.uid() = user_id);
