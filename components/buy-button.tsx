"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface BuyButtonProps {
  slug: string;
  label?: string;
}

export function BuyButton({ slug, label = "Buy Now — $20.00" }: BuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleBuy() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [{ slug, quantity: 1 }] }),
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

  return (
    <div>
      <Button
        onClick={handleBuy}
        disabled={loading}
        className="w-full bg-gold text-np-black hover:bg-gold/90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
