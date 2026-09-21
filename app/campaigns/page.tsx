import Link from "next/link";
import { listLiveCampaigns } from "@/lib/campaigns/store";
import { formatUsd, initials } from "@/lib/campaigns/money";
import { site } from "@/lib/site";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function CampaignsIndexPage() {
  const campaigns = await listLiveCampaigns();

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Live campaigns</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">Fuel a team. Own the next.</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        Open a campaign, buy a bag, and the sale is attributed to that athlete. Clubs earn ${site.clubEarningsPerBag} a
        bag. Nonprofits earn ${site.nonprofitEarningsPerBag} a bag.
      </p>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        {campaigns.map((campaign) => {
          const pct = Math.min(100, Math.round((campaign.bagsSold / campaign.goalBags) * 100));
          return (
            <Link
              key={campaign.id}
              href={`/campaigns/${campaign.slug}`}
              className="rounded-lg border border-gold/20 bg-card p-6 transition-colors hover:border-gold/50"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold text-sm font-black text-np-black">
                    {initials(campaign.athlete.name)}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-widest-plus text-muted-foreground">
                      {campaign.organization.name}
                    </p>
                    <h2 className="text-xl font-black text-np-cream">{campaign.athlete.name}</h2>
                  </div>
                </div>
                <Badge variant="outline" className="border-gold/50 text-gold">
                  Live
                </Badge>
              </div>
              <p className="mt-4 font-semibold text-np-cream">{campaign.name}</p>
              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{campaign.story}</p>
              <div className="mt-5">
                <div className="mb-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {campaign.bagsSold} / {campaign.goalBags} bags
                  </span>
                  <span>{formatUsd(campaign.amountOwedCents)} for the club</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-np-black">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          );
        })}
        {campaigns.length === 0 && (
          <p className="text-muted-foreground">No live campaigns yet. An NPC admin can publish one from the portal.</p>
        )}
      </div>
    </div>
  );
}
