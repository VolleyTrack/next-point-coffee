"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle, Loader2 } from "lucide-react";

export default function OrderConfirmedPage() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");
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
          <h1 className="mt-4 text-3xl font-black text-np-cream">Order Confirmed!</h1>
          <p className="mt-3 text-muted-foreground">
            Thanks for backing Next Point Coffee Co. A confirmation has been sent to your email,
            and we'll notify you again once it ships.
          </p>
          <Link href="/shop" className="mt-6 text-sm font-semibold text-gold hover:underline">
            Continue Shopping
          </Link>
        </>
      )}
      {status === "not_found" && (
        <>
          <h1 className="text-2xl font-black text-np-cream">Something's not right</h1>
          <p className="mt-3 text-muted-foreground">
            We couldn't find your order details. If you completed a payment, don't worry — reach out
            to us and we'll sort it out.
          </p>
          <Link href="/contact" className="mt-6 text-sm font-semibold text-gold hover:underline">
            Contact Us
          </Link>
        </>
      )}
    </div>
  );
}
