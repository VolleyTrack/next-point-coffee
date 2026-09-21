import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getCampaignBySlug } from "@/lib/campaigns/store";
import { formatUsd, initials } from "@/lib/campaigns/money";
import { campaignAbsoluteUrl } from "@/lib/campaigns/qr";
import { products, storeLive } from "@/lib/site";
import { PurchaseForm } from "@/components/campaigns/purchase-form";
import { QrPanel } from "@/components/campaigns/qr-panel";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const campaign = await getCampaignBySlug(slug);
  if (!campaign || campaign.status === "draft") notFound();

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  const origin = host ? `${proto}://${host}` : undefined;
  const shareUrl = campaignAbsoluteUrl(campaign.slug, origin);
  const purchasable = products.filter((p) => p.purchasable);
  const perBag = formatUsd(campaign.organization.bagShareCents);
  const pct = Math.min(100, Math.round((campaign.bagsSold / campaign.goalBags) * 100));
  const simulated = !storeLive || !process.env.STRIPE_SECRET_KEY;

  return (
    <div>
      <section className="border-b border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline" className="border-gold/50 text-gold">
              {campaign.status === "live" ? "Live" : "Closed"}
            </Badge>
            <p className="text-xs font-semibold uppercase tracking-widest-plus text-muted-foreground">
              {campaign.organization.name} · {campaign.organization.type}
            </p>
          </div>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gold text-lg font-black text-np-black">
              {initials(campaign.athlete.name)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest-plus text-gold">Supporting</p>
              <h1 className="text-4xl font-black text-np-cream sm:text-5xl">{campaign.athlete.name}</h1>
              <p className="mt-1 text-lg text-muted-foreground">{campaign.name}</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-muted-foreground">{campaign.story}</p>
          <div className="mt-8 max-w-xl">
            <div className="mb-2 flex justify-between text-sm text-muted-foreground">
              <span>
                {campaign.bagsSold} / {campaign.goalBags} bags
              </span>
              <span>
                {formatUsd(campaign.amountOwedCents)} earned for {campaign.organization.name}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-np-black">
              <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{perBag} of every bag goes to the organization.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-14 lg:grid-cols-2">
        {campaign.status === "live" ? (
          <PurchaseForm
            campaignSlug={campaign.slug}
            athleteName={campaign.athlete.name}
            products={purchasable}
            simulated={simulated}
          />
        ) : (
          <div className="rounded-lg border border-gold/20 bg-card p-6 text-muted-foreground">
            This campaign is closed. Thanks to everyone who bought a bag.
          </div>
        )}
        <QrPanel url={shareUrl} title="Link + QR" />
      </section>
    </div>
  );
}
