import type { PortalRole } from "./types";

const PARTNER_PREFIXES = ["/campaigns/portal", "/campaigns/club", "/campaigns/athlete", "/campaigns/admin"] as const;

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
