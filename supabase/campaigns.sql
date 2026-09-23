-- Campaign ledger for production.
--
-- The app used to save this document to a local JSON file. On Vercel that file
-- lived under /tmp, so a create on one serverless instance was invisible to the
-- next instance: login failed and the admin list looked empty.
--
-- One row (id = ledger) holds organizations, athletes, campaigns, sales,
-- payouts, campaign requests, books events, and portal users. Password hashes
-- and mustChangePassword live on users inside the document. A single update
-- commits a new club, athlete, campaign, and both logins together.
--
-- Apply in the same Supabase project as orders and newsletter_signups.
-- The Next.js server uses SUPABASE_SERVICE_KEY. anon and authenticated have
-- no grants and no policies, so the Data API cannot read password hashes.

create table if not exists public.campaign_store (
  id text primary key,
  version bigint not null,
  state jsonb not null,
  updated_at timestamptz not null default now(),
  constraint campaign_store_singleton check (id = 'ledger'),
  constraint campaign_store_version_positive check (version > 0)
);

comment on table public.campaign_store is
  'Single-row campaign ledger. state.users includes bcrypt password hashes. Service role only.';

alter table public.campaign_store enable row level security;

revoke all on table public.campaign_store from anon, authenticated;
grant select, insert, update, delete on table public.campaign_store to service_role;
