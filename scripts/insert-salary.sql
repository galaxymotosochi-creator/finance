INSERT INTO salary (id, user_id, employee_name, amount, status, pay_type, period_start, period_end, paid_at, created_at, employee_id, days_worked, sales_total, base_salary, bonus_amount, bonus_comment, deduct_amount, deduct_comment, bonus_items, deduct_items) 
VALUES (
  'f19c102b-0ab1-4dea-abce-f166fe6a3958',
  'b45adced-ef22-47e2-8691-76a2868e0765',
  'Шиманская Юлия Валерьевна',
  7500,
  'paid',
  'salary',
  '2026-06-17',
  '2026-06-18',
  '2026-06-17',
  '2026-06-17T20:46:41.856142',
  0,
  2,
  0,
  1500,
  5000,
  '',
  500,
  '',
  '[{"date":"2026-06-18","amount":5000,"comment":"Продажа скутера"}]'::jsonb,
  '[{"date":"2026-06-18","amount":500,"comment":"Невовремя пришла"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
