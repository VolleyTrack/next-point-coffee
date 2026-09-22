import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { campaignsLive } from "@/lib/site";

/** HttpOnly cookie set after Ryan unlocks campaigns preview with the access key. */
export const CAMPAIGNS_PREVIEW_COOKIE = "npc_campaigns_preview";

const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

function previewSecret(): string | null {
  const key = process.env.CAMPAIGNS_PREVIEW_KEY || process.env.ADMIN_ACCESS_KEY;
  return key && key.length > 0 ? key : null;
}

/** Signed token derived from the preview/admin key — not the raw secret. */
export function campaignsPreviewToken(): string | null {
  const secret = previewSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update("next-point-coffee-campaigns-preview-v1").digest("hex");
}

export function isValidCampaignsPreviewKey(provided: string): boolean {
  const expected = previewSecret();
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isValidCampaignsPreviewCookie(value: string | undefined): boolean {
  const expected = campaignsPreviewToken();
  if (!expected || !value) return false;
  try {
    const a = Buffer.from(value);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** True when the public launch flag is on, or Ryan has unlocked preview for this browser. */
export async function canAccessCampaigns(): Promise<boolean> {
  if (campaignsLive) return true;
  // Local npm run dev: keep the prototype open when no access key is configured yet.
  if (process.env.NODE_ENV === "development" && !previewSecret()) return true;
  const jar = await cookies();
  return isValidCampaignsPreviewCookie(jar.get(CAMPAIGNS_PREVIEW_COOKIE)?.value);
}

export function previewCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PREVIEW_COOKIE_MAX_AGE,
  };
}

/** 403 JSON used by /api/campaigns/* when the public launch is off and preview is locked. */
export function campaignsUnavailableResponse() {
  return NextResponse.json(
    { error: "Campaigns are not live yet. Join the fundraising waitlist or unlock with the preview key." },
    { status: 403 }
  );
}
