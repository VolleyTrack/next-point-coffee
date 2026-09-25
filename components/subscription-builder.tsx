"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle, Loader2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBotTrap } from "@/components/bot-trap";
import { grindOptions, storeLive } from "@/lib/site";
import {
  MAX_BAGS_PER_DELIVERY,
  MIN_BAGS_PER_DELIVERY,
  calculateSubscriptionPrice,
  clampBags,
  coffeeChoices,
  defaultSelection,
  formatUsd,
  frequencyOptions,
  selectionSummary,
  subscriptionContext,
  type SubscriptionSelection,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";

const coffeeAccent: Record<string, string> = {
  "first-serve": "bg-gold",
  "second-wind": "bg-[hsl(var(--np-green))]",
  alternate: "bg-gradient-to-r from-[hsl(var(--np-gold))] to-[hsl(var(--np-green))]",
};

function OptionGroup({ legend, step, children }: { legend: string; step: number; children: ReactNode }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-3 flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-np-cream">
        <span className="flex h-6 w-6 items-center justify-center rounded-full border border-gold/60 text-xs text-gold">
          {step}
        </span>
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

function Choice({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-lg border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-gold bg-gold/10 text-np-cream"
          : "border-gold/20 text-muted-foreground hover:border-gold/50 hover:text-np-cream",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SubscriptionBuilder({ shipLine }: { shipLine: string }) {
  const [selection, setSelection] = useState<SubscriptionSelection>(defaultSelection);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const trap = useBotTrap();

  const price = calculateSubscriptionPrice(selection.bags);

  function update<K extends keyof SubscriptionSelection>(key: K, value: SubscriptionSelection[K]) {
    setSelection((prev) => ({ ...prev, [key]: value }));
  }

  async function joinWaitlist(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context: subscriptionContext(selection), ...trap.payload() }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setAlreadySubscribed(Boolean(data.alreadySubscribed));
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  async function startSubscription() {
    setStatus("loading");
    setCheckoutError(null);
    try {
      const res = await fetch("/api/subscribe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selection),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || typeof data.url !== "string") {
        throw new Error(typeof data.error === "string" ? data.error : "Could not start checkout. Please try again.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Could not start checkout. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-10 rounded-xl border border-gold/20 bg-card p-6 sm:p-8">
        <OptionGroup legend="Pick your coffee" step={1}>
          <div role="radiogroup" aria-label="Coffee" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {coffeeChoices.map((choice) => (
              <Choice
                key={choice.id}
                selected={selection.coffee === choice.id}
                onClick={() => update("coffee", choice.id)}
                className="overflow-hidden p-0"
              >
                <span className={cn("block h-1.5 w-full", coffeeAccent[choice.id])} />
                <span className="block px-4 py-3">
                  <span className="block text-base font-black text-np-cream">{choice.label}</span>
                  <span className="mt-1 block text-xs">{choice.detail}</span>
                </span>
              </Choice>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup legend="Whole bean or ground" step={2}>
          <div role="radiogroup" aria-label="Grind" className="grid grid-cols-2 gap-3">
            {[...grindOptions].reverse().map((option) => (
              <Choice
                key={option.id}
                selected={selection.grind === option.id}
                onClick={() => update("grind", option.id)}
                className="font-semibold"
              >
                {option.label}
              </Choice>
            ))}
          </div>
        </OptionGroup>

        <OptionGroup legend="Bags per delivery (12 oz)" step={3}>
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Fewer bags"
              disabled={selection.bags <= MIN_BAGS_PER_DELIVERY}
              onClick={() => update("bags", clampBags(selection.bags - 1))}
              className="border-gold/40 bg-transparent text-np-cream"
            >
              <Minus />
            </Button>
            <span className="w-10 text-center text-3xl font-black text-np-cream" aria-live="polite">
              {selection.bags}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="More bags"
              disabled={selection.bags >= MAX_BAGS_PER_DELIVERY}
              onClick={() => update("bags", clampBags(selection.bags + 1))}
              className="border-gold/40 bg-transparent text-np-cream"
            >
              <Plus />
            </Button>
            <span className="text-sm text-muted-foreground">
              {selection.bags === 1 ? "bag" : "bags"} · up to {MAX_BAGS_PER_DELIVERY}
            </span>
          </div>
        </OptionGroup>

        <OptionGroup legend="How often" step={4}>
          <div role="radiogroup" aria-label="Frequency" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {frequencyOptions.map((option) => (
              <Choice
                key={option.id}
                selected={selection.frequency === option.id}
                onClick={() => update("frequency", option.id)}
                className="font-semibold"
              >
                {option.label}
                {option.id === "4wk" ? (
                  <span className="mt-1 block text-xs font-normal text-gold">Closest to monthly</span>
                ) : null}
              </Choice>
            ))}
          </div>
        </OptionGroup>
      </div>

      <aside className="h-fit rounded-xl border border-gold/40 bg-np-black p-6 sm:p-8 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Your lineup</p>
        <p className="mt-3 text-lg font-bold text-np-cream">{selectionSummary(selection)}</p>
        {selection.coffee === "alternate" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Deliveries switch between First Serve and Second Wind.
          </p>
        ) : null}

        <p className="mt-3 text-sm font-semibold text-gold">{shipLine}</p>

        <dl className="mt-6 space-y-3 border-t border-gold/20 pt-6 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <dt>Retail per bag</dt>
            <dd className="line-through">{formatUsd(price.retailPerBagCents)}</dd>
          </div>
          <div className="flex justify-between text-np-cream">
            <dt>Subscriber per bag</dt>
            <dd className="font-semibold">{formatUsd(price.subscriberPerBagCents)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Shipping</dt>
            <dd>Included</dd>
          </div>
          <div className="flex items-end justify-between border-t border-gold/20 pt-4">
            <dt className="font-semibold uppercase tracking-wide text-np-cream">Per delivery</dt>
            <dd className="text-3xl font-black text-np-cream">{formatUsd(price.subscriberPerDeliveryCents)}</dd>
          </div>
          <div className="flex justify-between font-semibold text-gold">
            <dt>You save {price.discountPercent}%</dt>
            <dd>{formatUsd(price.savingsPerDeliveryCents)} every delivery</dd>
          </div>
        </dl>

        <div className="mt-8">
          {storeLive ? (
            <>
              <Button
                type="button"
                onClick={startSubscription}
                disabled={status === "loading"}
                className="h-12 w-full bg-gold text-base font-bold text-np-black hover:bg-gold/90"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Start my subscription"}
              </Button>
              {checkoutError ? <p className="mt-3 text-sm text-red-400">{checkoutError}</p> : null}
              <p className="mt-3 text-xs text-muted-foreground">
                Secure checkout by Stripe. Billed today, then on your schedule.
              </p>
            </>
          ) : status === "success" ? (
            <div className="flex items-start gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {alreadySubscribed
                ? "You're already on our list. We'll email you when subscriptions open."
                : "You're on the subscription waitlist. We'll email you when subscriptions open."}
            </div>
          ) : (
            <form onSubmit={joinWaitlist} className="space-y-3">
              {trap.field}
              <label htmlFor="subscribe-email" className="text-sm text-muted-foreground">
                Subscriptions open with the shop on launch day. Save your lineup and we&apos;ll email you first.
              </label>
              <Input
                id="subscribe-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="border-gold/30 bg-np-black text-np-cream placeholder:text-muted-foreground"
              />
              <Button
                type="submit"
                disabled={status === "loading"}
                className="h-12 w-full bg-gold text-base font-bold text-np-black hover:bg-gold/90"
              >
                {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Join the subscription waitlist"}
              </Button>
              {status === "error" ? (
                <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
              ) : null}
              <p className="text-xs text-muted-foreground">No payment today. Nothing is charged.</p>
            </form>
          )}
        </div>
      </aside>
    </div>
  );
}
