import Link from "next/link";
import { WaitlistForm } from "@/components/waitlist-form";
import { Button } from "@/components/ui/button";
import { site, howItWorks, products } from "@/lib/site";
import { DollarSign, Award, Users, Heart } from "lucide-react";

const whyPoints = [
  { icon: Award, title: "Premium Quality", body: "First Serve and Second Wind - coffee supporters will actually drink." },
  {
    icon: DollarSign,
    title: "Clear Earnings",
    body: "NPC sets a bag share with each organization. Type (club or nonprofit) does not lock the amount.",
  },
  { icon: Users, title: "Easy Fundraising", body: "Share a link. We handle checkout, roasting, packing, and shipping." },
  { icon: Heart, title: "Funds the Season", body: "Earnings paid within 30 days after the campaign closes." },
];

export default function FundraisingPage() {
  return (
    <div>
      <section className="border-b border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Team Fundraising</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-black leading-tight text-np-cream sm:text-5xl">
            {site.fundraiserHook}
          </h1>
          <p className="mt-4 max-w-xl text-muted-foreground">{site.fundraiserBlurb}</p>

          <div className="mt-8 max-w-xl rounded-lg border border-gold/40 bg-np-black px-6 py-5">
            <span className="text-xs uppercase tracking-widest-plus text-muted-foreground">Bag share</span>
            <p className="text-2xl font-black text-gold">Set per organization</p>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              Club or nonprofit — amount is not fixed by type
            </span>
          </div>
          <p className="mt-4 max-w-xl text-xs text-muted-foreground">
            Bags expected to retail {site.bagPriceRange} at launch. No guaranteed total. A coffee purchase is not
            automatically a tax-deductible gift.
          </p>
          <Button asChild className="mt-6 bg-gold text-np-black hover:bg-gold/90">
            <Link href="/campaigns">Request to start a campaign</Link>
          </Button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-black text-np-cream">Why Clubs Choose Next Point</h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyPoints.map((point) => (
            <div key={point.title} className="rounded-lg border border-gold/20 p-6">
              <point.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 font-bold text-np-cream">{point.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="text-2xl font-black text-np-cream">How It Works</h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map((step) => (
              <div key={step.step} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold text-lg font-black text-np-black">
                  {step.step}
                </div>
                <h3 className="mt-4 font-bold uppercase tracking-wide text-np-cream">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="text-2xl font-black text-np-cream">The coffees they will sell</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.slug} className="rounded-lg border border-gold/20 p-5">
              <h3 className="font-bold text-np-cream">
                {p.name} <span className="text-muted-foreground">- {p.roast}</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tastingNotes}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-gold/30 bg-card p-8">
            <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Clubs & teams</p>
            <h2 className="mt-2 text-2xl font-black text-np-cream">Club fundraiser</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Athletic clubs, booster clubs, schools, and travel teams. Drop your email and we will send the club agreement when we open campaigns.
            </p>
            <div className="mt-6">
              <WaitlistForm ctaLabel="Start a club fundraiser" context="fundraising-club" />
            </div>
          </div>
          <div className="rounded-lg border border-gold/30 bg-card p-8">
            <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Nonprofits</p>
            <h2 className="mt-2 text-2xl font-black text-np-cream">Nonprofit fundraiser</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Qualifying nonprofits work with NPC on a bag share. We will send the nonprofit agreement. Only claim tax
              deductibility if you have confirmed it is appropriate.
            </p>
            <div className="mt-6">
              <WaitlistForm ctaLabel="Start a nonprofit fundraiser" context="fundraising-nonprofit" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
