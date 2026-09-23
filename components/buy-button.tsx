"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { grindOptions, retailMaxQuantity, type GrindId } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Loader2, Minus, Plus } from "lucide-react";

interface BuyButtonProps {
  slug: string;
  priceCents: number;
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuyButton({ slug, priceCents }: BuyButtonProps) {
  const [grind, setGrind] = useState<GrindId | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qtyId = `qty-${slug}`;
  const grindLegendId = `grind-${slug}`;

  function setClamped(next: number) {
    const value = Math.max(1, Math.min(retailMaxQuantity, Math.floor(next) || 1));
    setQuantity(value);
  }

  async function handleBuy() {
    if (!grind) {
      setError("Choose Ground or Whole bean.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
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

  const lineTotal = priceCents * quantity;

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend id={grindLegendId} className="text-sm font-medium text-np-cream">
          Ground or whole bean
        </legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-labelledby={grindLegendId}>
          {grindOptions.map((option) => {
            const selected = grind === option.id;
            return (
              <label
                key={option.id}
                className={cn(
                  "flex cursor-pointer items-center justify-center rounded-md border px-3 py-2 text-sm font-semibold transition-colors focus-within:ring-2 focus-within:ring-gold/70",
                  selected
                    ? "border-gold bg-gold/15 text-np-cream"
                    : "border-gold/30 bg-transparent text-muted-foreground hover:border-gold/60 hover:text-np-cream"
                )}
              >
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
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={qtyId} className="text-np-cream">
          Quantity
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
            max={retailMaxQuantity}
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
            disabled={loading || quantity >= retailMaxQuantity}
            aria-label="Increase quantity"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        <span className="font-black text-np-cream">{formatUsd(priceCents)}</span> per bag, shipping included
      </p>
      <Button
        type="button"
        onClick={handleBuy}
        disabled={loading || !grind}
        className="w-full bg-gold text-np-black hover:bg-gold/90"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : grind ? (
          `Pre-order — ${formatUsd(lineTotal)}`
        ) : (
          "Choose Ground or Whole bean"
        )}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
