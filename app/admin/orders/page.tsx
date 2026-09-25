"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OrderRow {
  id: string;
  customer_email: string;
  customer_name: string | null;
  amount_total: number;
  currency: string;
  payment_status: string;
  fulfillment_status: string;
  channel?: "retail" | "campaign";
  campaign_name?: string | null;
  campaign_share_owed?: number | null;
  books_sync_status?: "pending" | "synced" | "failed" | "skipped";
  books_last_error?: string | null;
  created_at: string;
}

export default function AdminOrdersPage() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");
  const [retryNote, setRetryNote] = useState("");
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendNote, setResendNote] = useState("");

  async function unlock() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/orders", { headers: { "x-admin-key": key } });
      if (res.status === 401) {
        setError("Incorrect access key.");
        setStatus("idle");
        return;
      }
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setRows(data.rows);
      setStatus("idle");
    } catch {
      setError("Something went wrong loading orders.");
      setStatus("idle");
    }
  }

  async function resendConfirmation(orderId: string) {
    setResendingId(orderId);
    setResendNote("");
    setError("");
    try {
      const res = await fetch("/api/admin/orders/confirmation-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": key },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not send the confirmation email.");
        return;
      }
      setResendNote(`Confirmation sent to ${data.to || "the customer"} (${orderId.slice(0, 8)}).`);
    } catch {
      setError("Could not send the confirmation email.");
    } finally {
      setResendingId(null);
    }
  }

  async function retryBooks() {
    setStatus("loading");
    setRetryNote("");
    setError("");
    try {
      const res = await fetch("/api/admin/orders/retry-books", {
        method: "POST",
        headers: { "x-admin-key": key },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not retry books sync.");
        setStatus("idle");
        return;
      }
      setRetryNote(
        `Books retry: ${data.attempted} attempted, ${data.synced} synced, ${data.failed} failed, ${data.skipped} skipped.`
      );
      await unlock();
    } catch {
      setError("Could not retry books sync.");
      setStatus("idle");
    }
  }

  if (!rows) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-black text-np-cream">Orders Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the access key to view orders.</p>
        <div className="mt-6 space-y-3">
          <Input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Access key"
            className="border-gold/30 bg-np-black text-np-cream"
            onKeyDown={(e) => e.key === "Enter" && unlock()}
          />
          <Button
            onClick={unlock}
            disabled={status === "loading" || !key}
            className="w-full bg-gold text-np-black hover:bg-gold/90"
          >
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
          </Button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      </div>
    );
  }

  const totalRevenue = rows.reduce((sum, r) => sum + r.amount_total, 0) / 100;

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-np-cream">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} orders &middot; ${totalRevenue.toFixed(2)} total revenue
          </p>
        </div>
        <Button
          onClick={retryBooks}
          disabled={status === "loading"}
          variant="outline"
          className="border-gold/40 text-np-cream"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Retry books sync"}
        </Button>
      </div>
      {retryNote && <p className="mb-4 text-sm text-muted-foreground">{retryNote}</p>}
      {resendNote && <p className="mb-4 text-sm text-muted-foreground">{resendNote}</p>}
      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

      <div className="overflow-x-auto rounded-lg border border-gold/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Channel</th>
              <th className="px-4 py-3">Books</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gold/10">
                <td className="px-4 py-3 text-np-cream">{row.customer_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.customer_email}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  ${(row.amount_total / 100).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.channel || "—"}
                  {row.channel === "campaign" && row.campaign_name ? (
                    <span className="block text-xs">{row.campaign_name}</span>
                  ) : null}
                  {row.channel === "campaign" && row.campaign_share_owed != null ? (
                    <span className="block text-xs">share ${(row.campaign_share_owed / 100).toFixed(2)}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground" title={row.books_last_error || undefined}>
                  {row.books_sync_status || "—"}
                  {row.books_last_error ? (
                    <span className="block max-w-[16rem] truncate text-xs text-red-300">{row.books_last_error}</span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{row.fulfillment_status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-gold/40 text-np-cream"
                    disabled={resendingId === row.id}
                    onClick={() => resendConfirmation(row.id)}
                  >
                    {resendingId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resend confirmation"}
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
