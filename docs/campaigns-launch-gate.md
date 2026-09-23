# Campaigns public launch (Ryan)

## Goal

Keep campaigns **off** the public site until launch, while Ryan can still open the portal for Fri testing.

## Vercel env (project: next-point-coffee)

Set on **Production** (redeploy after `NEXT_PUBLIC_*` changes):

| Name | Value | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_CAMPAIGNS_LIVE` | `false` | Public off. Flip to `true` only when Ryan approves launch. |
| `ADMIN_ACCESS_KEY` | *(existing)* | Same key as `/admin/newsletter` and `/admin/orders`. Unlocks campaigns preview. |
| `CAMPAIGNS_PREVIEW_KEY` | *(optional)* | If set, used **instead of** `ADMIN_ACCESS_KEY` for the campaigns unlock only. |

Also fine on Preview deployments so PR previews behave the same.

### How to set in Vercel UI

1. Project **next-point-coffee** → **Settings** → **Environment Variables**
2. Add `NEXT_PUBLIC_CAMPAIGNS_LIVE` = `false` (Production + Preview)
3. Confirm `ADMIN_ACCESS_KEY` is already set
4. **Redeploy** production (required for `NEXT_PUBLIC_*`)

### Launch day

Change `NEXT_PUBLIC_CAMPAIGNS_LIVE` to `true` and redeploy. Nav/footer "Start a campaign" returns; the coming-soon + password unlock go away.

## Ryan unlock (while live is false)

1. Go to `https://nextpointcoffee.com/campaigns`
2. Public sees coming soon → fundraising waitlist / contact (no role switcher)
3. Click **Team preview access** → enter `ADMIN_ACCESS_KEY`
4. Cookie unlocks campaigns in that browser (14 days). **Lock preview** clears it.
5. Partner pages (`/campaigns/portal`, `/campaigns/club`, `/campaigns/athlete`, `/campaigns/admin`) still ask for an email and password. A temporary password is sent to `/campaigns/change-password` before those pages open. Preview unlock is not a partner login. Buyer links (`/campaigns/[slug]`, checkout thanks) stay open after unlock.

Strangers without the key cannot use `/campaigns`, portal, slug pages, or campaigns APIs.
