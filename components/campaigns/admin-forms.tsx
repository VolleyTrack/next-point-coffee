"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Athlete, CampaignWithRelations, Organization } from "@/lib/campaigns/types";
import { Loader2 } from "lucide-react";

async function adminAction(body: Record<string, unknown>) {
  const res = await fetch("/api/campaigns/admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Label className="text-np-cream">{children}</Label>;
}

const fieldClass = "border-gold/30 bg-np-black text-np-cream";
const selectClass = "flex h-10 w-full rounded-md border border-gold/30 bg-np-black px-3 text-sm text-np-cream";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState<"club" | "nonprofit">("club");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit() {
    setStatus("loading");
    setError("");
    setOk("");
    try {
      await adminAction({ action: "createOrganization", name, type, contactEmail });
      setOk(`Created ${name}. A club demo user was added to the role switcher.`);
      setName("");
      setContactEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <FieldLabel>Organization name</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div className="space-y-2">
        <FieldLabel>Type</FieldLabel>
        <select value={type} onChange={(e) => setType(e.target.value as "club" | "nonprofit")} className={selectClass}>
          <option value="club">Club / team — $3 a bag</option>
          <option value="nonprofit">Nonprofit — $5 a bag</option>
        </select>
      </div>
      <div className="space-y-2">
        <FieldLabel>Contact email</FieldLabel>
        <Input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className={fieldClass}
        />
      </div>
      <Button onClick={submit} disabled={status === "loading"} className="bg-gold text-np-black hover:bg-gold/90">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organization"}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {ok && <p className="text-sm text-gold">{ok}</p>}
    </div>
  );
}

export function CreateAthleteForm({ organizations }: { organizations: Organization[] }) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  async function submit() {
    setStatus("loading");
    setError("");
    setOk("");
    try {
      await adminAction({ action: "createAthlete", organizationId, name, email });
      setOk(`Added ${name}. They now appear in the athlete role switcher.`);
      setName("");
      setEmail("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <FieldLabel>Organization</FieldLabel>
        <select value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className={selectClass}>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <FieldLabel>Athlete name</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div className="space-y-2">
        <FieldLabel>Athlete email</FieldLabel>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={fieldClass} />
      </div>
      <Button onClick={submit} disabled={status === "loading"} className="bg-gold text-np-black hover:bg-gold/90">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create athlete"}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {ok && <p className="text-sm text-gold">{ok}</p>}
    </div>
  );
}

export function CreateCampaignForm({
  organizations,
  athletes,
}: {
  organizations: Organization[];
  athletes: Athlete[];
}) {
  const router = useRouter();
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const orgAthletes = useMemo(
    () => athletes.filter((a) => a.organizationId === organizationId),
    [athletes, organizationId]
  );
  const [athleteId, setAthleteId] = useState(orgAthletes[0]?.id ?? "");
  const [name, setName] = useState("");
  const [story, setStory] = useState("");
  const [goalBags, setGoalBags] = useState(25);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  function onOrg(id: string) {
    setOrganizationId(id);
    const next = athletes.filter((a) => a.organizationId === id);
    setAthleteId(next[0]?.id ?? "");
  }

  async function submit() {
    setStatus("loading");
    setError("");
    setOk("");
    try {
      await adminAction({ action: "createCampaign", organizationId, athleteId, name, story, goalBags });
      setOk("Draft campaign created. Publish it to mint the public link and QR.");
      setName("");
      setStory("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel>Organization</FieldLabel>
          <select value={organizationId} onChange={(e) => onOrg(e.target.value)} className={selectClass}>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Assigned athlete</FieldLabel>
          <select value={athleteId} onChange={(e) => setAthleteId(e.target.value)} className={selectClass}>
            {orgAthletes.length === 0 && <option value="">Add an athlete first</option>}
            {orgAthletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>
                {athlete.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-2">
        <FieldLabel>Campaign name</FieldLabel>
        <Input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </div>
      <div className="space-y-2">
        <FieldLabel>Story</FieldLabel>
        <Textarea value={story} onChange={(e) => setStory(e.target.value)} className={fieldClass} />
      </div>
      <div className="space-y-2">
        <FieldLabel>Bag goal</FieldLabel>
        <Input
          type="number"
          min={1}
          value={goalBags}
          onChange={(e) => setGoalBags(Number(e.target.value))}
          className={fieldClass}
        />
      </div>
      <Button
        onClick={submit}
        disabled={status === "loading" || !athleteId}
        className="bg-gold text-np-black hover:bg-gold/90"
      >
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create draft campaign"}
      </Button>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {ok && <p className="text-sm text-gold">{ok}</p>}
    </div>
  );
}

export function CampaignActions({ campaign }: { campaign: CampaignWithRelations }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function run(action: "publishCampaign" | "closeCampaign") {
    setStatus("loading");
    setError("");
    try {
      await adminAction({ action, campaignId: campaign.id });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {campaign.status !== "live" && (
        <Button
          size="sm"
          onClick={() => run("publishCampaign")}
          disabled={status === "loading"}
          className="bg-gold text-np-black hover:bg-gold/90"
        >
          Publish
        </Button>
      )}
      {campaign.status === "live" && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run("closeCampaign")}
          disabled={status === "loading"}
          className="border-gold/40 text-gold"
        >
          Close
        </Button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}

export function PayoutActions() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");

  async function compute() {
    setStatus("loading");
    setMessage("");
    try {
      const data = await adminAction({ action: "computePayouts" });
      const count = Array.isArray(data.payouts) ? data.payouts.length : 0;
      setMessage(
        count
          ? `Opened ${count} payout period${count === 1 ? "" : "s"} for the current two-week window.`
          : "No unassigned sales in the current two-week window (or periods already exist)."
      );
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-3">
      <Button onClick={compute} disabled={status === "loading"} className="bg-gold text-np-black hover:bg-gold/90">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compute current biweekly payouts"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function run() {
    setStatus("loading");
    await adminAction({ action: "markPayoutPaid", payoutId });
    router.refresh();
    setStatus("idle");
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={run}
      disabled={status === "loading"}
      className="border-gold/40 text-gold"
    >
      {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark paid"}
    </Button>
  );
}

export function ResetDemoButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function run() {
    setStatus("loading");
    await adminAction({ action: "resetDemo" });
    router.refresh();
    setStatus("idle");
  }

  return (
    <Button
      variant="outline"
      onClick={run}
      disabled={status === "loading"}
      className="border-red-400/40 text-red-300 hover:bg-red-400/10"
    >
      {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset demo data"}
    </Button>
  );
}

export function SyncBooksButton() {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [message, setMessage] = useState("");

  async function run() {
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch("/api/books/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");
      setMessage(data.mode === "webhook" ? "Pushed pending events to BOOKS_WEBHOOK_URL." : "No webhook set — events marked stubbed.");
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={run} disabled={status === "loading"} variant="outline" className="border-gold/40 text-gold">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry books sync"}
      </Button>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
    </div>
  );
}
