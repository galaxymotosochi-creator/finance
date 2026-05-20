-- Добавляем недостающие колонки в таблицу supplies
alter table if exists supplies
  add column if not exists supplier_name text,
  add column if not exists total numeric default 0,
  add column if not exists paid numeric default 0,
  add column if not exists payments jsonb default '[]'::jsonb;

-- Расширяем check для status
alter table if exists supplies
  drop constraint if exists supplies_status_check;

alter table if exists supplies
  add constraint supplies_status_check
  check (status in ('ordered', 'transit', 'received'));
