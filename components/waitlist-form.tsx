"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";

interface WaitlistFormProps {
  ctaLabel?: string;
  placeholder?: string;
  context?: string;
}

export function WaitlistForm({
  ctaLabel = "Notify Me",
  placeholder = "you@email.com",
  context = "general",
}: WaitlistFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, context }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
        <CheckCircle className="h-4 w-4" />
        You&apos;re on the list. We&apos;ll email you the second we launch.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <Input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={placeholder}
        className="border-gold/30 bg-np-black text-np-cream placeholder:text-muted-foreground"
      />
      <Button
        type="submit"
        disabled={status === "loading"}
        className="bg-gold text-np-black hover:bg-gold/90"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
      </Button>
      {status === "error" && (
        <p className="text-xs text-red-400 sm:hidden">Something went wrong. Try again.</p>
      )}
    </form>
  );
}
