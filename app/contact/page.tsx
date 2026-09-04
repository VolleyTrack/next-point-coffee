"use client";

import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { site } from "@/lib/site";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("failed");
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Contact</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Let&apos;s Talk</h1>
      <p className="mt-4 text-muted-foreground">
        Questions about the coffee, a club fundraiser, or press? Reach us here or email{" "}
        <a href={`mailto:${site.contactEmail}`} className="text-gold hover:underline">
          {site.contactEmail}
        </a>
        .
      </p>

      {status === "success" ? (
        <div className="mt-8 flex items-center gap-2 rounded-md border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-gold">
          <CheckCircle className="h-4 w-4" />
          Thanks — we got your message and will follow up soon.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 border-gold/30 bg-np-black text-np-cream"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="mt-1 border-gold/30 bg-np-black text-np-cream"
            />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="mt-1 border-gold/30 bg-np-black text-np-cream"
            />
          </div>
          <Button type="submit" disabled={status === "loading"} className="bg-gold text-np-black hover:bg-gold/90">
            {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Message"}
          </Button>
          {status === "error" && (
            <p className="text-sm text-red-400">Something went wrong. Please try again.</p>
          )}
        </form>
      )}
    </div>
  );
}
