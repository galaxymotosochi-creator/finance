-- Связь сотрудник → табель/зарплата: id сотрудников text (uuid), а employee_id был bigint —
-- табель и зарплата для реальных сотрудников (uuid) не создавались, защита удаления не срабатывала.
ALTER TABLE timesheet_entries ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
ALTER TABLE salary ALTER COLUMN employee_id TYPE TEXT USING employee_id::text;
