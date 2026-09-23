-- Paid-order columns for books ingest.
--
-- public.orders already exists (Stripe checkout rows). This adds the channel
-- and the books sync state the webhook writes. Safe to re-run.
--
-- Apply in the same Supabase project as newsletter_signups and campaign_store.
-- The Next.js server uses SUPABASE_SERVICE_KEY.

alter table public.orders
  add column if not exists channel text not null default 'retail',
  add column if not exists campaign_id text,
  add column if not exists campaign_name text,
  add column if not exists campaign_share_owed integer,
  add column if not exists books_sync_status text not null default 'pending',
  add column if not exists books_last_error text,
  add column if not exists books_synced_at timestamptz;

alter table public.orders drop constraint if exists orders_channel_check;
alter table public.orders
  add constraint orders_channel_check check (channel in ('retail', 'campaign'));

alter table public.orders drop constraint if exists orders_books_sync_status_check;
alter table public.orders
  add constraint orders_books_sync_status_check
  check (books_sync_status in ('pending', 'synced', 'failed', 'skipped'));

alter table public.orders drop constraint if exists orders_campaign_share_owed_nonnegative;
alter table public.orders
  add constraint orders_campaign_share_owed_nonnegative
  check (campaign_share_owed is null or campaign_share_owed >= 0);

comment on column public.orders.channel is
  'retail shop checkout or campaign fundraiser checkout.';
comment on column public.orders.campaign_id is
  'public.campaign_store campaign id when channel is campaign.';
comment on column public.orders.campaign_name is
  'Campaign name captured at payment time for books.';
comment on column public.orders.campaign_share_owed is
  'Cents owed to the campaign organization. Null when the split does not apply.';
comment on column public.orders.books_sync_status is
  'Paid-order books ingest: pending, synced, failed, or skipped.';
comment on column public.orders.books_last_error is
  'Last books ingest error. Null after a successful sync.';
