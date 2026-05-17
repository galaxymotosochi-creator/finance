-- ============================================
-- МИГРАЦИЯ: КЛИЕНТЫ + ПРОГРАММЫ ЛОЯЛЬНОСТИ
-- Выполнить в Supabase → SQL Editor
-- ============================================

-- 1. КЛИЕНТЫ
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  birthday DATE,
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ПРОГРАММЫ ЛОЯЛЬНОСТИ (кастомные, созданные пользователем)
CREATE TABLE loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'constant' CHECK (type IN ('constant','accumulative','bonus','birthday')),
  discount NUMERIC(5,2) DEFAULT 0,
  condition NUMERIC(12,2) DEFAULT 0,
  icon TEXT DEFAULT '🎯',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#1983dd',
  bg TEXT DEFAULT '#eaf5ff',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- БЕЗОПАСНОСТЬ (Row Level Security)
-- ============================================
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own clients"
  ON clients FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own loyalty programs"
  ON loyalty_programs FOR ALL USING (auth.uid() = user_id);
