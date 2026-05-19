-- ============================================================
-- Миграция: перенос stock-данных из localStorage в Supabase
-- Запусти через SQL Editor в дашборде Supabase
-- ============================================================

-- 1. Категории товаров и услуг
create table if not exists stock_categories (
  id bigint primary key,
  user_id uuid references auth.users(id),
  name text not null,
  type text not null default 'product' check (type in ('product', 'service')),
  created_at timestamptz default now()
);

alter table stock_categories enable row level security;

create policy "Users can manage own stock categories"
  on stock_categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Товары / Каталог позиций
create table if not exists products (
  id bigint primary key,
  user_id uuid references auth.users(id),
  name text not null,
  cat text,
  price numeric(12,2) default 0,
  unit text,
  sku text,
  barcode text,
  type text default 'product' check (type in ('product', 'service')),
  weight numeric(10,3) default 0,
  weight_unit text default 'кг',
  description text,
  hidden boolean default false,
  created_at timestamptz default now()
);

alter table products enable row level security;

create policy "Users can manage own products"
  on products for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. Поставщики
create table if not exists suppliers (
  id bigint primary key,
  user_id uuid references auth.users(id),
  name text not null,
  contact text,
  phone text,
  inn text,
  address text,
  comment text,
  created_at timestamptz default now()
);

alter table suppliers enable row level security;

create policy "Users can manage own suppliers"
  on suppliers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. Поставки
create table if not exists supplies (
  id bigint primary key,
  user_id uuid references auth.users(id),
  supplier_id bigint references suppliers(id),
  invoice text,
  status text default 'ordered' check (status in ('ordered', 'partial', 'received')),
  pay_status text default 'unpaid' check (pay_status in ('unpaid', 'partial', 'paid')),
  date date default current_date,
  items jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table supplies enable row level security;

create policy "Users can manage own supplies"
  on supplies for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. Списание товаров
create table if not exists writeoffs (
  id bigint primary key,
  user_id uuid references auth.users(id),
  product_id bigint references products(id),
  quantity numeric(12,3) not null,
  reason text,
  date date default current_date,
  created_at timestamptz default now()
);

alter table writeoffs enable row level security;

create policy "Users can manage own writeoffs"
  on writeoffs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. Инвентаризации
create table if not exists inventory (
  id bigint primary key,
  user_id uuid references auth.users(id),
  number text,
  status text default 'draft' check (status in ('draft', 'completed')),
  items jsonb default '[]'::jsonb,
  result jsonb default '[]'::jsonb,
  date date default current_date,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table inventory enable row level security;

create policy "Users can manage own inventory"
  on inventory for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. Начальные остатки
create table if not exists initial_stocks (
  id bigint primary key,
  user_id uuid references auth.users(id) unique,
  items jsonb default '{}'::jsonb,
  costs jsonb default '{}'::jsonb,
  done boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table initial_stocks enable row level security;

create policy "Users can manage own initial stocks"
  on initial_stocks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Индексы
create index if not exists idx_products_user on products(user_id);
create index if not exists idx_stock_categories_user on stock_categories(user_id);
create index if not exists idx_suppliers_user on suppliers(user_id);
create index if not exists idx_supplies_user on supplies(user_id);
create index if not exists idx_writeoffs_user on writeoffs(user_id);
create index if not exists idx_inventory_user on inventory(user_id);
