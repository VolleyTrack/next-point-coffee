# next-point-coffee

Next Point Coffee Co. — marketing site + team fundraising campaigns portal.

## Local run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No env vars are required for the campaigns prototype in local dev if you set a preview key (see below).

## Campaigns launch gate

| Env | Purpose |
| --- | --- |
| `NEXT_PUBLIC_CAMPAIGNS_LIVE` | Public launch. Must be `true` for strangers to use campaigns. Unset/false = off (production default). |
| `ADMIN_ACCESS_KEY` | Existing newsletter/orders key. Also unlocks campaigns **preview** while live is false. |
| `CAMPAIGNS_PREVIEW_KEY` | Optional; if set, used instead of `ADMIN_ACCESS_KEY` for the campaigns unlock only. |

Mirror of shop: `NEXT_PUBLIC_STORE_LIVE` gates checkout; `NEXT_PUBLIC_CAMPAIGNS_LIVE` gates the public campaigns portal.

### Production (Vercel project `next-point-coffee`)

Set both of these on **Production** (and Preview if you want the same behavior):

```
NEXT_PUBLIC_CAMPAIGNS_LIVE=false
ADMIN_ACCESS_KEY=<same key Ryan already uses for /admin/newsletter>
```

Redeploy after changing `NEXT_PUBLIC_*` vars.

When Ryan is ready to launch publicly:

```
NEXT_PUBLIC_CAMPAIGNS_LIVE=true
```

That removes the preview gate and restores nav/footer "Start a campaign" links.

### Ryan-only preview (while live is false)

1. Open [https://nextpointcoffee.com/campaigns](https://nextpointcoffee.com/campaigns) — public visitors see a coming-soon page (no role switcher, no portal).
2. Click **Team preview access** at the bottom.
3. Enter `ADMIN_ACCESS_KEY` (or `CAMPAIGNS_PREVIEW_KEY` if configured).
4. An httpOnly cookie unlocks the full prototype in that browser for 14 days. Use **Lock preview** in the top banner to clear it.

Nav and footer do **not** promote campaigns until `NEXT_PUBLIC_CAMPAIGNS_LIVE=true`. Fundraising CTAs point at the waitlist instead.

## Campaigns prototype

Routes live under `/campaigns` (gated as above).

| Route | Who | What |
| --- | --- | --- |
| `/campaigns` | Public when live; coming soon + unlock when not | Request-to-start form (not an open campaign catalog) |
| `/campaigns/[slug]` | Buyers (when live or preview unlocked) | Published campaign page, purchase, share link + QR |
| `/campaigns/portal` | Demo | Role switcher (labeled prototype — not real auth) |
| `/campaigns/admin` | Next Point Coffee Admin | One create flow, incoming requests, publish, ledger, payouts |
| `/campaigns/club` | Club | All athlete campaigns for that org, owed / paid |
| `/campaigns/athlete` | Athlete | Only their campaign(s), progress + share/QR — no sales list |
| `/api/books/export` | Books | Full sales + payout ledger JSON |

### Demo users (role switcher)

The existing site only has an `ADMIN_ACCESS_KEY` gate for orders/newsletter — no login system. Campaigns use a cookie-based **prototype role switcher** (only after launch or preview unlock):

- **Next Point Coffee Admin** — `admin@nextpointcoffee.com`
- **Coach Rivera** — Riverside Volleyball Club
- **Alex Kim** — Athens Youth Foundation
- **Maya Chen** / **Jordan Hale** / **Sam Ortiz** — athletes

Seed data includes two live campaigns (`/campaigns/maya-season-fund`, `/campaigns/sam-court-time`) and one draft (Jordan).

### Happy path

1. Admin: one create card (org + athlete + campaign, bag share set on the org) → **Publish**.
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

## Next Point Coffee Books (hosted under this domain)

Books is a separate Vercel project. Do not merge its source here. After the books app is deployed with `basePath: "/admin/books"`, this site proxies that prefix:

| Path | Destination |
| --- | --- |
| `/admin/books` | `${BOOKS_ORIGIN}/admin/books` |
| `/admin/books/:path*` | `${BOOKS_ORIGIN}/admin/books/:path*` (includes `/_next` assets) |

- **Login:** [https://nextpointcoffee.com/admin/books/login](https://nextpointcoffee.com/admin/books/login)
- **Password:** the books Vercel project's `ADMIN_PASSWORD` (not this site's `ADMIN_ACCESS_KEY`)
- **Origin:** `BOOKS_ORIGIN`, default `https://nextpoint-books.vercel.app`. Rebuild after changing it.

`/admin/newsletter` and `/admin/orders` stay on this app. The rewrite only matches `/admin/books`.
