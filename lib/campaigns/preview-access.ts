import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { campaignsLive } from "@/lib/site";
import {
  CAMPAIGNS_PREVIEW_COOKIE,
  PREVIEW_COOKIE_MAX_AGE,
  campaignsPreviewTokenAsync,
  isValidCampaignsPreviewCookieAsync,
  isValidCampaignsPreviewKey,
  previewSecretFromEnv,
} from "@/lib/campaigns/preview-token";

export {
  CAMPAIGNS_PREVIEW_COOKIE,
  isValidCampaignsPreviewKey,
  previewSecretFromEnv as previewSecret,
} from "@/lib/campaigns/preview-token";

/** Signed token derived from the preview/admin key — not the raw secret. */
export async function campaignsPreviewToken(): Promise<string | null> {
  const secret = previewSecretFromEnv();
  if (!secret) return null;
  return campaignsPreviewTokenAsync(secret);
}

export async function isValidCampaignsPreviewCookie(value: string | undefined): Promise<boolean> {
  return isValidCampaignsPreviewCookieAsync(value);
}

/** True when the public launch flag is on, or Ryan has unlocked preview for this browser. */
export async function canAccessCampaigns(): Promise<boolean> {
  if (campaignsLive) return true;
  // Local npm run dev: keep the prototype open when no access key is configured yet.
  if (process.env.NODE_ENV === "development" && !previewSecretFromEnv()) return true;
  const jar = await cookies();
  return isValidCampaignsPreviewCookieAsync(jar.get(CAMPAIGNS_PREVIEW_COOKIE)?.value);
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
