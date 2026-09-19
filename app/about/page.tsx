import { site } from "@/lib/site";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Our Story</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">Own the Next.</h1>

      <div className="mt-8 space-y-6 text-lg leading-relaxed text-muted-foreground">
        <p>{site.mission}</p>
        <p>
          Next Point Coffee Co. is a Florida company founded by {site.founder}. It exists for people who do not live in
          the last play \u2014 athletes, coaches, and everyday competitors who treat the next point like it is the only one
          that counts.
        </p>
        <p>
          You can&apos;t change the last point. The only point that matters is the next one. That idea is on the bag,
          in the roast names, and in how we raise money for teams.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="rounded-lg border border-gold/20 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">The roast</p>
          <h2 className="mt-2 text-xl font-black text-np-cream">First Serve &amp; Second Wind</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            First Serve is the medium that starts the day \u2014 brown sugar, toasted almond, light citrus. Second Wind is
            the dark roast for the comeback. Half Caff comes after that.
          </p>
        </div>
        <div className="rounded-lg border border-gold/20 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">How it&apos;s made</p>
          <h2 className="mt-2 text-xl font-black text-np-cream">Roasted with a partner</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Bags are roasted and packed in partnership with {site.roasterPartner}. 12 oz, 100% Arabica, whole bean.
          </p>
        </div>
        <div className="rounded-lg border border-gold/20 p-6">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">The other scoreboard</p>
          <h2 className="mt-2 text-xl font-black text-np-cream">Fuel the season</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Clubs earn ${site.clubEarningsPerBag} a bag. Nonprofits earn ${site.nonprofitEarningsPerBag}. You share a
            link. We handle the rest. Purchases are not automatically tax-deductible.
          </p>
        </div>
      </div>

      <p className="mt-12 text-sm text-muted-foreground">
        Shop is not live yet. Join the list and we will email you when First Serve and Second Wind go on sale.
      </p>
    </div>
  );
}
