-- Optional production schema for the campaigns ledger.
-- The prototype uses a local JSON store (lib/campaigns/store.ts).
-- Apply this in the same Supabase project as orders / newsletter_signups
-- when you are ready to persist campaigns remotely.

create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('club', 'nonprofit')),
  slug text not null unique,
  contact_email text not null,
  created_at timestamptz not null default now()
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete restrict,
  name text not null,
  slug text not null unique,
  story text not null,
  goal_bags integer not null default 20,
  status text not null check (status in ('draft', 'live', 'closed')),
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists campaign_sales (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete restrict,
  organization_id uuid not null references organizations(id) on delete restrict,
  athlete_id uuid not null references athletes(id) on delete restrict,
  product_slug text not null,
  product_name text not null,
  quantity integer not null,
  amount_cents integer not null,
  shipping_cents integer not null default 0,
  amount_owed_cents integer not null,
  currency text not null default 'usd',
  buyer_name text not null,
  buyer_email text not null,
  source text not null check (source in ('simulated', 'stripe')),
  stripe_session_id text unique,
  payout_period_id uuid,
  books_sync_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists payout_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete restrict,
  start_date timestamptz not null,
  end_date timestamptz not null,
  status text not null check (status in ('open', 'paid')),
  amount_owed_cents integer not null,
  sale_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create table if not exists books_events (
  id text primary key,
  type text not null,
  version integer not null default 1,
  occurred_at timestamptz not null,
  payload jsonb not null,
  sync_status text not null default 'pending',
  last_error text
);

create index if not exists campaign_sales_campaign_idx on campaign_sales (campaign_id);
create index if not exists campaign_sales_athlete_idx on campaign_sales (athlete_id);
create index if not exists campaign_sales_org_idx on campaign_sales (organization_id);
create index if not exists payout_periods_org_idx on payout_periods (organization_id);
