-- ============================================
-- МИГРАЦИЯ: ЗАРПЛАТА — новые поля
-- ============================================

ALTER TABLE salary ADD COLUMN IF NOT EXISTS employee_id UUID;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS base_salary DECIMAL(12,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS commission_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS commission_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS bonus_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS bonus_comment TEXT DEFAULT '';
ALTER TABLE salary ADD COLUMN IF NOT EXISTS deduct_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS deduct_comment TEXT DEFAULT '';
ALTER TABLE salary ADD COLUMN IF NOT EXISTS days_worked INT DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS sales_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS period_from DATE;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS period_to DATE;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE salary ALTER COLUMN period_start DROP NOT NULL;
ALTER TABLE salary ALTER COLUMN period_end DROP NOT NULL;
ALTER TABLE salary DROP CONSTRAINT IF EXISTS salary_status_check;
ALTER TABLE salary ADD CONSTRAINT salary_status_check CHECK (status IN ('pending','accrued','paid','cancelled'));
ALTER TABLE salary ADD COLUMN IF NOT EXISTS pay_type TEXT DEFAULT 'salary';
ALTER TABLE salary ADD COLUMN IF NOT EXISTS bonus_items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE salary ADD COLUMN IF NOT EXISTS deduct_items JSONB DEFAULT '[]'::jsonb;
