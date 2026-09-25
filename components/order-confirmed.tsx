"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";

export function OrderConfirmedContent({ shipLine }: { shipLine: string }) {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const subscription = params.get("type") === "subscription";
  const [status, setStatus] = useState<"loading" | "found" | "not_found">("loading");

  useEffect(() => {
    if (!sessionId) {
      setStatus("not_found");
      return;
    }
    const t = setTimeout(() => setStatus("found"), 1200);
    return () => clearTimeout(t);
  }, [sessionId]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      {status === "loading" && <Loader2 className="h-8 w-8 animate-spin text-gold" />}
      {status === "found" && (
        <>
          <CheckCircle className="h-12 w-12 text-gold" />
          <h1 className="mt-4 text-3xl font-black text-np-cream">Thank you</h1>
          <p className="mt-3 text-muted-foreground">
            {subscription ? "Thank you for subscribing. Welcome to the team." : "Thank you for your pre-order."}
          </p>
          <p className="mt-3 text-sm font-semibold text-gold">{shipLine}</p>
          <p className="mt-3 text-muted-foreground">Check your email for your confirmation.</p>
          <Link href={subscription ? "/subscribe" : "/shop"} className="mt-6 text-sm font-semibold text-gold hover:underline">
            Continue Shopping
          </Link>
        </>
      )}
      {status === "not_found" && (
        <>
          <h1 className="text-2xl font-black text-np-cream">Something&apos;s not right</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn&apos;t find your order details. If you completed a payment, don&apos;t worry — reach out
            to us and we&apos;ll sort it out.
          </p>
          <Link href="/contact" className="mt-6 text-sm font-semibold text-gold hover:underline">
            Contact Us
          </Link>
        </>
      )}
    </div>
  );
}
