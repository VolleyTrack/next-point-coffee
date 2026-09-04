import { WaitlistForm } from "@/components/waitlist-form";
import { site, howItWorks, products } from "@/lib/site";
import { DollarSign, Award, Users, Heart } from "lucide-react";

const whyPoints = [
  { icon: Award, title: "Premium Quality", body: "Expertly crafted coffee your supporters will love." },
  { icon: DollarSign, title: "High Profit", body: "Earn $4.00 for every unit your club sells." },
  { icon: Users, title: "Easy Fundraising", body: "Simple to sell. Big impact for your team." },
  { icon: Heart, title: "Supports Your Goals", body: "Every purchase helps fuel your success." },
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

          <div className="mt-8 inline-flex flex-col items-start rounded-lg border border-gold/40 bg-np-black px-6 py-5">
            <span className="text-xs uppercase tracking-widest-plus text-muted-foreground">Earn</span>
            <span className="text-4xl font-black text-gold">$4.00</span>
            <span className="text-xs uppercase tracking-wide text-muted-foreground">per unit sold</span>
          </div>
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
        <h2 className="text-2xl font-black text-np-cream">Three Great Blends</h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {products.map((p) => (
            <div key={p.slug} className="rounded-lg border border-gold/20 p-5">
              <h3 className="font-bold text-np-cream">
                {p.name} <span className="text-muted-foreground">— {p.roast}</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{p.tastingNotes}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-lg border border-gold/30 bg-card p-8 text-center">
          <h2 className="text-2xl font-black text-np-cream">Ready to get started?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Let&apos;s fuel your team and fund your future. Drop your email and we&apos;ll reach
            out with everything you need to launch a fundraiser.
          </p>
          <div className="mt-6 flex justify-center">
            <WaitlistForm ctaLabel="Start a Fundraiser" context="fundraising-page" />
          </div>
        </div>
      </section>
    </div>
  );
}
