"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface SignupRow {
  id: string;
  email: string;
  context: string;
  created_at: string;
}

export default function AdminNewsletterPage() {
  const [key, setKey] = useState("");
  const [rows, setRows] = useState<SignupRow[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState("");

  async function unlock() {
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/newsletter", {
        headers: { "x-admin-key": key },
      });
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
      setError("Something went wrong loading signups.");
      setStatus("idle");
    }
  }

  function downloadCsv() {
    window.open(`/api/admin/newsletter?format=csv`, "_blank");
  }

  if (!rows) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-sm flex-col justify-center px-6">
        <h1 className="text-2xl font-black text-np-cream">Newsletter Admin</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter the access key to view signups.</p>
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

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-np-cream">Newsletter Signups</h1>
          <p className="text-sm text-muted-foreground">{rows.length} total subscribers</p>
        </div>
        <Button onClick={downloadCsv} variant="outline" className="border-gold/40 text-gold">
          Download CSV
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-gold/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Signed up</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-gold/10">
                <td className="px-4 py-3 text-np-cream">{row.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.context}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(row.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">
                  No signups yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
