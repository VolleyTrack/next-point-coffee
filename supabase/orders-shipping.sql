-- Shipping / tracking for public.orders (additive, safe to re-run).
--
-- Set by POST /api/admin/orders/ship (called from the books app "Mark shipped"
-- action). fulfillment_status already exists (default 'unfulfilled') and moves
-- to 'shipped'. shipped_email_sent_at makes the customer email idempotent:
-- it is only sent again when the caller passes resend=true.

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists shipped_at timestamptz,
  add column if not exists shipped_email_sent_at timestamptz;

comment on column public.orders.carrier is 'Shipping carrier: usps, ups, or fedex.';
comment on column public.orders.tracking_number is 'Carrier tracking number entered when the order was marked shipped.';
comment on column public.orders.shipped_at is 'When the order was first marked shipped.';
comment on column public.orders.shipped_email_sent_at is
  'When the shipped email was last sent. Null until the first successful send. Not re-sent unless resend is requested.';
