import Link from "next/link";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { getOrgSummary, listCampaignsForOrganization, listPayouts, listPartnerSales } from "@/lib/campaigns/store";
import { formatUsd } from "@/lib/campaigns/money";
import { formatPeriodLabel } from "@/lib/campaigns/payouts";
import { RoleSwitcher } from "@/components/campaigns/role-switcher";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ClubDashboardPage() {
  const user = await getPortalUser();
  if (!user || user.role !== "club" || !user.organizationId) {
    const users = await portalUsersForSwitcher();
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Club dashboard</p>
        <h1 className="mt-2 text-3xl font-black text-np-cream">Switch to a club demo user</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Try Coach Rivera (Riverside) or Alex Kim (Athens Youth Foundation).
        </p>
        <div className="mt-6">
          <RoleSwitcher users={users} currentUserId={user?.id} />
        </div>
      </div>
    );
  }

  const [summary, mine, sales, payouts] = await Promise.all([
    getOrgSummary(user.organizationId),
    listCampaignsForOrganization(user.organizationId),
    listPartnerSales({ organizationId: user.organizationId }),
    listPayouts(user.organizationId),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Club dashboard</p>
        <h1 className="mt-2 text-4xl font-black text-np-cream">{summary?.organization.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signed in as {user.name}. Every athlete campaign under this organization is listed here.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Campaigns", value: String(summary?.campaignCount ?? 0) },
          { label: "Bags sold", value: String(summary?.bagsSold ?? 0) },
          { label: "Owed", value: formatUsd(summary?.amountOwedCents ?? 0) },
          { label: "Still open", value: formatUsd(summary?.amountOpenCents ?? 0) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gold/20 bg-card p-5">
            <p className="text-xs uppercase tracking-widest-plus text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-black text-np-cream">{stat.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Athlete campaigns</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {mine.map((campaign) => (
            <div key={campaign.id} className="rounded-lg border border-gold/20 bg-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-np-cream">{campaign.athlete.name}</h3>
                <Badge variant="outline" className="border-gold/50 text-gold">
                  {campaign.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{campaign.name}</p>
              <p className="mt-4 text-sm text-muted-foreground">
                {campaign.bagsSold} / {campaign.goalBags} bags · {formatUsd(campaign.amountOwedCents)} owed
              </p>
              {campaign.status === "live" && (
                <Link href={`/campaigns/${campaign.slug}`} className="mt-3 inline-block text-sm text-gold hover:underline">
                  Open public page
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Sales attributed to your athletes</h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gold/20">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Athlete</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Club share</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const campaign = mine.find((c) => c.id === sale.campaignId);
                return (
                  <tr key={sale.id} className="border-t border-gold/10">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-np-cream">{campaign?.athlete.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sale.quantity} × {sale.productName}
                    </td>
                    <td className="px-4 py-3 text-gold">{formatUsd(sale.amountOwedCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Payouts</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-gold/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => (
                <tr key={payout.id} className="border-t border-gold/10">
                  <td className="px-4 py-3 text-np-cream">
                    {formatPeriodLabel(payout.startDate, payout.endDate)}
                  </td>
                  <td className="px-4 py-3 text-gold">{formatUsd(payout.amountOwedCents)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{payout.status}</td>
                </tr>
              ))}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                    Next Point Coffee has not opened a payout period for this window yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
