import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { WaitlistForm } from "@/components/waitlist-form";
import { ProductCard } from "@/components/product-card";
import { site, products } from "@/lib/site";
import { ArrowRight, DollarSign, Users, Heart, TrendingUp } from "lucide-react";

export default function HomePage() {
  const featured = products.find((p) => p.available)!;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-gold/20 bg-np-black">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-20 md:grid-cols-2 md:py-28">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest-plus text-gold">
              Est. {site.establishedYear} &middot; Coming Soon
            </p>
            <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-np-cream sm:text-6xl">
              {"You Can't Change the Last Point."}
              <span className="block text-gold">Own the Next.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">{site.mission}</p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <WaitlistForm ctaLabel="Get Launch Updates" context="homepage-hero" />
            </div>
            <div className="mt-6 flex items-center gap-2">
              <Link href="/shop" className="inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">
                Preview the coffee <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-lg border border-gold/30 shadow-2xl shadow-black/50">
              <Image
                src="https://g.tlcdn.com/view/0c9364a42a8e430e80c92660e13f0273.png"
                alt="Next Point Coffee Co. First Serve label"
                width={1254}
                height={1254}
                className="w-full"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* Fundraiser hook */}
      <section className="border-b border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-black leading-tight text-np-cream sm:text-4xl">
                {site.fundraiserHook}
              </h2>
              <p className="mt-4 max-w-md text-muted-foreground">{site.fundraiserBlurb}</p>
              <Button asChild className="mt-6 bg-gold text-np-black hover:bg-gold/90">
                <Link href="/fundraising">
                  Start a Fundraiser <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: DollarSign, label: "$4.00", sub: "earned per unit sold" },
                { icon: Users, label: "Any Club", sub: "teams, schools, groups" },
                { icon: TrendingUp, label: "High Profit", sub: "simple to sell" },
                { icon: Heart, label: "Real Impact", sub: "funds your season" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-lg border border-gold/20 p-5">
                  <stat.icon className="h-5 w-5 text-gold" />
                  <p className="mt-3 text-xl font-black text-np-cream">{stat.label}</p>
                  <p className="text-xs text-muted-foreground">{stat.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured product */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Available First</p>
            <h2 className="text-3xl font-black text-np-cream">Meet {featured.name}</h2>
          </div>
          <Link href="/shop" className="text-sm font-semibold text-gold hover:underline">
            See all coffees &rarr;
          </Link>
        </div>
        <div className="max-w-md">
          <ProductCard product={featured} />
        </div>
      </section>
    </div>
  );
}
