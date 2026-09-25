import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, CalendarClock, Coffee, Flame, PauseCircle, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoastDots } from "@/components/roast-dots";
import { SubscriptionBuilder } from "@/components/subscription-builder";
import { site } from "@/lib/site";
import {
  SUBSCRIBER_DISCOUNT_PERCENT,
  calculateSubscriptionPrice,
  formatUsd,
  subscriptionProducts,
  subscriptionsLive,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Coffee Subscription | Next Point Coffee Co.",
  description:
    "First Serve and Second Wind on your schedule. Whole bean or ground, every 2, 4, or 6 weeks. Shipping included. Skip, pause, or cancel anytime.",
};

const steps = [
  {
    title: "Pick your coffee",
    body: "First Serve, Second Wind, or trade off between both. Whole bean or ground.",
  },
  {
    title: "Set your pace",
    body: "One to four 12 oz bags, every 2, 4, or 6 weeks. You call the rhythm.",
  },
  {
    title: "Own every morning",
    body: "Fresh-roasted bags land at your door on schedule. No reordering, no empty bag on game day.",
  },
];

const perks = [
  {
    icon: Flame,
    title: "Roasted fresh",
    body: "Fresh-roasted in small batches, then packed and shipped straight to your door.",
  },
  {
    icon: PauseCircle,
    title: "Skip, pause, or cancel anytime",
    body: "Traveling for a tournament? Skip a delivery. Need a break? Pause. No contracts.",
  },
  {
    icon: Truck,
    title: "Shipping included",
    body: "Every price you see already covers shipping in the United States.",
  },
  {
    icon: Coffee,
    title: `Save ${SUBSCRIBER_DISCOUNT_PERCENT}% every delivery`,
    body: "Subscribers pay less per bag than one-time orders, every single time.",
  },
];

const faqs = [
  {
    q: "When do subscriptions start?",
    a: subscriptionsLive
      ? "Your first delivery ships on our next roast day after you subscribe."
      : "Subscriptions open shortly after our launch. Join the waitlist with your lineup and we'll email you the moment you can start.",
  },
  {
    q: "What does \"Alternate both\" mean?",
    a: "Your deliveries trade off: First Serve on one, Second Wind on the next, and so on. Same bag count each time.",
  },
  {
    q: "Can I change my coffee, grind, or bag count later?",
    a: "Yes. Switch coffees, change grind, or go up or down between one and four bags before your next delivery.",
  },
  {
    q: "How do skipping, pausing, and canceling work?",
    a: "You can skip a delivery, pause, or cancel anytime before your next billing date. Once a delivery is roasted and packed, it ships.",
  },
  {
    q: "Is shipping really included?",
    a: "Yes. Our bag price includes standard shipping within the United States, and subscribers still get the discount on top.",
  },
  {
    q: "Which grind should I pick?",
    a: "Whole bean stays fresh longest if you have a grinder. Ground is ready for drip and pour-over right out of the bag.",
  },
  {
    q: "Can I use a promo code on a subscription?",
    a: "The subscriber discount is already built in, so other promo codes don't stack with subscriptions.",
  },
];

export default function SubscribePage() {
  const onePrice = calculateSubscriptionPrice(1);

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-gold/20 bg-np-black">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-6 py-14 sm:py-20 md:grid-cols-2">
          <div>
            <p className="mb-4 text-xs font-semibold uppercase tracking-widest-plus text-gold">
              Coffee subscription{subscriptionsLive ? "" : " · Waitlist open"}
            </p>
            <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-np-cream sm:text-5xl md:text-6xl md:leading-[1.05]">
              Never start a day empty.
              <span className="block text-gold">Own the next bag.</span>
            </h1>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">
              First Serve and Second Wind on your schedule. Fresh-roasted 12 oz bags, whole bean or ground,
              delivered every 2, 4, or 6 weeks. {site.tagline}
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
              <Button asChild className="h-12 bg-gold px-6 text-base font-bold text-np-black hover:bg-gold/90">
                <a href="#build">
                  Build your subscription <ArrowDown className="h-4 w-4" />
                </a>
              </Button>
              <p className="text-sm text-muted-foreground">
                From <span className="font-semibold text-np-cream">{formatUsd(onePrice.subscriberPerBagCents)}</span>{" "}
                a bag, shipping included
              </p>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-sm">
            <div className="overflow-hidden rounded-lg border border-gold/30 shadow-2xl shadow-black/50">
              <Image
                src="/labels/first-serve-label-front.svg"
                alt="Next Point Coffee Co. First Serve medium roast label"
                width={234}
                height={252}
                className="h-auto w-full object-contain"
                unoptimized
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">How it works</p>
          <h2 className="mt-2 text-3xl font-black text-np-cream sm:text-4xl">Three steps to match point.</h2>
          <ol className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="rounded-lg border border-gold/20 bg-np-black p-6">
                <span className="text-4xl font-black text-gold">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 text-xl font-black text-np-cream">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Lineup */}
      <section className="mx-auto max-w-6xl px-6 pt-16">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {subscriptionProducts.map((product) => (
            <div key={product.slug} className="overflow-hidden rounded-lg border border-gold/20 bg-card">
              <div
                className={cn(
                  "h-1.5 w-full",
                  product.accent === "green" ? "bg-[hsl(var(--np-green))]" : "bg-gold"
                )}
              />
              <div className="space-y-3 p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-np-cream">{product.name}</h3>
                    <p className="text-sm uppercase tracking-wide text-muted-foreground">{product.roast}</p>
                  </div>
                  <RoastDots level={product.roastLevel} />
                </div>
                <p className="text-sm font-semibold uppercase tracking-widest-plus text-gold">{product.tag}</p>
                <p className="text-sm text-muted-foreground">{product.tastingNotes}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Builder */}
      <section id="build" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Build your subscription</p>
          <h2 className="mt-2 text-3xl font-black text-np-cream sm:text-4xl">Set your game plan.</h2>
          <p className="mt-3 text-muted-foreground">
            Retail is {formatUsd(onePrice.retailPerBagCents)} a bag with shipping included. Subscribers save{" "}
            {SUBSCRIBER_DISCOUNT_PERCENT}% on every delivery.
          </p>
        </div>
        <SubscriptionBuilder />
      </section>

      {/* Perks */}
      <section className="border-y border-gold/20 bg-card">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Why subscribe</p>
          <h2 className="mt-2 text-3xl font-black text-np-cream sm:text-4xl">Built for competitors.</h2>
          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {perks.map((perk) => (
              <div key={perk.title} className="rounded-lg border border-gold/20 bg-np-black p-6">
                <perk.icon className="h-6 w-6 text-gold" />
                <h3 className="mt-4 text-lg font-black text-np-cream">{perk.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{perk.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-5 w-5 text-gold" />
          <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">FAQ</p>
        </div>
        <h2 className="mt-2 text-3xl font-black text-np-cream sm:text-4xl">Questions before first serve</h2>
        <div className="mt-8 divide-y divide-gold/20 border-y border-gold/20">
          {faqs.map((faq) => (
            <details key={faq.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-semibold text-np-cream">
                {faq.q}
                <span className="text-xl text-gold transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{faq.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-sm text-muted-foreground">
          Still have a question? Email{" "}
          <a href={`mailto:${site.contactEmail}`} className="text-gold hover:underline">
            {site.contactEmail}
          </a>
          .
        </p>
      </section>
    </div>
  );
}
