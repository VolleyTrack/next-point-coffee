"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

const fieldClass = "border-gold/30 bg-np-black text-np-cream";
const selectClass = "flex h-10 w-full rounded-md border border-gold/30 bg-np-black px-3 text-sm text-np-cream";

export function CampaignRequestForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationName: String(fd.get("organizationName") ?? ""),
          organizationType: String(fd.get("organizationType") ?? "club"),
          contactName: String(fd.get("contactName") ?? ""),
          contactEmail: String(fd.get("contactEmail") ?? ""),
          phone: String(fd.get("phone") ?? ""),
          city: String(fd.get("city") ?? ""),
          athleteName: String(fd.get("athleteName") ?? ""),
          notes: String(fd.get("notes") ?? ""),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not send request.");
      e.currentTarget.reset();
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send request.");
      setStatus("idle");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-lg border border-gold/20 bg-card p-8">
        <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Request received</p>
        <h2 className="mt-2 text-2xl font-black text-np-cream">Next Point Coffee will set this up.</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          We notified Next Point Coffee. An admin will create the organization, athlete, and campaign, then send you
          the share link and QR when it is live.
        </p>
        <Button
          type="button"
          onClick={() => setStatus("idle")}
          variant="outline"
          className="mt-6 border-gold/40 text-gold"
        >
          Submit another request
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gold/20 bg-card p-6 sm:p-8">
      <h2 className="text-xl font-black text-np-cream">Club / nonprofit details</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Tell Next Point Coffee who you are. We do not publish an open list of live campaigns.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-np-cream">Organization name</Label>
          <Input name="organizationName" required placeholder="Riverside Volleyball Club" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Type</Label>
          <select name="organizationType" defaultValue="club" className={selectClass}>
            <option value="club">Club sport</option>
            <option value="nonprofit">Nonprofit</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">City / region</Label>
          <Input name="city" placeholder="Columbus, OH" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Your name</Label>
          <Input name="contactName" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Email</Label>
          <Input name="contactEmail" type="email" required className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Phone (optional)</Label>
          <Input name="phone" type="tel" className={fieldClass} />
        </div>
        <div className="space-y-2">
          <Label className="text-np-cream">Athlete to feature (optional)</Label>
          <Input name="athleteName" placeholder="Maya Chen" className={fieldClass} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label className="text-np-cream">What are you raising for?</Label>
          <Textarea
            name="notes"
            rows={4}
            placeholder="Travel, club dues, court time…"
            className={fieldClass}
          />
        </div>
      </div>
      <Button type="submit" disabled={status === "loading"} className="mt-6 bg-gold text-np-black hover:bg-gold/90">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request to start a campaign"}
      </Button>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
    </form>
  );
}
