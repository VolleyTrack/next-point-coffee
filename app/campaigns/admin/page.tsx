import Link from "next/link";
import { headers } from "next/headers";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import {
  listAllCampaigns,
  listAthletes,
  listBooksEvents,
  listOrgSummaries,
  listOrganizations,
  listPayouts,
  listSales,
} from "@/lib/campaigns/store";
import { formatUsd } from "@/lib/campaigns/money";
import { campaignAbsoluteUrl } from "@/lib/campaigns/qr";
import { formatPeriodLabel } from "@/lib/campaigns/payouts";
import { QrPanel } from "@/components/campaigns/qr-panel";
import {
  CampaignActions,
  CreateAthleteForm,
  CreateCampaignForm,
  CreateOrgForm,
  MarkPaidButton,
  PayoutActions,
  ResetDemoButton,
  SyncBooksButton,
} from "@/components/campaigns/admin-forms";
import { Badge } from "@/components/ui/badge";
import { RoleSwitcher } from "@/components/campaigns/role-switcher";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getPortalUser();
  if (!user || user.role !== "admin") {
    const users = await portalUsersForSwitcher();
    return (
      <div className="mx-auto max-w-lg px-6 py-20">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">NPC Admin</p>
        <h1 className="mt-2 text-3xl font-black text-np-cream">Switch to the admin demo user</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Prototype access only. Choose <span className="text-np-cream">NPC Admin</span> in the role switcher.
        </p>
        <div className="mt-6">
          <RoleSwitcher users={users} currentUserId={user?.id} />
        </div>
      </div>
    );
  }

  const [orgs, athletes, campaigns, sales, payouts, summaries, events] = await Promise.all([
    listOrganizations(),
    listAthletes(),
    listAllCampaigns(),
    listSales(),
    listPayouts(),
    listOrgSummaries(),
    listBooksEvents(),
  ]);

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;

  const bags = sales.reduce((sum, s) => sum + s.quantity, 0);
  const owed = sales.reduce((sum, s) => sum + s.amountOwedCents, 0);
  const paid = payouts.filter((p) => p.status === "paid").reduce((sum, p) => sum + p.amountOwedCents, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-6 py-14">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">NPC Admin</p>
          <h1 className="mt-2 text-4xl font-black text-np-cream">Campaign operations</h1>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            Create organizations, assign athletes, publish shareable campaign links, and settle biweekly amounts owed.
          </p>
        </div>
        <ResetDemoButton />
      </div>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: "Live campaigns", value: String(campaigns.filter((c) => c.status === "live").length) },
          { label: "Bags sold", value: String(bags) },
          { label: "Owed to clubs", value: formatUsd(owed) },
          { label: "Marked paid", value: formatUsd(paid) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gold/20 bg-card p-5">
            <p className="text-xs uppercase tracking-widest-plus text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-black text-np-cream">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-gold/20 bg-card p-6">
          <h2 className="text-xl font-black text-np-cream">Create organization</h2>
          <p className="mt-1 text-sm text-muted-foreground">Club sport or nonprofit. Sets the $3 / $5 bag share.</p>
          <div className="mt-5">
            <CreateOrgForm />
          </div>
        </div>
        <div className="rounded-lg border border-gold/20 bg-card p-6">
          <h2 className="text-xl font-black text-np-cream">Create athlete</h2>
          <p className="mt-1 text-sm text-muted-foreground">Athletes belong to one organization.</p>
          <div className="mt-5">
            <CreateAthleteForm organizations={orgs} />
          </div>
        </div>
        <div className="rounded-lg border border-gold/20 bg-card p-6">
          <h2 className="text-xl font-black text-np-cream">Create campaign</h2>
          <p className="mt-1 text-sm text-muted-foreground">Assign one athlete. Publish to go live.</p>
          <div className="mt-5">
            <CreateCampaignForm organizations={orgs} athletes={athletes} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Organizations</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-gold/20">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Bags</th>
                <th className="px-4 py-3">Owed</th>
                <th className="px-4 py-3">Open</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((row) => (
                <tr key={row.organization.id} className="border-t border-gold/10">
                  <td className="px-4 py-3 text-np-cream">{row.organization.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.organization.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.bagsSold}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatUsd(row.amountOwedCents)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatUsd(row.amountOpenCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Campaigns</h2>
        <div className="mt-4 space-y-4">
          {campaigns.map((campaign) => {
            const url = campaignAbsoluteUrl(campaign.slug, origin);
            return (
              <div key={campaign.id} className="rounded-lg border border-gold/20 bg-card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-np-cream">{campaign.name}</h3>
                      <Badge variant="outline" className="border-gold/50 text-gold">
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {campaign.athlete.name} · {campaign.organization.name} · {campaign.bagsSold}/{campaign.goalBags}{" "}
                      bags · {formatUsd(campaign.amountOwedCents)} owed
                    </p>
                    {campaign.status === "live" && (
                      <Link href={`/campaigns/${campaign.slug}`} className="mt-2 inline-block text-sm text-gold hover:underline">
                        {url}
                      </Link>
                    )}
                  </div>
                  <CampaignActions campaign={campaign} />
                </div>
                {campaign.status === "live" && (
                  <div className="mt-5">
                    <QrPanel url={url} title="Live link + QR" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Sales ledger</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every bag: campaign, athlete, amount, and how much NPC owes the club.
        </p>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gold/20">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Athlete</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Bags</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Owed</th>
                <th className="px-4 py-3">Books</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const campaign = campaigns.find((c) => c.id === sale.campaignId);
                return (
                  <tr key={sale.id} className="border-t border-gold/10">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(sale.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-np-cream">{campaign?.athlete.name ?? sale.athleteId}</td>
                    <td className="px-4 py-3 text-muted-foreground">{campaign?.organization.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {sale.quantity} × {sale.productName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatUsd(sale.amountCents)}</td>
                    <td className="px-4 py-3 text-gold">{formatUsd(sale.amountOwedCents)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sale.booksSyncStatus}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Biweekly payouts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          14-day windows from 2026-01-05. Compute assigns unassigned sales in the current window to each club.
        </p>
        <div className="mt-4">
          <PayoutActions />
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-gold/20">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Club</th>
                <th className="px-4 py-3">Owed</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout) => {
                const org = orgs.find((o) => o.id === payout.organizationId);
                return (
                  <tr key={payout.id} className="border-t border-gold/10">
                    <td className="px-4 py-3 text-np-cream">
                      {formatPeriodLabel(payout.startDate, payout.endDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{org?.name}</td>
                    <td className="px-4 py-3 text-gold">{formatUsd(payout.amountOwedCents)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{payout.status}</td>
                    <td className="px-4 py-3">
                      {payout.status === "open" && <MarkPaidButton payoutId={payout.id} />}
                    </td>
                  </tr>
                );
              })}
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    No payout periods yet. Compute the current window after sales land.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-black text-np-cream">Books sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ledger is durable in this app. Export JSON for the books site, or POST events to{" "}
          <code className="text-gold">BOOKS_WEBHOOK_URL</code> when set. See{" "}
          <Link href="/api/books/export" className="text-gold hover:underline">
            /api/books/export
          </Link>
          .
        </p>
        <div className="mt-4">
          <SyncBooksButton />
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {events.slice(0, 8).map((event) => (
            <li key={event.id}>
              <span className="text-np-cream">{event.type}</span> · {event.syncStatus} ·{" "}
              {new Date(event.occurredAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
