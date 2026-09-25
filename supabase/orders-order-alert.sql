-- Internal new-order alert idempotency.
--
-- The Stripe webhook emails ORDER_ALERT_EMAIL (default info@nextpointcoffee.com)
-- once per paid order and then sets this timestamp. Webhook redeliveries skip
-- the send while it is set. Safe to re-run.
--
-- Until this is applied the webhook still sends once: it only alerts on the
-- delivery that moved the order to paid (the row was missing or unpaid before).
--
-- Apply in the Supabase project used by SUPABASE_URL / SUPABASE_SERVICE_KEY.

alter table public.orders
  add column if not exists order_alert_sent_at timestamptz;

comment on column public.orders.order_alert_sent_at is
  'When the internal new-order alert email was sent. Null until the first successful send. Webhook retries skip when this is set.';
