-- Add Android new JID count from paid CSV.
-- Run in Supabase SQL Editor after ios migration if needed.

alter table public.server_paid_data
  add column if not exists new_android_jid_users integer not null default 0;
