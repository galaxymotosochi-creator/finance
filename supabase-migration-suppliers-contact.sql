-- Добавляем колонку contact_method в таблицу suppliers
alter table if exists suppliers
  add column if not exists contact_method text default 'telegram';
