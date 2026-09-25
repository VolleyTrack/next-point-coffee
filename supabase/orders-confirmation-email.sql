-- Pre-order confirmation email idempotency.
--
-- public.orders already stores the Stripe checkout (including shipping_address).
-- This adds the timestamp the webhook sets after a successful customer email.
-- Stripe retries skip the send when the timestamp is already set.
-- Safe to re-run.
--
-- Apply in the Supabase project used by SUPABASE_URL / SUPABASE_SERVICE_KEY
-- (same project as newsletter_signups and public.orders).
--
-- No new address columns: Checkout shipping is written to the existing
-- public.orders.shipping_address jsonb/object column.

alter table public.orders
  add column if not exists confirmation_email_sent_at timestamptz;

comment on column public.orders.confirmation_email_sent_at is
  'When the pre-order confirmation email was sent. Null until the first successful send. Webhook retries skip when this is set.';
