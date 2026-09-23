import assert from "node:assert/strict";
import test from "node:test";
import {
  PARTNER_LOGIN_URL,
  buildPartnerLoginEmail,
  partnerLoginsToEmail,
  summarizePartnerEmailDelivery,
} from "./login-email.ts";
import type { IssuedPortalCredential } from "./types.ts";

const club: IssuedPortalCredential = {
  role: "club",
  name: "Riverside Volleyball Club Manager",
  email: "coach@riverside.example",
  temporaryPassword: "TempClubPass99",
};

const athlete: IssuedPortalCredential = {
  role: "athlete",
  name: "Maya <Chen>",
  email: "maya@riverside.example",
  temporaryPassword: "TempAthlete88",
};

test("partner login emails name the role, address, password, and first-sign-in rule", () => {
  const message = buildPartnerLoginEmail({
    ...club,
    organizationName: "Riverside Volleyball Club",
    campaignName: "Maya's Season Fund",
  });
  assert.equal(message.subject, "Your Next Point Coffee club login");
  assert.match(message.text, /This login is for the club/);
  assert.match(message.text, /coach@riverside\.example/);
  assert.match(message.text, /TempClubPass99/);
  assert.match(message.text, new RegExp(PARTNER_LOGIN_URL.replaceAll(".", "\\.")));
  assert.match(message.text, /first sign-in/);
  assert.match(message.text, /choose your own password/);
  assert.match(message.text, /Riverside Volleyball Club/);
  assert.match(message.text, /Maya's Season Fund/);
  assert.match(message.html, /https:\/\/nextpointcoffee\.com\/campaigns\/login/);

  const athleteMessage = buildPartnerLoginEmail(athlete);
  assert.match(athleteMessage.subject, /athlete login/);
  assert.match(athleteMessage.text, /This login is for the athlete/);
  assert.match(athleteMessage.html, /Maya &lt;Chen&gt;/);
  assert.doesNotMatch(athleteMessage.html, /Maya <Chen>/);
});

test("admin credentials are not emailed", () => {
  const admin: IssuedPortalCredential = {
    role: "admin",
    name: "Next Point Coffee Admin",
    email: "admin@nextpointcoffee.com",
    temporaryPassword: "do-not-send",
  };
  const recipients = partnerLoginsToEmail([admin, club, athlete]);
  assert.deepEqual(
    recipients.map((row) => row.role),
    ["club", "athlete"]
  );
  assert.equal(
    recipients.some((row) => row.temporaryPassword === "do-not-send"),
    false
  );
});

test("email delivery warnings stay on screen without dropping the logins", () => {
  assert.equal(
    summarizePartnerEmailDelivery([
      { email: club.email, role: "club", sent: true },
      { email: athlete.email, role: "athlete", sent: true },
    ]),
    null
  );
  const unconfigured = summarizePartnerEmailDelivery([
    { email: club.email, role: "club", sent: false, reason: "unconfigured" },
    { email: athlete.email, role: "athlete", sent: false, reason: "unconfigured" },
  ]);
  assert.match(unconfigured ?? "", /GMAIL_USER/);
  assert.match(unconfigured ?? "", /coach@riverside\.example/);
  assert.match(unconfigured ?? "", /maya@riverside\.example/);
  const failed = summarizePartnerEmailDelivery([
    { email: club.email, role: "club", sent: true },
    { email: athlete.email, role: "athlete", sent: false, reason: "failed" },
  ]);
  assert.match(failed ?? "", /maya@riverside\.example/);
  assert.doesNotMatch(failed ?? "", /coach@riverside\.example/);
});
