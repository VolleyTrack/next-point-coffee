import type { PortalRole } from "./types";

/** First-sign-in screen. Session required; portal dashboards stay closed until the password changes. */
export const CHANGE_PASSWORD_PATH = "/campaigns/change-password";

const PARTNER_PREFIXES = [
  "/campaigns/portal",
  "/campaigns/club",
  "/campaigns/athlete",
  "/campaigns/admin",
  CHANGE_PASSWORD_PATH,
] as const;

/** Club, athlete, and Next Point Coffee admin pages. Buyer share links are not included. */
export function isPartnerPortalPath(pathname: string): boolean {
  return PARTNER_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function portalHome(role: PortalRole): string {
  switch (role) {
    case "admin":
      return "/campaigns/admin";
    case "club":
      return "/campaigns/club";
    case "athlete":
      return "/campaigns/athlete";
  }
}

/**
 * Partner-portal paths only. Drops protocol-relative and buyer campaign URLs
 * so a login redirect cannot leave this site or open a public share link as "next".
 */
export function sanitizePortalNext(value: string | undefined | null, role?: PortalRole): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("://")) {
    return null;
  }
  const path = value.split("?")[0]?.split("#")[0] ?? "";
  if (!isPartnerPortalPath(path)) return null;
  if (!role) return path;
  const home = portalHome(role);
  if (path === "/campaigns/portal" || path === home || path.startsWith(`${home}/`)) return path;
  return null;
}

/** After a successful sign-in, open that role's dashboard. A generic portal redirect does too. */
export function loginDestination(next: string | undefined | null, role: PortalRole): string {
  const safe = sanitizePortalNext(next, role);
  if (!safe || safe === "/campaigns/portal") return portalHome(role);
  return safe;
}

/** Temporary passwords land on the change screen. Everyone else goes to their dashboard. */
export function postLoginPath(
  user: { role: PortalRole; mustChangePassword?: boolean },
  next?: string | null
): string {
  if (user.mustChangePassword) return CHANGE_PASSWORD_PATH;
  return loginDestination(next, user.role);
}
