-- Supabase security hardening:
-- 1) Enable RLS + force RLS on public tables used by the app
-- 2) Only allow authenticated users to SELECT/INSERT/UPDATE/DELETE (as needed)
-- 3) Revoke anon privileges to prevent "publicly accessible" tables

-- ads_metrics
alter table public.ads_metrics enable row level security;
alter table public.ads_metrics force row level security;
revoke all on public.ads_metrics from anon;

drop policy if exists auth_ads_metrics_select on public.ads_metrics;
create policy auth_ads_metrics_select
on public.ads_metrics
for select
to authenticated
using (true);

drop policy if exists auth_ads_metrics_insert on public.ads_metrics;
create policy auth_ads_metrics_insert
on public.ads_metrics
for insert
to authenticated
with check (true);

drop policy if exists auth_ads_metrics_update on public.ads_metrics;
create policy auth_ads_metrics_update
on public.ads_metrics
for update
to authenticated
using (true)
with check (true);

-- server_paid_data
alter table public.server_paid_data enable row level security;
alter table public.server_paid_data force row level security;
revoke all on public.server_paid_data from anon;

drop policy if exists auth_server_paid_data_select on public.server_paid_data;
create policy auth_server_paid_data_select
on public.server_paid_data
for select
to authenticated
using (true);

drop policy if exists auth_server_paid_data_insert on public.server_paid_data;
create policy auth_server_paid_data_insert
on public.server_paid_data
for insert
to authenticated
with check (true);

drop policy if exists auth_server_paid_data_update on public.server_paid_data;
create policy auth_server_paid_data_update
on public.server_paid_data
for update
to authenticated
using (true)
with check (true);

-- daily_notes
alter table public.daily_notes enable row level security;
alter table public.daily_notes force row level security;
revoke all on public.daily_notes from anon;

drop policy if exists auth_daily_notes_select on public.daily_notes;
create policy auth_daily_notes_select
on public.daily_notes
for select
to authenticated
using (true);

drop policy if exists auth_daily_notes_insert on public.daily_notes;
create policy auth_daily_notes_insert
on public.daily_notes
for insert
to authenticated
with check (true);

-- campaign_notes
alter table public.campaign_notes enable row level security;
alter table public.campaign_notes force row level security;
revoke all on public.campaign_notes from anon;

drop policy if exists auth_campaign_notes_select on public.campaign_notes;
create policy auth_campaign_notes_select
on public.campaign_notes
for select
to authenticated
using (true);

drop policy if exists auth_campaign_notes_insert on public.campaign_notes;
create policy auth_campaign_notes_insert
on public.campaign_notes
for insert
to authenticated
with check (true);

drop policy if exists auth_campaign_notes_update on public.campaign_notes;
create policy auth_campaign_notes_update
on public.campaign_notes
for update
to authenticated
using (true)
with check (true);

drop policy if exists auth_campaign_notes_delete on public.campaign_notes;
create policy auth_campaign_notes_delete
on public.campaign_notes
for delete
to authenticated
using (true);

-- product_daily_notes
alter table public.product_daily_notes enable row level security;
alter table public.product_daily_notes force row level security;
revoke all on public.product_daily_notes from anon;

drop policy if exists auth_product_daily_notes_select on public.product_daily_notes;
create policy auth_product_daily_notes_select
on public.product_daily_notes
for select
to authenticated
using (true);

drop policy if exists auth_product_daily_notes_insert on public.product_daily_notes;
create policy auth_product_daily_notes_insert
on public.product_daily_notes
for insert
to authenticated
with check (true);

drop policy if exists auth_product_daily_notes_update on public.product_daily_notes;
create policy auth_product_daily_notes_update
on public.product_daily_notes
for update
to authenticated
using (true)
with check (true);

drop policy if exists auth_product_daily_notes_delete on public.product_daily_notes;
create policy auth_product_daily_notes_delete
on public.product_daily_notes
for delete
to authenticated
using (true);

