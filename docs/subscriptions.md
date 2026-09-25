# Coffee subscriptions (/subscribe)

## Switch
Same flag as the shop: `NEXT_PUBLIC_STORE_LIVE`.
- `false`/unset: the full page and picker show; the button is "Join the subscription waitlist" and saves the email to `/api/waitlist` with context `subscribe-<coffee>-<grind>-<bags>bag-<frequency>` (honeypot + 2 s minimum apply).
- `true`: "Start my subscription" calls `POST /api/subscribe/checkout`, which creates a Stripe Checkout Session in `mode: "subscription"`.

## Pricing
`SUBSCRIBER_DISCOUNT_PERCENT` in `lib/subscription.ts` (default 10, Ryan to confirm) off the $21.50 retail bag price (shipping included). 10% = $19.35/bag.

## Checkout
Inline `price_data` (no Stripe products/prices to create): name like `First Serve Subscription — Whole bean`, `unit_amount` = subscriber per-bag cents, `recurring { interval: "week", interval_count: 2 | 4 | 6 }`, `quantity` = bags (1-4). US shipping address collection. Promotion codes off. Metadata on the session (per delivery) and on `subscription_data.metadata` (plan): `order_type=subscription`, `sub_coffee`, `sub_grind`, `sub_bags`, `sub_frequency`, plus the retail keys (`productSlug`, `grind`, `form`, `quantity`, `items`).

Alternate: deliveries flip First Serve / Second Wind. The coffee for a renewal comes from the billing cycle number (invoice period start vs `billing_cycle_anchor`), so webhook retries are stable.

First delivery is billed at checkout and ships on the pre-order date (`PREORDER_SHIP_DATE`, default Oct 8, 2026).

## Orders and books
- First payment: `checkout.session.completed` (existing handler) saves `public.orders` keyed by the session id, ingests to books, sends the confirmation email.
- Renewals: `invoice.paid` with `billing_reason = subscription_cycle` creates a new retail order keyed by the invoice id (`in_...` in `stripe_session_id`) and ingests it to books (Idempotency-Key = invoice id). No confirmation email on renewals.

## Ryan: Stripe Dashboard checklist
1. Webhook endpoint (`/api/webhooks/stripe`): add the `invoice.paid` event (keep `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`).
2. Settings > Billing > Customer portal: turn on cancel, pause, update payment method (and quantity/plan changes only if wanted), then activate the Login link. Put that URL in Vercel as `NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL` to show "Manage subscription" on /subscribe. Without it the page says to email ryan@ to skip, pause, or cancel.
3. Settings > Billing > Subscriptions and emails: turn on customer emails for successful payments/receipts and failed payments; set Smart Retries for failed renewals.
4. Confirm the subscriber discount (`SUBSCRIBER_DISCOUNT_PERCENT`).
