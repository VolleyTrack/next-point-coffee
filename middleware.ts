import { NextResponse, type NextRequest } from "next/server";
import { isPartnerPortalPath } from "@/lib/campaigns/portal-paths";
import {
  CAMPAIGNS_PREVIEW_COOKIE,
  isValidCampaignsPreviewCookieAsync,
  previewSecretFromEnv,
} from "@/lib/campaigns/preview-token";
import {
  PORTAL_SESSION_COOKIE,
  portalSessionSecret,
  readPortalSessionUserId,
} from "@/lib/campaigns/session-token";

function previewGateOpen(): boolean {
  if (process.env.NEXT_PUBLIC_CAMPAIGNS_LIVE === "true") return true;
  if (process.env.NODE_ENV === "development" && !previewSecretFromEnv()) return true;
  return false;
}

/**
 * Public launch stays behind NEXT_PUBLIC_CAMPAIGNS_LIVE, with Ryan's preview
 * cookie as the exception. Partner pages (portal, club, athlete, admin) also
 * require a signed email/password session. Buyer pages — /campaigns, a live
 * /campaigns/[slug] link, and /campaigns/thanks — do not.
 * A temporary password still gets a session, but portal pages redirect to
 * /campaigns/change-password until that password is replaced.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/api/campaigns/preview-unlock") {
    return NextResponse.next();
  }

  const isCampaignsPage = pathname === "/campaigns" || pathname.startsWith("/campaigns/");
  const isCampaignsApi = pathname.startsWith("/api/campaigns/");

  if (!isCampaignsPage && !isCampaignsApi) {
    return NextResponse.next();
  }

  if (!previewGateOpen()) {
    const secret = previewSecretFromEnv();
    const cookie = request.cookies.get(CAMPAIGNS_PREVIEW_COOKIE)?.value;
    if (!(await isValidCampaignsPreviewCookieAsync(cookie, secret))) {
      if (isCampaignsApi) {
        return NextResponse.json(
          { error: "Campaigns are not live yet. Join the fundraising waitlist or unlock with the preview key." },
          { status: 403 }
        );
      }
      const url = request.nextUrl.clone();
      url.pathname = "/campaigns-coming-soon";
      return NextResponse.rewrite(url);
    }
  }

  if (isPartnerPortalPath(pathname)) {
    const userId = await readPortalSessionUserId(
      request.cookies.get(PORTAL_SESSION_COOKIE)?.value,
      portalSessionSecret()
    );
    if (!userId) {
      const login = request.nextUrl.clone();
      login.pathname = "/campaigns/login";
      login.search = "";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/campaigns", "/campaigns/:path*", "/api/campaigns/:path*"],
};
