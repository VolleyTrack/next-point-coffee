"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignRequest, CampaignWithRelations, IssuedPortalCredential } from "@/lib/campaigns/types";
import { CopyButton } from "@/components/campaigns/copy-button";
import { Loader2 } from "lucide-react";

function credentialRoleLabel(role: IssuedPortalCredential["role"]): string {
  if (role === "club") return "Club";
  if (role === "athlete") return "Athlete";
  return "Next Point Coffee";
}

function credentialsPlainText(rows: IssuedPortalCredential[]): string {
  return rows
    .map(
      (row) =>
        `${credentialRoleLabel(row.role)} — ${row.name}\nEmail: ${row.email}\nTemporary password: ${row.temporaryPassword}`
    )
    .join("\n\n");
}

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

export function CreateSetupForm({ initialRequest }: { initialRequest?: CampaignRequest | null }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [credentials, setCredentials] = useState<IssuedPortalCredential[] | null>(null);
  const [publish, setPublish] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const organizationName = String(fd.get("organizationName") ?? "").trim();
    const type = fd.get("type") === "nonprofit" ? "nonprofit" : "club";
    const contactEmail = String(fd.get("contactEmail") ?? "").trim();
    const bagShareDollars = Number(fd.get("bagShareDollars"));
    const athleteName = String(fd.get("athleteName") ?? "").trim();
    const athleteEmail = String(fd.get("athleteEmail") ?? "").trim();
    const campaignName = String(fd.get("campaignName") ?? "").trim();
    const story = String(fd.get("story") ?? "").trim();
    const goalBags = Number(fd.get("goalBags"));
    setStatus("loading");
    setError("");
    setOk("");
    setCredentials(null);
    try {
      const data = await adminAction({
        action: "createSetup",
        organizationName,
        type,
        contactEmail,
        bagShareDollars,
        athleteName,
        athleteEmail,
        campaignName,
        story,
        goalBags,
        publish,
        requestId: initialRequest?.id,
      });
      const slug = data.campaign?.slug as string | undefined;
      const issued = Array.isArray(data.credentials) ? (data.credentials as IssuedPortalCredential[]) : [];
      setCredentials(issued);
      setOk(
        publish && slug
          ? `Live. Share /campaigns/${slug} — that link and QR stay public for buyers.`
          : "Draft saved. Publish it below when you are ready to share the link."
      );
      form.reset();
      setPublish(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-gold/20 bg-card p-6">
      <h2 className="text-xl font-black text-np-cream">Create a campaign</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Organization, athlete, and campaign in one place. This also creates one club login and one athlete login.
        Passwords are shown once below so you can share them. Bag share is set on the organization — type does not
        lock the amount.
      </p>
      {initialRequest && (
        <p className="mt-3 rounded-md border border-gold/30 bg-np-black px-3 py-2 text-sm text-gold">
          Prefilling from {initialRequest.organizationName} ({initialRequest.contactName}).
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-widest-plus text-gold">1 · Organization</legend>
          <div className="space-y-2">
            <FieldLabel>Organization name</FieldLabel>
            <Input
              name="organizationName"
              required
              defaultValue={initialRequest?.organizationName ?? ""}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Type</FieldLabel>
            <select name="type" defaultValue={initialRequest?.organizationType ?? "club"} className={selectClass}>
              <option value="club">Club sport</option>
              <option value="nonprofit">Nonprofit</option>
            </select>
          </div>
          <div className="space-y-2">
            <FieldLabel>Bag share ($ per bag)</FieldLabel>
            <Input
              name="bagShareDollars"
              type="number"
              min={0}
              step="0.01"
              required
              placeholder="e.g. 4.00"
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Contact email</FieldLabel>
            <Input
              name="contactEmail"
              type="email"
              required
              defaultValue={initialRequest?.contactEmail ?? ""}
              className={fieldClass}
            />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-widest-plus text-gold">2 · Athlete</legend>
          <div className="space-y-2">
            <FieldLabel>Athlete name</FieldLabel>
            <Input
              name="athleteName"
              required
              defaultValue={initialRequest?.athleteName ?? ""}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Athlete email</FieldLabel>
            <Input name="athleteEmail" type="email" required className={fieldClass} />
          </div>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold uppercase tracking-widest-plus text-gold">3 · Campaign</legend>
          <div className="space-y-2">
            <FieldLabel>Campaign name</FieldLabel>
            <Input
              name="campaignName"
              required
              placeholder="Maya's Season Fund"
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Story</FieldLabel>
            <Textarea
              name="story"
              required
              defaultValue={initialRequest?.notes ?? ""}
              className={fieldClass}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel>Bag goal</FieldLabel>
            <Input name="goalBags" type="number" min={1} defaultValue={25} className={fieldClass} />
          </div>
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-np-cream">
          <input
            type="checkbox"
            checked={publish}
            onChange={(e) => setPublish(e.target.checked)}
            className="accent-gold"
          />
          Publish now (mint the public share link)
        </label>
        <Button type="submit" disabled={status === "loading"} className="bg-gold text-np-black hover:bg-gold/90">
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create organization, athlete & campaign"}
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      {ok && <p className="mt-3 text-sm text-gold">{ok}</p>}
      {credentials && credentials.length > 0 && (
        <div className="mt-6 rounded-md border border-gold/40 bg-np-black p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-widest-plus text-gold">Logins — shown once</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Share these with the club and the athlete. Next Point Coffee does not email them, and they will not
                appear here again. Passwords are stored only as hashes.
              </p>
            </div>
            <CopyButton value={credentialsPlainText(credentials)} label="Copy logins" />
          </div>
          <ul className="mt-4 space-y-4">
            {credentials.map((row) => (
              <li key={`${row.role}-${row.email}`} className="rounded-md border border-gold/20 px-4 py-3">
                <p className="text-xs uppercase tracking-widest-plus text-gold">{credentialRoleLabel(row.role)}</p>
                <p className="mt-1 font-semibold text-np-cream">{row.name}</p>
                <p className="mt-2 text-sm text-muted-foreground">Email: {row.email}</p>
                <p className="mt-1 font-mono text-sm text-np-cream">Password: {row.temporaryPassword}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

export function AdminSetupSection({ requests }: { requests: CampaignRequest[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const incoming = requests.filter((r) => r.status === "new");
  const handled = requests.filter((r) => r.status === "handled");

  async function markHandled(requestId: string) {
    setBusyId(requestId);
    try {
      await adminAction({ action: "markRequestHandled", requestId });
      if (selectedId === requestId) setSelectedId(null);
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-gold/20 bg-card p-6">
        <h2 className="text-xl font-black text-np-cream">Incoming requests</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Public visitors cannot browse campaigns. They submit this form; you set the campaign up here.
        </p>
        <div className="mt-4 space-y-3">
          {incoming.map((request) => (
            <div
              key={request.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-gold/15 bg-np-black px-4 py-3"
            >
              <div>
                <p className="font-semibold text-np-cream">
                  {request.organizationName}{" "}
                  <span className="text-xs font-normal uppercase tracking-wide text-muted-foreground">
                    {request.organizationType === "nonprofit" ? "Nonprofit" : "Club sport"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {request.contactName} · {request.contactEmail}
                  {request.city ? ` · ${request.city}` : ""}
                  {request.athleteName ? ` · athlete: ${request.athleteName}` : ""}
                </p>
                {request.notes && <p className="mt-2 text-sm text-np-cream">{request.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setSelectedId(request.id)}
                  className="bg-gold text-np-black hover:bg-gold/90"
                >
                  Use in setup
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === request.id}
                  onClick={() => markHandled(request.id)}
                  className="border-gold/40 text-gold"
                >
                  {busyId === request.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark handled"}
                </Button>
              </div>
            </div>
          ))}
          {incoming.length === 0 && (
            <p className="text-sm text-muted-foreground">No new requests. The public /campaigns form lands here.</p>
          )}
        </div>
        {handled.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            {handled.length} handled request{handled.length === 1 ? "" : "s"} this demo cycle.
          </p>
        )}
      </section>
      <CreateSetupForm key={selected?.id ?? "blank"} initialRequest={selected} />
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

export function UpdateBagShareForm({
  organizationId,
  bagShareCents,
}: {
  organizationId: string;
  bagShareCents: number;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const bagShareDollars = Number(fd.get("bagShareDollars"));
    setStatus("loading");
    try {
      await adminAction({ action: "updateOrganization", organizationId, bagShareDollars });
      router.refresh();
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        name="bagShareDollars"
        type="number"
        min={0}
        step="0.01"
        required
        defaultValue={(bagShareCents / 100).toFixed(2)}
        className={`${fieldClass} h-8 w-20`}
        aria-label="Bag share dollars per bag"
      />
      <Button type="submit" size="sm" variant="outline" disabled={status === "loading"} className="border-gold/40 text-gold">
        {status === "loading" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
      </Button>
    </form>
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
