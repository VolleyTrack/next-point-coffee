import type { IssuedPortalCredential, PortalRole } from "./types";

/** Public partner sign-in. Temporary-password emails always use this URL. */
export const PARTNER_LOGIN_URL = "https://nextpointcoffee.com/campaigns/login";

export interface PartnerLoginEmailContent {
  role: "club" | "athlete";
  name: string;
  email: string;
  temporaryPassword: string;
  organizationName?: string;
  campaignName?: string;
}

export interface PartnerLoginEmailMessage {
  subject: string;
  text: string;
  html: string;
}

export interface PartnerEmailSendResult {
  email: string;
  role: "club" | "athlete";
  sent: boolean;
  reason?: "unconfigured" | "failed";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function roleNoun(role: "club" | "athlete"): string {
  return role === "club" ? "club" : "athlete";
}

/** Guard so a future admin credential cannot be passed through as a partner login email. */
export function isPartnerLoginRole(role: PortalRole): role is "club" | "athlete" {
  return role === "club" || role === "athlete";
}

/** Club and athlete temporary passwords only. Never the Next Point Coffee admin password. */
export function partnerLoginsToEmail(
  credentials: IssuedPortalCredential[]
): Array<IssuedPortalCredential & { role: "club" | "athlete" }> {
  return credentials.filter(
    (row): row is IssuedPortalCredential & { role: "club" | "athlete" } => isPartnerLoginRole(row.role)
  );
}

export function buildPartnerLoginEmail(input: PartnerLoginEmailContent): PartnerLoginEmailMessage {
  const who = roleNoun(input.role);
  const subject = `Your Next Point Coffee ${who} login`;
  const organizationLine = input.organizationName?.trim()
    ? `Organization: ${input.organizationName.trim()}`
    : "";
  const campaignLine = input.campaignName?.trim() ? `Campaign: ${input.campaignName.trim()}` : "";
  const detailLines = [
    `This login is for the ${who}.`,
    organizationLine,
    campaignLine,
    `Name: ${input.name}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.temporaryPassword}`,
  ].filter(Boolean);

  const text = [
    "Next Point Coffee Co.",
    "",
    `Your ${who} login is ready.`,
    "",
    ...detailLines,
    "",
    `Sign in: ${PARTNER_LOGIN_URL}`,
    "",
    "On your first sign-in you must choose your own password before you can use the portal.",
    "This temporary password stops working after you change it.",
    "",
    "You can't change the last point. Own the next.",
    "Ryan",
    "Next Point Coffee Co.",
    "ryan@nextpointcoffee.com",
  ].join("\n");

  const htmlDetails = detailLines
    .map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`)
    .join("");

  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 520px; color: #1c1610;">
      <p style="font-family: Arial, sans-serif; letter-spacing: 0.14em; text-transform: uppercase; font-size: 12px; color: #8a7340; margin: 0;">
        Next Point Coffee Co.
      </p>
      <h1 style="font-size: 26px; line-height: 1.2; margin: 12px 0 16px;">Your ${escapeHtml(who)} login is ready.</h1>
      ${htmlDetails}
      <p style="margin: 16px 0;">
        <a href="${PARTNER_LOGIN_URL}" style="color: #8a7340;">Sign in at ${PARTNER_LOGIN_URL}</a>
      </p>
      <p style="margin: 0 0 8px;">
        On your first sign-in you must choose your own password before you can use the portal.
        This temporary password stops working after you change it.
      </p>
      <p style="margin: 24px 0 0; color: #5c5346;">You can't change the last point. Own the next.</p>
      <p style="margin: 8px 0 0; font-family: Arial, sans-serif; font-size: 13px; color: #5c5346;">
        Ryan · Next Point Coffee Co. · ryan@nextpointcoffee.com
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

export function summarizePartnerEmailDelivery(results: PartnerEmailSendResult[]): string | null {
  const failed = results.filter((row) => !row.sent);
  if (failed.length === 0) return null;
  const list = failed.map((row) => row.email).join(", ");
  if (failed.every((row) => row.reason === "unconfigured")) {
    return `Logins were created, but email could not be sent because Gmail is not configured (GMAIL_USER / GMAIL_APP_PASSWORD). Copy the passwords below and send them to ${list}.`;
  }
  return `Logins were created, but the temporary-password email failed for ${list}. Copy the passwords below and send them yourself.`;
}
