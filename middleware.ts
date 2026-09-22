import { NextResponse, type NextRequest } from "next/server";
import {
  CAMPAIGNS_PREVIEW_COOKIE,
  isValidCampaignsPreviewCookieAsync,
  previewSecretFromEnv,
} from "@/lib/campaigns/preview-token";

/**
 * When NEXT_PUBLIC_CAMPAIGNS_LIVE is not true, keep strangers off the campaigns
 * portal by rewriting page requests to a standalone coming-soon route (so
 * /campaigns/* pages and their data loaders never run). Ryan unlocks via
 * ADMIN_ACCESS_KEY / CAMPAIGNS_PREVIEW_KEY → httpOnly cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (process.env.NEXT_PUBLIC_CAMPAIGNS_LIVE === "true") {
    return NextResponse.next();
  }

  // Unlock + lock endpoints must stay reachable while gated.
  if (pathname === "/api/campaigns/preview-unlock") {
    return NextResponse.next();
  }

  const isCampaignsPage = pathname === "/campaigns" || pathname.startsWith("/campaigns/");
  const isCampaignsApi = pathname.startsWith("/api/campaigns/");

  if (!isCampaignsPage && !isCampaignsApi) {
    return NextResponse.next();
  }

  const secret = previewSecretFromEnv();
  // Local npm run dev with no key configured: leave the prototype open.
  if (process.env.NODE_ENV === "development" && !secret) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(CAMPAIGNS_PREVIEW_COOKIE)?.value;
  if (await isValidCampaignsPreviewCookieAsync(cookie, secret)) {
    return NextResponse.next();
  }

  if (isCampaignsApi) {
    return NextResponse.json(
      { error: "Campaigns are not live yet. Join the fundraising waitlist or unlock with the preview key." },
      { status: 403 }
    );
  }

  // Browser URL stays /campaigns…; coming-soon page has no portal layout/data.
  const url = request.nextUrl.clone();
  url.pathname = "/campaigns-coming-soon";
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/campaigns", "/campaigns/:path*", "/api/campaigns/:path*"],
};
