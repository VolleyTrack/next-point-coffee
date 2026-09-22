"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/campaigns/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, next: nextPath }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Sign-in failed.");
        return;
      }
      const redirectTo = typeof data.redirectTo === "string" ? data.redirectTo : "/campaigns/portal";
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Sign-in failed. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-4 rounded-lg border border-gold/20 bg-card p-6">
      <div className="space-y-2">
        <Label htmlFor="email" className="text-np-cream">
          Email
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="border-gold/30 bg-np-black text-np-cream"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password" className="text-np-cream">
          Password
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
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
        {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in"}
      </Button>
    </form>
  );
}
