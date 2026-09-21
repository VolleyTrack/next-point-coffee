import Link from "next/link";
import { headers } from "next/headers";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { listCampaignsForAthlete } from "@/lib/campaigns/store";
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
        <p className="mt-3 text-sm text-muted-foreground">Maya Chen has a live campaign with seed progress.</p>
        <div className="mt-6">
          <RoleSwitcher users={users} currentUserId={user?.id} />
        </div>
      </div>
    );
  }

  const mine = await listCampaignsForAthlete(user.athleteId);

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;

  const bags = mine.reduce((sum, c) => sum + c.bagsSold, 0);
  const owed = mine.reduce((sum, c) => sum + c.amountOwedCents, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-6 py-14">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Athlete dashboard</p>
        <h1 className="mt-2 text-4xl font-black text-np-cream">{user.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your assigned campaigns only. Individual sales stay on the club and Next Point Coffee admin dashboards.
        </p>
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

      {mine.length === 0 && (
        <p className="text-sm text-muted-foreground">No campaigns assigned to you yet. Next Point Coffee will publish your page when it is ready.</p>
      )}

      {mine.map((campaign) => {
        const pct = Math.min(100, Math.round((campaign.bagsSold / campaign.goalBags) * 100));
        const url = campaignAbsoluteUrl(campaign.slug, origin);
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
                Draft campaigns go live when Next Point Coffee publishes them. You will get a share link and QR at that point.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
