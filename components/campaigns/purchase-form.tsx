"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Product } from "@/lib/site";
import { Loader2 } from "lucide-react";

export function PurchaseForm({
  campaignSlug,
  athleteName,
  products,
  simulated,
}: {
  campaignSlug: string;
  athleteName: string;
  products: Product[];
  simulated: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const productSlug = String(fd.get("productSlug") ?? "");
    const quantity = Number(fd.get("quantity") ?? 1);
    const buyerName = String(fd.get("buyerName") ?? "").trim();
    const buyerEmail = String(fd.get("buyerEmail") ?? "").trim();

    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignSlug,
          productSlug,
          quantity,
          buyerName,
          buyerEmail,
          simulate: simulated,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Could not complete that purchase.");
        setStatus("idle");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Please try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-gold/30 bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Support {athleteName}</p>
      <h2 className="mt-2 text-2xl font-black text-np-cream">Buy a bag</h2>
      {simulated && (
        <p className="mt-2 text-xs text-gold">
          Prototype checkout — no card is charged. The sale is written to the campaign ledger and attributed to this
          athlete.
        </p>
      )}

      <div className="mt-5 space-y-4">
        <div className="space-y-2">
          <Label className="text-np-cream">Coffee</Label>
          <select
            name="productSlug"
            defaultValue={products[0]?.slug}
            className="flex h-10 w-full rounded-md border border-gold/30 bg-np-black px-3 text-sm text-np-cream"
          >
            {products.map((product) => (
              <option key={product.slug} value={product.slug}>
                {product.name} — ${(product.priceCents / 100).toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Bags</Label>
          <Input
            type="number"
            name="quantity"
            min={1}
            max={20}
            defaultValue={1}
            className="border-gold/30 bg-np-black text-np-cream"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Your name</Label>
          <Input
            name="buyerName"
            placeholder="Alex Fan"
            className="border-gold/30 bg-np-black text-np-cream"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Email</Label>
          <Input
            type="email"
            name="buyerEmail"
            required
            placeholder="you@email.com"
            className="border-gold/30 bg-np-black text-np-cream"
          />
        </div>
        <Button type="submit" disabled={status === "loading"} className="w-full bg-gold text-np-black hover:bg-gold/90">
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : `Buy — support ${athleteName}`}
        </Button>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </form>
  );
}
