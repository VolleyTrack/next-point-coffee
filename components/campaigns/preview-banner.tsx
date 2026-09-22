"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Shown only when campaigns are not live but Ryan has unlocked preview. */
export function CampaignsPreviewBanner() {
  const router = useRouter();
  const [locking, setLocking] = useState(false);

  async function lockPreview() {
    setLocking(true);
    try {
      await fetch("/api/campaigns/preview-unlock", { method: "DELETE" });
      router.refresh();
    } finally {
      setLocking(false);
    }
  }

  return (
    <div className="border-b border-gold/30 bg-card px-6 py-2 text-center text-xs text-muted-foreground">
      Campaigns preview — not public.{" "}
      <button
        type="button"
        onClick={lockPreview}
        disabled={locking}
        className="font-semibold text-gold hover:underline disabled:opacity-50"
      >
        Lock preview
      </button>
    </div>
  );
}
