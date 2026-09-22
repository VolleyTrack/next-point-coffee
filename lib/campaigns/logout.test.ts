import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("logout is one document POST that clears the session before login renders", async () => {
  const button = await readFile(new URL("../../components/campaigns/portal-logout.tsx", import.meta.url), "utf8");
  const route = await readFile(new URL("../../app/api/campaigns/logout/route.ts", import.meta.url), "utf8");
  const helper = await readFile(new URL("./logout.ts", import.meta.url), "utf8");

  assert.match(button, /action="\/api\/campaigns\/logout"/);
  assert.match(button, /method="POST"/);
  assert.match(button, /type="submit"/);
  assert.doesNotMatch(button, /use client/);
  assert.doesNotMatch(button, /router\.(push|refresh)/);
  assert.doesNotMatch(button, /fetch\(/);

  assert.match(route, /export async function POST/);
  assert.match(route, /portalLogoutResponse/);
  assert.match(helper, /NextResponse\.redirect\(login,\s*303\)/);
  assert.match(helper, /PORTAL_SESSION_COOKIE/);
  assert.match(helper, /LEGACY_PORTAL_COOKIE/);
  assert.match(helper, /maxAge:\s*0/);
  assert.match(helper, /\/campaigns\/login/);
});
