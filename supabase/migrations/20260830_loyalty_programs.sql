-- Лояльность: рабочая таблица программ (раздел писал в несуществующую loyalty_programs — всё «молча» не сохранялось)
CREATE TABLE IF NOT EXISTS loyalty_programs (
  id BIGINT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  type TEXT DEFAULT 'constant', -- constant, accumulative, bonus, birthday
  discount NUMERIC(10,2) DEFAULT 0,
  condition NUMERIC(14,2) DEFAULT 0, -- порог для накопительной (задаёт пользователь)
  icon TEXT DEFAULT '',
  description TEXT DEFAULT '',
  color TEXT DEFAULT '',
  bg TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Баллы клиентов (бонусная программа: 1 ₽ = 1 балл, 100 баллов = 100 ₽)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS points BIGINT DEFAULT 0;

-- Выборочная лояльность: 'auto' (по правилам) | 'none' (без скидки) | id программы (назначена вручную)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS loyalty_mode TEXT DEFAULT 'auto';

-- Баллы в чеке: начислено за оплату и списано как скидка (видно в разделе «Чеки»)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS points_earned BIGINT DEFAULT 0;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS points_spent BIGINT DEFAULT 0;
