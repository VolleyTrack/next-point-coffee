import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { campaignsLive } from "@/lib/site";
import {
  CAMPAIGNS_PREVIEW_COOKIE,
  campaignsPreviewToken,
  isValidCampaignsPreviewKey,
  previewCookieOptions,
} from "@/lib/campaigns/preview-access";

export const dynamic = "force-dynamic";

/**
 * Ryan-only preview unlock while NEXT_PUBLIC_CAMPAIGNS_LIVE is false.
 * Body: { key: string } — CAMPAIGNS_PREVIEW_KEY if set, else ADMIN_ACCESS_KEY.
 * When campaigns are live, unlock is a no-op (public access).
 */
export async function POST(request: Request) {
  if (campaignsLive) {
    return NextResponse.json({ ok: true, live: true });
  }

  const body = await request.json().catch(() => ({}));
  const key = typeof body.key === "string" ? body.key : "";

  if (!isValidCampaignsPreviewKey(key)) {
    return NextResponse.json({ error: "Incorrect access key." }, { status: 401 });
  }

  const token = await campaignsPreviewToken();
  if (!token) {
    return NextResponse.json(
      { error: "Preview unlock is not configured. Set ADMIN_ACCESS_KEY (or CAMPAIGNS_PREVIEW_KEY) in Vercel." },
      { status: 503 }
    );
  }

  const jar = await cookies();
  jar.set(CAMPAIGNS_PREVIEW_COOKIE, token, previewCookieOptions());

  return NextResponse.json({ ok: true, live: false });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(CAMPAIGNS_PREVIEW_COOKIE);
  return NextResponse.json({ ok: true });
}
