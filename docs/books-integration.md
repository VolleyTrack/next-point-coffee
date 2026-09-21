# Books integration (campaign sales ledger)

This app owns the **durable sales ledger** for fundraiser campaigns. An external accounting (“books”) site can consume every sale without sharing UI.

## What is real today

- Every purchase writes a `Sale` row: campaign, athlete, club/nonprofit, bags, gross cents, amount NPC owes the club, payout period (once assigned), and books sync status.
- Each mutation also appends a versioned `BooksEvent`.
- `GET /api/books/export` returns the full ledger + payouts + events.
- `POST /api/books/sync` (NPC admin session) retries pending events.

## What is stubbed

- If `BOOKS_WEBHOOK_URL` is unset, events are marked `stubbed` and stay in this app. That is the prototype default.
- If `BOOKS_WEBHOOK_URL` is set, pending events POST to that URL. Failures stay `failed` and can be retried.

There is no books UI in this repo.

## Event envelope

```json
{
  "event": "sale.recorded",
  "version": 1,
  "occurredAt": "2026-09-21T12:00:00.000Z",
  "id": "evt-...",
  "data": {
    "saleId": "…",
    "campaignId": "…",
    "campaignSlug": "maya-season-fund",
    "athleteId": "…",
    "athleteName": "Maya Chen",
    "organizationId": "…",
    "organizationName": "Riverside Volleyball Club",
    "organizationType": "club",
    "quantity": 2,
    "amountCents": 4000,
    "shippingCents": 0,
    "amountOwedCents": 600,
    "currency": "usd",
    "payoutPeriodId": null,
    "payoutPeriodStart": null,
    "payoutPeriodEnd": null,
    "source": "simulated"
  }
}
```

Other event types: `payout.computed`, `payout.paid`.

## Suggested books tables

See `supabase/campaigns.sql` for a schema that can live beside the existing `orders` / `newsletter_signups` REST tables. The prototype persists to a local JSON ledger (`data/campaigns-store.json`) so it runs without Supabase credentials. Production can map these events 1:1 onto those tables.

## Pull vs push

1. **Pull (simplest):** books cron `GET /api/books/export` and upsert by `saleId` / `payoutId`.
2. **Push:** set `BOOKS_WEBHOOK_URL` on this app; books exposes a receiver that acknowledges 2xx.
