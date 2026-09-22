"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PortalLogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/campaigns/session", { method: "DELETE" });
      router.push("/campaigns/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-gold disabled:opacity-50"
    >
      Log out
    </button>
  );
}
