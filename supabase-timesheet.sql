-- ============================================
-- ТАБЕЛЬ УЧЁТА РАБОЧЕГО ВРЕМЕНИ
-- ============================================
CREATE TABLE IF NOT EXISTS timesheet_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT DEFAULT 'present' CHECK (status IN ('present','sick','vacation','absent','remote')),
  bonus_amount DECIMAL(12,2) DEFAULT 0,
  bonus_comment TEXT DEFAULT '',
  deduct_amount DECIMAL(12,2) DEFAULT 0,
  deduct_comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(employee_id, date)
);

ALTER TABLE timesheet_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own timesheet"
  ON timesheet_entries FOR ALL USING (auth.uid() = user_id);
