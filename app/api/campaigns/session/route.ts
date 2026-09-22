import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/campaigns/auth";
import { portalHome, sanitizePortalNext } from "@/lib/campaigns/portal-paths";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";
import {
  LEGACY_PORTAL_COOKIE,
  PORTAL_SESSION_COOKIE,
  createPortalSessionToken,
  portalSessionCookieOptions,
  portalSessionSecret,
} from "@/lib/campaigns/session-token";
import { verifyPortalCredentials } from "@/lib/campaigns/store";

export const dynamic = "force-dynamic";

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function GET() {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }
  const user = await getPortalUser();
  return NextResponse.json({ user });
}

export async function POST(request: Request) {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email.trim() || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const secret = portalSessionSecret();
  if (!secret) {
    return NextResponse.json(
      { error: "Partner sign-in is not configured. Set PORTAL_SESSION_SECRET or ADMIN_ACCESS_KEY." },
      { status: 503 }
    );
  }

  const user = await verifyPortalCredentials(email, password);
  if (!user) {
    return NextResponse.json({ error: "That email and password did not match." }, { status: 401 });
  }

  const token = await createPortalSessionToken(user.id, secret);
  const redirectTo =
    sanitizePortalNext(typeof body.next === "string" ? body.next : null, user.role) ?? portalHome(user.role);

  const response = NextResponse.json({ user, redirectTo });
  response.cookies.set(PORTAL_SESSION_COOKIE, token, portalSessionCookieOptions());
  clearCookie(response, LEGACY_PORTAL_COOKIE);
  return response;
}

export async function DELETE() {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }
  const response = NextResponse.json({ user: null });
  clearCookie(response, PORTAL_SESSION_COOKIE);
  clearCookie(response, LEGACY_PORTAL_COOKIE);
  return response;
}
