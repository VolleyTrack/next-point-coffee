# Books integration — nextpoint-books

**Target repo:** [VolleyTrack/nextpoint-books](https://github.com/VolleyTrack/nextpoint-books) (private).

This environment could not read that repo (GitHub 404 with the available token). Paid Stripe orders are pushed with the ingest contract below. The campaign ledger in this app remains the system of record for fundraising sales and payouts. nextpoint-books should consume these contracts rather than scrape UI.

## Paid order ingest (CPA sales)

Every paid Stripe Checkout — retail shop or campaign fundraiser — is saved on `public.orders` and then POSTed to books. The Stripe webhook returns success even when books is down. The order row keeps `books_sync_status` and `books_last_error`.

| Env | Purpose |
| --- | --- |
| `BOOKS_INGEST_URL` | Full POST URL. Example: `https://nextpoint-books.vercel.app/admin/books/api/ingest` |
| `BOOKS_INGEST_SECRET` | Bearer token. Sent as `Authorization: Bearer …` |
| `BOOKS_ORDER_INGEST` | `true` requires ingest. `false` skips it and logs `books.ingest.skipped`. Unset is required only when `VERCEL_ENV=production`. |

Missing URL or secret while ingest is required does **not** drop the order quietly. The row is `books_sync_status=failed`, stderr gets a JSON line with `event` `books.ingest.unconfigured` or `books.ingest.failed` (including `email_subject` and `email_text`), and the existing Gmail alert path emails `NOTIFY_EMAIL` (or `GMAIL_USER`, which production sets to ryan@nextpointcoffee.com).

`BOOKS_WEBHOOK_URL` is a different stream (campaign ledger events, including payouts and simulated sales). Do not point both receivers at the same sales journal unless books upserts on `stripe_session_id`.

### Request

```
POST $BOOKS_INGEST_URL
Authorization: Bearer $BOOKS_INGEST_SECRET
Content-Type: application/json
Idempotency-Key: <stripe_session_id>
X-NPC-Source: next-point-coffee
X-NPC-Contract: paid-order
X-NPC-Contract-Version: 1
```

```json
{
  "source": "next-point-coffee",
  "contract": "paid-order",
  "contract_version": 1,
  "channel": "campaign",
  "campaign_id": "cmp_123",
  "campaign_name": "Maya Season Fund",
  "order_date": "2026-09-23T15:04:05.000Z",
  "gross_amount_cents": 4650,
  "currency": "usd",
  "stripe_session_id": "cs_test_123",
  "order_id": "8f1c2b3a-0000-4000-8000-000000000001",
  "campaign_share_owed": 600
}
```

| Field | Meaning |
| --- | --- |
| `channel` | `retail` or `campaign` |
| `campaign_id` / `campaign_name` | Present for campaign checkouts. Null for retail. |
| `order_date` | ISO-8601 from the Stripe Checkout session `created` time |
| `gross_amount_cents` | Stripe `amount_total` (bag total; campaign shipping is included when Stripe charged it separately) |
| `currency` | Lowercase Stripe currency, usually `usd` |
| `stripe_session_id` | Idempotency key. Replays must not create a second sale. |
| `order_id` | `public.orders.id` |
| `campaign_share_owed` | Cents owed to the org (`bag share × quantity`). Null for retail and when the bag share could not be resolved. `0` means the split applies and the share is zero. Shipping is not included. |

Success is any HTTP 2xx. HTTP 409 means the session was already stored and is also success. This app retries network failures, HTTP 408, 429, and 5xx three times (250ms, then 1s) and then marks the order `failed`.

Retail Checkout sets metadata `channel=retail`. Campaign Checkout sets `channel=campaign` plus `campaignId` and `campaignName`. A session with `campaignId` is always `campaign`.

### How to test

```bash
npm test
```

`lib/books/order-ingest.test.ts` covers retail vs campaign tagging, the JSON body, idempotent retries (same `Idempotency-Key`, HTTP 409 counts as synced), loud failure when the URL is unset, and the rule that a books outage does not throw.

Against a running books receiver:

1. Set `BOOKS_ORDER_INGEST=true`, `BOOKS_INGEST_URL`, and `BOOKS_INGEST_SECRET`.
2. Forward Stripe: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
3. Pay a shop checkout and a campaign checkout.
4. Confirm one POST per session. Replay the webhook. Books should upsert, not insert a second sale.
5. Unset `BOOKS_INGEST_URL`, pay again, and confirm the order row is `books_sync_status=failed` with a `books.ingest.unconfigured` log line. The webhook response is still `{ "received": true }`.
6. On `/admin/orders`, failed rows show the books error. **Retry books sync** posts them again after the env is fixed.

Schema for existing databases: `supabase/orders-books-ingest.sql`.

## Public URL (this site proxies books)

After nextpoint-books is deployed with `basePath: "/admin/books"`, Next.js rewrites on this marketing site send `/admin/books` (and `/admin/books/:path*`) to `BOOKS_ORIGIN` (default `https://nextpoint-books.vercel.app`). Login is [https://nextpointcoffee.com/admin/books/login](https://nextpointcoffee.com/admin/books/login) using the books project's `ADMIN_PASSWORD`. `/admin/newsletter` is not rewritten.

Canonical TypeScript types live in `lib/campaigns/books-contract.ts`.

## Handshake

| Direction | Endpoint | Notes |
| --- | --- | --- |
| Discover | `GET /api/books/contract` | Source name, version, upsert keys |
| Pull | `GET /api/books/export` | Full snapshot: orgs, athletes, campaigns, sales, payouts, outbox |
| Push | `BOOKS_WEBHOOK_URL` | This app POSTs one `BooksEventEnvelope` per pending event |
| Retry | `POST /api/books/sync` | Next Point Coffee admin; marks `stubbed` when no webhook is set |

`GET /api/books/export` is **not athlete-readable**. Allowed callers: valid `BOOKS_API_KEY` (`Authorization: Bearer` or `x-books-key`), or a Next Point Coffee admin portal session. Push sends the same bearer plus `X-NPC-Source` and `X-NPC-Contract-Version` when a key is set.

## Event envelope (push)

```json
{
  "source": "next-point-coffee",
  "contractVersion": 1,
  "event": "sale.recorded",
  "id": "evt-sale-id",
  "occurredAt": "2026-09-21T12:00:00.000Z",
  "data": {
    "saleId": "…",
    "campaignId": "…",
    "campaignSlug": "maya-season-fund",
    "athleteId": "…",
    "athleteName": "Maya Chen",
    "organizationId": "…",
    "organizationName": "Riverside Volleyball Club",
    "organizationType": "club",
    "bagShareCents": 300,
    "quantity": 2,
    "amountCents": 4000,
    "shippingCents": 0,
    "amountOwedCents": 600,
    "currency": "usd",
    "payoutPeriodId": null,
    "payoutPeriodStart": null,
    "payoutPeriodEnd": null,
    "payoutStatus": "unassigned",
    "source": "simulated"
  }
}
```

Other events: `payout.computed`, `payout.paid` (data is a payout record + `saleIds`).

Upsert by `saleId` / `payoutId` / event `id`. Replays are expected.

## Suggested books mapping

Until nextpoint-books models are visible, assume a normal AP / journal layout:

| Coffee field | Books use |
| --- | --- |
| `organizations[]` | Vendor / payee. `bagShareCents` is the contracted per-bag liability. Type is label only. |
| `athletes[]` / `campaigns[]` | Tracking class / dimension on every line |
| `sales[].amountCents` | Debit cash (or Stripe clearing), credit campaign revenue |
| `sales[].amountOwedCents` | Credit AP to the organization |
| `payouts[]` (`open`) | Bill / settlement batch for a 14-day window |
| `payout.paid` | Bill payment / AP clear |

Do not recompute `amountOwedCents` from type. Use the posted cents; bag share can change per org.

## Athlete sales privacy

Athletes never see a sales list (no admin / “your name” rows, no other athletes). The athlete dashboard shows only assigned campaigns and bag progress. Club users see their org ledger (club share, not gross). Next Point Coffee admin sees everything, including gross.

## What is stubbed here

- No webhook URL → events stay `stubbed` in this app (prototype default).
- No books UI.
- nextpoint-books receiver is not in this repo. Point `BOOKS_WEBHOOK_URL` at something like `https://<books-host>/api/integrations/npc-campaigns/events` when that route exists.

## Local schema

`supabase/campaigns.sql` is the production ledger for this app: one `campaign_store` row (`id = ledger`) holding orgs, campaigns, sales, and portal users. Books should keep its own journals and only store foreign keys to ids inside that document. It should not read the row directly; password hashes are in it, and only the service role can.
