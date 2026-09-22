"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { site } from "@/lib/site";

/**
 * Public face of /campaigns while NEXT_PUBLIC_CAMPAIGNS_LIVE is false.
 * Strangers see waitlist/contact CTAs. Ryan unlocks preview with the access key.
 */
export function CampaignsComingSoon() {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [showUnlock, setShowUnlock] = useState(false);

  async function unlock() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns/preview-unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      if (res.status === 401) {
        setError("Incorrect access key.");
        setStatus("idle");
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(typeof data.error === "string" ? data.error : "Could not unlock preview.");
        setStatus("idle");
        return;
      }
      router.refresh();
    } catch {
      setError("Something went wrong. Try again.");
      setStatus("idle");
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Team Fundraising</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">Campaigns are almost here.</h1>
      <p className="mt-4 text-muted-foreground">
        Next Point Coffee is finishing the partner portal before public launch. Join the fundraising list and we will
        email you when campaigns open.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{site.tagline}</p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild className="bg-gold text-np-black hover:bg-gold/90">
          <Link href="/fundraising">Join the fundraising waitlist</Link>
        </Button>
        <Button asChild variant="outline" className="border-gold/40 text-gold hover:bg-gold/10">
          <Link href="/contact">Contact us</Link>
        </Button>
      </div>

      <div className="mt-16 border-t border-gold/10 pt-8">
        {!showUnlock ? (
          <button
            type="button"
            onClick={() => setShowUnlock(true)}
            className="text-xs text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            Team preview access
          </button>
        ) : (
          <div className="max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the site access key to open the campaigns prototype in this browser. Public visitors stay on this
              page until launch.
            </p>
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Access key"
              className="border-gold/30 bg-np-black text-np-cream"
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              autoComplete="current-password"
            />
            <Button
              onClick={unlock}
              disabled={status === "loading" || !key}
              className="w-full bg-gold text-np-black hover:bg-gold/90"
            >
              {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock preview"}
            </Button>
            {error && <p className="text-sm text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
