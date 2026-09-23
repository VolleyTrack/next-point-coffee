import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { applyPortalPasswordChange, hashPassword, verifyPassword } from "./passwords.ts";
import type { PortalUser } from "./types.ts";

async function temporaryUser(password: string): Promise<PortalUser> {
  return {
    id: "user-new",
    role: "club",
    name: "Club Manager",
    email: "club@example.com",
    passwordHash: await hashPassword(password),
    mustChangePassword: true,
  };
}

test("first sign-in replaces the temporary password and clears the flag", async () => {
  const user = await temporaryUser("TempPass1234");
  await assert.rejects(() => applyPortalPasswordChange(user, "short", "short"), /at least 8 characters/);
  await assert.rejects(
    () => applyPortalPasswordChange(user, "long-enough", "different"),
    /do not match/
  );
  await assert.rejects(
    () => applyPortalPasswordChange(user, "TempPass1234", "TempPass1234"),
    /different password than the temporary one/
  );
  assert.equal(user.mustChangePassword, true);
  assert.equal(await verifyPassword("TempPass1234", user.passwordHash!), true);

  await applyPortalPasswordChange(user, "season-fund-9", "season-fund-9");
  assert.equal(user.mustChangePassword, false);
  assert.equal(await verifyPassword("TempPass1234", user.passwordHash!), false);
  assert.equal(await verifyPassword("season-fund-9", user.passwordHash!), true);
  await assert.rejects(
    () => applyPortalPasswordChange(user, "another-password", "another-password"),
    /already has a password/
  );
});

test("seed accounts skip forced password change; new admin users do not", async () => {
  const seed = await readFile(new URL("./seed.ts", import.meta.url), "utf8");
  const store = await readFile(new URL("./store.ts", import.meta.url), "utf8");
  const auth = await readFile(new URL("./auth.ts", import.meta.url), "utf8");
  const session = await readFile(new URL("../../app/api/campaigns/session/route.ts", import.meta.url), "utf8");
  const admin = await readFile(new URL("../../app/api/campaigns/admin/route.ts", import.meta.url), "utf8");
  const mailer = await readFile(new URL("../mailer.ts", import.meta.url), "utf8");

  assert.equal(seed.match(/mustChangePassword: false/g)?.length, 6);
  assert.equal(seed.includes("mustChangePassword: true"), false);
  assert.match(store, /mustChangePassword: true/);
  assert.match(auth, /mustChangePassword/);
  assert.match(auth, /CHANGE_PASSWORD_PATH/);
  assert.match(session, /postLoginPath/);
  assert.match(admin, /emailPartnerTemporaryPasswords/);
  assert.match(mailer, /emailPartnerTemporaryPasswords/);
  assert.match(mailer, /GMAIL_USER/);
  assert.match(mailer, /GMAIL_APP_PASSWORD/);
  assert.doesNotMatch(mailer, /role === "admin"/);
});
