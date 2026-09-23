"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function ChangePasswordForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Could not update password.");
        return;
      }
      const redirectTo = typeof data.redirectTo === "string" ? data.redirectTo : "/campaigns/portal";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Could not update password. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border border-gold/20 bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="password" className="text-np-cream">
          New password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="border-gold/30 bg-np-black text-np-cream"
        />
        <p className="text-xs text-muted-foreground">At least 8 characters.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm" className="text-np-cream">
          Confirm password
        </Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          className="border-gold/30 bg-np-black text-np-cream"
        />
      </div>
      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" disabled={status === "loading"} className="w-full bg-gold text-np-black hover:bg-gold/90">
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save password"}
      </Button>
    </form>
  );
}
