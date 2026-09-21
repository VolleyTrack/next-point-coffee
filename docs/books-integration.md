# Books integration — nextpoint-books

**Target repo:** [VolleyTrack/nextpoint-books](https://github.com/VolleyTrack/nextpoint-books) (private).

This environment could not read that repo (GitHub 404 with the available token). The campaign ledger here is still the system of record. nextpoint-books should consume the contract below rather than scrape UI.

Canonical TypeScript types live in `lib/campaigns/books-contract.ts`.

## Handshake

| Direction | Endpoint | Notes |
| --- | --- | --- |
| Discover | `GET /api/books/contract` | Source name, version, upsert keys |
| Pull | `GET /api/books/export` | Full snapshot: orgs, athletes, campaigns, sales, payouts, outbox |
| Push | `BOOKS_WEBHOOK_URL` | This app POSTs one `BooksEventEnvelope` per pending event |
| Retry | `POST /api/books/sync` | NPC admin; marks `stubbed` when no webhook is set |

Optional shared secret: `BOOKS_API_KEY`. If set, pull requires `Authorization: Bearer <key>` (or `x-books-key`). Push sends the same bearer plus `X-NPC-Source` and `X-NPC-Contract-Version`.

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

## What is stubbed here

- No webhook URL → events stay `stubbed` in this app (prototype default).
- No books UI.
- nextpoint-books receiver is not in this repo. Point `BOOKS_WEBHOOK_URL` at something like `https://<books-host>/api/integrations/npc-campaigns/events` when that route exists.

## Local schema

`supabase/campaigns.sql` is the optional production table set for *this* app. Books should keep its own journals and only store foreign keys to these ids.
