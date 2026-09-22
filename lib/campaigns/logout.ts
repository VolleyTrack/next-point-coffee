import { NextResponse } from "next/server";
import { LEGACY_PORTAL_COOKIE, PORTAL_SESSION_COOKIE, portalSessionCookieOptions } from "./session-token";

/**
 * Clear both the signed session and the old unsigned demo cookie.
 * Max-Age=0 plus an Expires in the past matches the session cookie
 * (no Max-Age when it was set) so the browser drops it immediately.
 */
export function clearPortalSessionCookies(response: NextResponse): NextResponse {
  const clearing = {
    ...portalSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  };
  response.cookies.set(PORTAL_SESSION_COOKIE, "", clearing);
  response.cookies.set(LEGACY_PORTAL_COOKIE, "", clearing);
  return response;
}

/**
 * One response clears the cookie and sends the browser to the login page.
 * A client-side router.push("/campaigns/login") is not safe: that page
 * redirects anyone who still has a session back to their portal home, and
 * router.refresh() races the soft navigation, so the first click often
 * lands back on the page the user was already on.
 */
export function portalLogoutResponse(request: Request): NextResponse {
  const login = new URL("/campaigns/login", request.url);
  const response = NextResponse.redirect(login, 303);
  response.headers.set("Cache-Control", "no-store");
  return clearPortalSessionCookies(response);
}
