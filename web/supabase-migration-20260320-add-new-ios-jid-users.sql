-- Add iOS-specific new JID count column for paid CSV alignment.
-- Run this in Supabase SQL editor (or your migration runner) before deploying the updated upload/dashboard code.

alter table public.server_paid_data
  add column if not exists new_ios_jid_users integer not null default 0;
