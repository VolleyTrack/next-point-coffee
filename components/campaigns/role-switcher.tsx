"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PortalUser } from "@/lib/campaigns/types";

const roleHome: Record<PortalUser["role"], string> = {
  admin: "/campaigns/admin",
  club: "/campaigns/club",
  athlete: "/campaigns/athlete",
};

export function RoleSwitcher({
  users,
  currentUserId,
}: {
  users: PortalUser[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function switchTo(userId: string) {
    const user = users.find((u) => u.id === userId);
    setBusy(true);
    await fetch("/api/campaigns/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    router.push(user ? roleHome[user.role] : "/campaigns/portal");
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="uppercase tracking-widest-plus text-gold">Prototype role</span>
      <select
        disabled={busy}
        value={currentUserId ?? ""}
        onChange={(e) => switchTo(e.target.value)}
        className="h-9 rounded-md border border-gold/30 bg-np-black px-2 text-sm text-np-cream"
      >
        <option value="">Choose a demo user…</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.role.toUpperCase()} — {user.name}
          </option>
        ))}
      </select>
    </label>
  );
}
