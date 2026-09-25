"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { clampRetailQuantity, grindOptions, retailMaxQuantity, type GrindId } from "@/lib/site";
import {
  DEFAULT_FREQUENCY,
  MAX_BAGS_PER_DELIVERY,
  SHOP_SUBSCRIPTION_OFFER,
  calculateSubscriptionPrice,
  clampBags,
  frequencyOptions,
  isSubscribableSlug,
  type FrequencyId,
} from "@/lib/subscription";
import { cn } from "@/lib/utils";
import { Loader2, Minus, Plus } from "lucide-react";

interface BuyButtonProps {
  slug: string;
  priceCents: number;
}

type PurchaseType = "one-time" | "subscription";

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuyButton({ slug, priceCents }: BuyButtonProps) {
  const [grind, setGrind] = useState<GrindId | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [purchase, setPurchase] = useState<PurchaseType>("one-time");
  const [frequency, setFrequency] = useState<FrequencyId>(DEFAULT_FREQUENCY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qtyId = `qty-${slug}`;
  const grindLegendId = `grind-${slug}`;
  const purchaseLegendId = `purchase-${slug}`;
  const frequencyLegendId = `frequency-${slug}`;

  const canSubscribe = isSubscribableSlug(slug);
  const subscribing = canSubscribe && purchase === "subscription";
  const maxQuantity = subscribing ? MAX_BAGS_PER_DELIVERY : retailMaxQuantity;
  const subPrice = calculateSubscriptionPrice(quantity);

  function clampFor(next: number, type: PurchaseType) {
    return type === "subscription" && canSubscribe ? clampBags(next) : clampRetailQuantity(next);
  }

  function setClamped(next: number) {
    setQuantity(clampFor(next, purchase));
  }

  function choosePurchase(type: PurchaseType) {
    setPurchase(type);
    setQuantity((current) => clampFor(current, type));
  }

  async function handleBuy() {
    if (!grind) {
      setError("Choose Ground or Whole bean.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = subscribing
        ? await fetch("/api/subscribe/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coffee: slug, grind, bags: quantity, frequency }),
          })
        : await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: [{ slug, quantity, grind }] }),
          });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  const lineTotal = subscribing ? subPrice.subscriberPerDeliveryCents : priceCents * quantity;
  const frequencyText = frequencyOptions.find((option) => option.id === frequency)?.label.toLowerCase() ?? "";

  const optionClass = (selected: boolean) =>
    cn(
      "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-gold/70",
      selected
        ? "border-gold bg-gold/15 text-np-cream"
        : "border-gold/30 bg-transparent text-muted-foreground hover:border-gold/60 hover:text-np-cream"
    );

  return (
    <div className="space-y-3">
      {canSubscribe && (
        <fieldset className="space-y-2">
          <legend id={purchaseLegendId} className="sr-only">
            One-time purchase or subscription
          </legend>
          <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-labelledby={purchaseLegendId}>
            <label className={cn(optionClass(purchase === "one-time"), "justify-between text-left")}>
              <input
                type="radio"
                name={`purchase-${slug}`}
                value="one-time"
                checked={purchase === "one-time"}
                disabled={loading}
                onChange={() => choosePurchase("one-time")}
                className="sr-only"
              />
              <span>One-time purchase</span>
              <span>{formatUsd(priceCents)}/bag</span>
            </label>
            <label className={cn(optionClass(purchase === "subscription"), "justify-between text-left")}>
              <input
                type="radio"
                name={`purchase-${slug}`}
                value="subscription"
                checked={purchase === "subscription"}
                disabled={loading}
                onChange={() => choosePurchase("subscription")}
                className="sr-only"
              />
              <span>{SHOP_SUBSCRIPTION_OFFER}</span>
              <span>{formatUsd(subPrice.subscriberPerBagCents)}/bag</span>
            </label>
          </div>
        </fieldset>
      )}
      <fieldset className="space-y-2">
        <legend id={grindLegendId} className="text-sm font-medium text-np-cream">
          Ground or whole bean
        </legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={grindLegendId}>
          {grindOptions.map((option) => {
            const selected = grind === option.id;
            return (
              <label key={option.id} className={optionClass(selected)}>
                <input
                  type="radio"
                  name={`grind-${slug}`}
                  value={option.id}
                  checked={selected}
                  disabled={loading}
                  onChange={() => setGrind(option.id)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>
      {subscribing && (
        <fieldset className="space-y-2">
          <legend id={frequencyLegendId} className="text-sm font-medium text-np-cream">
            How often
          </legend>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby={frequencyLegendId}>
            {frequencyOptions.map((option) => {
              const selected = frequency === option.id;
              return (
                <label key={option.id} className={cn(optionClass(selected), "px-2 text-xs")}>
                  <input
                    type="radio"
                    name={`frequency-${slug}`}
                    value={option.id}
                    checked={selected}
                    disabled={loading}
                    onChange={() => setFrequency(option.id)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={qtyId} className="text-np-cream">
          {subscribing ? "Bags per delivery" : "Quantity"}
        </Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 border-gold/30 bg-transparent text-np-cream hover:bg-gold/10 hover:text-np-cream"
            onClick={() => setClamped(quantity - 1)}
            disabled={loading || quantity <= 1}
            aria-label="Decrease quantity"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <input
            id={qtyId}
            type="number"
            inputMode="numeric"
            min={1}
            max={maxQuantity}
            value={quantity}
            disabled={loading}
            onChange={(event) => setClamped(Number(event.target.value))}
            className="h-9 w-14 rounded-md border border-gold/30 bg-np-black text-center text-sm text-np-cream [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 border-gold/30 bg-transparent text-np-cream hover:bg-gold/10 hover:text-np-cream"
            onClick={() => setClamped(quantity + 1)}
            disabled={loading || quantity >= maxQuantity}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        {subscribing ? (
          <>
            <span className="font-black text-np-cream">{formatUsd(subPrice.subscriberPerBagCents)}</span> per bag,{" "}
            {frequencyText}, shipping included. Skip, pause, or cancel anytime.
          </>
        ) : (
          <>
            <span className="font-black text-np-cream">{formatUsd(priceCents)}</span> per bag, shipping included
          </>
        )}
      </p>
      <Button
        type="button"
        onClick={handleBuy}
        disabled={loading || !grind}
        className="w-full bg-gold text-np-black hover:bg-gold/90"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !grind ? (
          "Choose Ground or Whole bean"
        ) : subscribing ? (
          `Subscribe — ${formatUsd(lineTotal)} ${frequencyText}`
        ) : (
          `Pre-order — ${formatUsd(lineTotal)}`
        )}
      </Button>
      {subscribing && (
        <p className="text-xs text-muted-foreground">
          Want both coffees?{" "}
          <Link href="/subscribe#build" className="text-gold underline">
            Alternate First Serve and Second Wind
          </Link>
          .
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
