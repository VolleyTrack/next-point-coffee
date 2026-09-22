"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { retailMaxQuantity } from "@/lib/site";
import { Loader2, Minus, Plus } from "lucide-react";

interface BuyButtonProps {
  slug: string;
  priceCents: number;
}

function formatUsd(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function BuyButton({ slug, priceCents }: BuyButtonProps) {
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const qtyId = `qty-${slug}`;

  function setClamped(next: number) {
    const value = Math.max(1, Math.min(retailMaxQuantity, Math.floor(next) || 1));
    setQuantity(value);
  }

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ slug, quantity }] }),
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
        disabled={loading}
        className="w-full bg-gold text-np-black hover:bg-gold/90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy Now — ${formatUsd(lineTotal)}`}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
