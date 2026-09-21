import Link from "next/link";
import { headers } from "next/headers";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { listAllCampaigns, listSales } from "@/lib/campaigns/store";
import { formatUsd } from "@/lib/campaigns/money";
import { campaignAbsoluteUrl } from "@/lib/campaigns/qr";
import { QrPanel } from "@/components/campaigns/qr-panel";
import { RoleSwitcher } from "@/components/campaigns/role-switcher";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AthleteDashboardPage() {
  const user = await getPortalUser();
  if (!user || user.role !== "athlete" || !user.athleteId) {
    const users = await portalUsersForSwitcher();
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Athlete dashboard</p>
        <h1 className="mt-2 text-3xl font-black text-np-cream">Switch to an athlete demo user</h1>
        <p className="mt-3 text-sm text-muted-foreground">Maya Chen has a live campaign with seed sales.</p>
        <div className="mt-6">
          <RoleSwitcher users={users} currentUserId={user?.id} />
        </div>
      </div>
    );
  }

  const campaigns = await listAllCampaigns();
  const mine = campaigns.filter((c) => c.athleteId === user.athleteId);
  const campaignIds = new Set(mine.map((c) => c.id));
  const sales = (await listSales({ athleteId: user.athleteId })).filter((s) => campaignIds.has(s.campaignId));

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;

  const bags = sales.reduce((sum, s) => sum + s.quantity, 0);
  const owed = sales.reduce((sum, s) => sum + s.amountOwedCents, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Athlete dashboard</p>
        <h1 className="mt-2 text-4xl font-black text-np-cream">{user.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only the campaigns assigned to you, and sales on those links.</p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: "Your campaigns", value: String(mine.length) },
          { label: "Bags on your campaigns", value: String(bags) },
          { label: "Earned for your club", value: formatUsd(owed) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gold/20 bg-card p-5">
            <p className="text-xs uppercase tracking-widest-plus text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-black text-np-cream">{stat.value}</p>
          </div>
        ))}
      </section>

      {mine.map((campaign) => {
        const pct = Math.min(100, Math.round((campaign.bagsSold / campaign.goalBags) * 100));
        const url = campaignAbsoluteUrl(campaign.slug, origin);
        const campaignSales = sales.filter((s) => s.campaignId === campaign.id);
        return (
          <section key={campaign.id} className="rounded-lg border border-gold/20 bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-np-cream">{campaign.name}</h2>
                <p className="text-sm text-muted-foreground">{campaign.organization.name}</p>
              </div>
              <Badge variant="outline" className="border-gold/50 text-gold">
                {campaign.status}
              </Badge>
            </div>
            <div className="mt-5 max-w-xl">
              <div className="mb-2 flex justify-between text-sm text-muted-foreground">
                <span>
                  {campaign.bagsSold} / {campaign.goalBags} bags
                </span>
                <span>{formatUsd(campaign.amountOwedCents)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-np-black">
                <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {campaign.status === "live" ? (
              <div className="mt-6 space-y-4">
                <Link href={`/campaigns/${campaign.slug}`} className="text-sm font-semibold text-gold hover:underline">
                  Open your public page
                </Link>
                <QrPanel url={url} />
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                Draft campaigns go live when NPC publishes them. You will get a share link and QR at that point.
              </p>
            )}

            <div className="mt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gold">Sales on this campaign</h3>
              <div className="mt-3 overflow-x-auto rounded-lg border border-gold/20">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-np-black text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">When</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Bags</th>
                      <th className="px-4 py-3">Club share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaignSales.map((sale) => (
                      <tr key={sale.id} className="border-t border-gold/10">
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(sale.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-np-cream">{sale.productName}</td>
                        <td className="px-4 py-3 text-muted-foreground">{sale.quantity}</td>
                        <td className="px-4 py-3 text-gold">{formatUsd(sale.amountOwedCents)}</td>
                      </tr>
                    ))}
                    {campaignSales.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                          No sales on this campaign yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
