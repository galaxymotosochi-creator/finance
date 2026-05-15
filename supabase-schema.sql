-- ============================================
-- СХЕМА БАЗЫ ДАННЫХ: БЛОК ФИНАНСЫ
-- Выполнить в Supabase → SQL Editor
-- ============================================

-- 1. КАТЕГОРИИ (Справочник доходов/расходов)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense','supply_expense','sale','supply','writeoff')),
  color TEXT DEFAULT '#6b7280',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. СЧЕТА (Наличные, Карта, Перевод)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash','card','transfer')),
  balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. ТРАНЗАКЦИИ
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE RESTRICT,
  type TEXT NOT NULL CHECK (type IN ('income','expense','sale','supply','writeoff')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. КАССОВЫЕ СМЕНЫ
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  opening_balance DECIMAL(12,2) DEFAULT 0,
  closing_balance DECIMAL(12,2),
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. ЗАРПЛАТА
CREATE TABLE salary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  paid_at DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- БЕЗОПАСНОСТЬ (Row Level Security)
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary ENABLE ROW LEVEL SECURITY;

-- Каждый пользователь видит ТОЛЬКО свои данные
CREATE POLICY "Users can manage their own categories"
  ON categories FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own accounts"
  ON accounts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own transactions"
  ON transactions FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own shifts"
  ON shifts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own salary"
  ON salary FOR ALL USING (auth.uid() = user_id);
