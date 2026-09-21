# next-point-coffee

Next Point Coffee Co. — marketing site + team fundraising campaigns portal.

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No env vars are required for the campaigns prototype.

## Campaigns prototype

Public routes live under `/campaigns`.

| Route | Who | What |
| --- | --- | --- |
| `/campaigns` | Public | Live campaign directory |
| `/campaigns/[slug]` | Buyers | Athlete page, purchase, share link + QR |
| `/campaigns/portal` | Demo | Role switcher (labeled prototype — not real auth) |
| `/campaigns/admin` | NPC Admin | Orgs, athletes, publish, ledger, biweekly payouts, books sync |
| `/campaigns/club` | Club | All athlete campaigns for that org, owed / paid |
| `/campaigns/athlete` | Athlete | Only their campaign(s), progress, sales |
| `/api/books/export` | Books | Full sales + payout ledger JSON |

### Demo users (role switcher)

The existing site only has an `ADMIN_ACCESS_KEY` gate for orders/newsletter — no login system. Campaigns use a cookie-based **prototype role switcher**:

- **NPC Admin** — `admin@nextpointcoffee.com`
- **Coach Rivera** — Riverside Volleyball Club
- **Alex Kim** — Athens Youth Foundation
- **Maya Chen** / **Jordan Hale** / **Sam Ortiz** — athletes

Seed data includes two live campaigns (`/campaigns/maya-season-fund`, `/campaigns/sam-court-time`) and one draft (Jordan).

### Happy path

1. Admin: create org (type + **Bag share ($ per bag)**) → create athlete → create campaign → **Publish**.
2. Buyer: open the link, buy a bag (simulated checkout writes the ledger; no Stripe required).
3. Club dashboard shows every athlete under that org. Athlete dashboard shows **only** that athlete’s assigned campaigns and progress — no sales list (no admin / “your name” rows).
4. Admin: **Compute current biweekly payouts**, then **Mark paid**.

### Stubbed vs real

| Real | Stubbed |
| --- | --- |
| Campaign CRUD, publish, QR, public pages | End-user auth (demo role switcher) |
| Durable sales ledger (local JSON, `data/campaigns-store.json`) | Stripe checkout unless `NEXT_PUBLIC_STORE_LIVE=true` and `STRIPE_SECRET_KEY` are set |
| Per-org bag share (set on create) | Books UI — events export + optional webhook only |
| Biweekly payout compute / mark paid | Remote Supabase tables (SQL is in `supabase/campaigns.sql`) |

Existing Stripe + Supabase REST for shop orders/newsletter is unchanged. Campaign Stripe checkouts attach metadata; the webhook writes the campaign ledger when those fields are present.

Optional env vars are listed in `.env.example`. The accounting app is [VolleyTrack/nextpoint-books](https://github.com/VolleyTrack/nextpoint-books) (private; not readable from this environment). This repo exposes `GET /api/books/contract`, `GET /api/books/export`, and optional `BOOKS_WEBHOOK_URL` + `BOOKS_API_KEY` push. Types are in `lib/campaigns/books-contract.ts`. See `docs/books-integration.md`.
