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
  created_at: string;
}

export default function AdminOrdersPage() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

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
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-np-cream">Orders</h1>
        <p className="text-sm text-muted-foreground">
          {rows.length} orders &middot; ${totalRevenue.toFixed(2)} total revenue
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-gold/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
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
                <td className="px-4 py-3 text-muted-foreground">{row.fulfillment_status}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
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
