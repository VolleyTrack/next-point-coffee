import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { verifyPassword, hashPassword, generateTemporaryPassword } from "./passwords.ts";
import { isPartnerPortalPath, sanitizePortalNext } from "./portal-paths.ts";
import {
  PORTAL_SESSION_TTL_SECONDS,
  createPortalSessionToken,
  readPortalSessionUserId,
} from "./session-token.ts";

const DEMO_PASSWORDS = [
  "gold-serve-admin",
  "riverside-club",
  "athens-club",
  "maya-season",
  "jordan-court",
  "sam-court",
];

test("partner routes are gated and buyer links are not", () => {
  assert.equal(isPartnerPortalPath("/campaigns/portal"), true);
  assert.equal(isPartnerPortalPath("/campaigns/club"), true);
  assert.equal(isPartnerPortalPath("/campaigns/club/extra"), true);
  assert.equal(isPartnerPortalPath("/campaigns/athlete"), true);
  assert.equal(isPartnerPortalPath("/campaigns/admin"), true);
  assert.equal(isPartnerPortalPath("/campaigns"), false);
  assert.equal(isPartnerPortalPath("/campaigns/login"), false);
  assert.equal(isPartnerPortalPath("/campaigns/thanks"), false);
  assert.equal(isPartnerPortalPath("/campaigns/maya-season-fund"), false);
  assert.equal(sanitizePortalNext("https://evil.example"), null);
  assert.equal(sanitizePortalNext("//evil.example"), null);
  assert.equal(sanitizePortalNext("/campaigns/maya-season-fund"), null);
  assert.equal(sanitizePortalNext("/campaigns/admin", "athlete"), null);
  assert.equal(sanitizePortalNext("/campaigns/club", "club"), "/campaigns/club");
  assert.equal(sanitizePortalNext("/campaigns/portal", "athlete"), "/campaigns/portal");
});

test("session token is signed, expires, and rejects tampering", async () => {
  const secret = "test-secret";
  const now = 1_700_000_000;
  const token = await createPortalSessionToken("user-admin", secret, now);
  assert.equal(await readPortalSessionUserId(token, secret, now + 10), "user-admin");
  assert.equal(await readPortalSessionUserId(token, "other-secret", now + 10), null);
  assert.equal(await readPortalSessionUserId(token, secret, now + PORTAL_SESSION_TTL_SECONDS), null);
  assert.equal(await readPortalSessionUserId(undefined, secret, now), null);
  const flipped = token.endsWith("a") ? `${token.slice(0, -1)}b` : `${token.slice(0, -1)}a`;
  assert.equal(await readPortalSessionUserId(flipped, secret, now + 10), null);
});

test("passwords are bcrypt hashes and temporary passwords are shareable", async () => {
  const password = generateTemporaryPassword();
  assert.equal(password.length, 14);
  assert.match(password, /^[A-HJ-NP-Za-hjkm-np-z2-9]+$/);
  const hashed = await hashPassword(password);
  assert.notEqual(hashed, password);
  assert.match(hashed, /^\$2[ab]\$/);
  assert.equal(await verifyPassword(password, hashed), true);
  assert.equal(await verifyPassword("nope", hashed), false);
});

test("seed demo passwords match the committed bcrypt hashes", async () => {
  const source = await readFile(new URL("./seed.ts", import.meta.url), "utf8");
  const hashes = [...source.matchAll(/passwordHash: "(\$2[ab]\$[^"]+)"/g)].map((match) => match[1]);
  assert.equal(hashes.length, DEMO_PASSWORDS.length);
  for (let i = 0; i < hashes.length; i++) {
    assert.equal(await verifyPassword(DEMO_PASSWORDS[i], hashes[i]), true);
    assert.equal(await verifyPassword("wrong-password", hashes[i]), false);
  }
});
