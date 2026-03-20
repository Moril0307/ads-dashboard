-- ads_metrics: Google Ads API daily snapshots
create table if not exists public.ads_metrics (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_name text not null,
  product_line text not null check (product_line in ('ft', 'pu', 'ppt', 'other')),
  spend numeric(18,2) not null default 0,
  budget numeric(18,2) not null default 0,
  ads_conversions integer not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ads_metrics_date_campaign_key
  on public.ads_metrics (date, campaign_name);

create index if not exists ads_metrics_product_line_idx
  on public.ads_metrics (product_line);

-- server_paid_data: CSV uploaded real paid users
create table if not exists public.server_paid_data (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_name text not null,
  paid_users integer not null,
  new_jid_users integer not null,
  new_ios_jid_users integer not null default 0,
  new_android_jid_users integer not null default 0,
  inserted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists server_paid_data_date_campaign_key
  on public.server_paid_data (date, campaign_name);

-- daily_notes: multiple notes per day
create table if not exists public.daily_notes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists daily_notes_date_idx
  on public.daily_notes (date);

-- campaign_notes: one note per date + campaign
create table if not exists public.campaign_notes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists campaign_notes_date_campaign_key
  on public.campaign_notes (date, campaign_name);

-- product_daily_notes: 产品线维度按日备注（每个产品每天一条）
create table if not exists public.product_daily_notes (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  product_line text not null check (product_line in ('ft', 'pu', 'ppt')),
  content text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists product_daily_notes_date_product_key
  on public.product_daily_notes (date, product_line);

