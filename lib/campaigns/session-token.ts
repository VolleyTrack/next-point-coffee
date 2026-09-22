/** Signed portal session cookie. Safe for Edge middleware and Node route handlers. */

export const PORTAL_SESSION_COOKIE = "npc_portal_session";
/** Unsigned demo cookie from the role switcher. Ignored and cleared on login/logout. */
export const LEGACY_PORTAL_COOKIE = "npc_portal_user";
export const PORTAL_SESSION_PURPOSE = "next-point-coffee-portal-session-v1";
/**
 * Absolute lifetime inside the HMAC payload.
 * The Set-Cookie header omits Max-Age, so browsers drop it when they close.
 * This expiry still ends a session that a browser restores, or one left open.
 */
export const PORTAL_SESSION_TTL_SECONDS = 60 * 60 * 12;

const DEV_FALLBACK_SECRET = "next-point-coffee-portal-dev-session";

export function portalSessionSecret(): string | null {
  const fromEnv =
    process.env.PORTAL_SESSION_SECRET ||
    process.env.ADMIN_ACCESS_KEY ||
    process.env.CAMPAIGNS_PREVIEW_KEY ||
    "";
  if (fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV !== "production") return DEV_FALLBACK_SECRET;
  return null;
}

export function portalSessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function signPayload(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${PORTAL_SESSION_PURPOSE}.${payload}`));
  return toHex(sig);
}

export async function createPortalSessionToken(
  userId: string,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string> {
  const payload = base64UrlEncode(
    JSON.stringify({ uid: userId, exp: nowSeconds + PORTAL_SESSION_TTL_SECONDS })
  );
  const sig = await signPayload(secret, payload);
  return `${payload}.${sig}`;
}

export async function readPortalSessionUserId(
  token: string | undefined,
  secret: string | null,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<string | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = await signPayload(secret, payload);
  if (!safeEqualHex(sig, expected)) return null;
  const json = base64UrlDecode(payload);
  if (!json) return null;
  let parsed: { uid?: unknown; exp?: unknown };
  try {
    parsed = JSON.parse(json) as { uid?: unknown; exp?: unknown };
  } catch {
    return null;
  }
  if (typeof parsed.uid !== "string" || parsed.uid.length === 0) return null;
  if (typeof parsed.exp !== "number" || !Number.isFinite(parsed.exp) || parsed.exp <= nowSeconds) return null;
  return parsed.uid;
}
