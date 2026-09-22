/** Cookie + token helpers safe for Edge middleware and Node route handlers. */

export const CAMPAIGNS_PREVIEW_COOKIE = "npc_campaigns_preview";
export const CAMPAIGNS_PREVIEW_PURPOSE = "next-point-coffee-campaigns-preview-v1";
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export function previewSecretFromEnv(): string | null {
  const key = process.env.CAMPAIGNS_PREVIEW_KEY || process.env.ADMIN_ACCESS_KEY;
  return key && key.length > 0 ? key : null;
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

/** HMAC-SHA256 hex of the preview purpose string; works in Edge and Node. */
export async function campaignsPreviewTokenAsync(secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(CAMPAIGNS_PREVIEW_PURPOSE));
  return toHex(sig);
}

export async function isValidCampaignsPreviewCookieAsync(
  value: string | undefined,
  secret: string | null = previewSecretFromEnv()
): Promise<boolean> {
  if (!secret || !value) return false;
  const expected = await campaignsPreviewTokenAsync(secret);
  return safeEqualHex(value, expected);
}

export function isValidCampaignsPreviewKey(provided: string, secret: string | null = previewSecretFromEnv()): boolean {
  if (!secret || !provided) return false;
  if (provided.length !== secret.length) return false;
  let out = 0;
  for (let i = 0; i < provided.length; i++) {
    out |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return out === 0;
}
