import nodemailer from "nodemailer";
import { signupListAttachment } from "@/lib/signups-csv";
import {
  buildPartnerLoginEmail,
  partnerLoginsToEmail,
  summarizePartnerEmailDelivery,
  type PartnerEmailSendResult,
} from "@/lib/campaigns/login-email";
import type { IssuedPortalCredential } from "@/lib/campaigns/types";

type Transporter = ReturnType<typeof nodemailer.createTransport>;

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("Signup email skipped: GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

function notifyAddress(): string | undefined {
  return process.env.NOTIFY_EMAIL || process.env.GMAIL_USER;
}

export async function notifyNewSignup(
  email: string,
  context: string,
  alreadySubscribed = false,
  signupCsv?: string
): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) return;

  // Only the configured owner address receives this message. The CSV is an
  // attachment on that one message — never a public download.
  const attachment = signupListAttachment(alreadySubscribed, signupCsv);
  const listNote = attachment
    ? `\n\nThe current master signup list is attached as ${attachment.filename} (newest first).`
    : "";

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      subject: alreadySubscribed
        ? `Waitlist again: ${email}`
        : `New launch signup: ${email}`,
      text: `New newsletter signup\n\nEmail: ${email}\nSource: ${context}\nAlready on list: ${alreadySubscribed}\nTime: ${new Date().toISOString()}${listNote}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#1a1a1a;">${alreadySubscribed ? "Repeat waitlist submit" : "New launch signup"}</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Source:</strong> ${context}</p>
          <p><strong>Already on list:</strong> ${alreadySubscribed ? "yes" : "no"}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          ${
            attachment
              ? `<p>The current master signup list is attached as ${attachment.filename} (newest first).</p>`
              : ""
          }
          <p style="color:#888; font-size:12px; margin-top:24px;">Next Point Coffee Co. automated notification</p>
        </div>
      `,
      attachments: attachment
        ? [
            {
              filename: attachment.filename,
              content: attachment.content,
              contentType: attachment.contentType,
            },
          ]
        : undefined,
    });
  } catch (err) {
    // Log the failure only. Do not include the CSV or recipient list contents.
    const detail = err instanceof Error ? err.message : "Unknown mail error";
    console.error("Failed to send signup notification email:", detail);
  }
}

export async function notifyCampaignRequest(input: {
  organizationName: string;
  organizationType: string;
  contactName: string;
  contactEmail: string;
  phone?: string;
  city?: string;
  athleteName?: string;
  notes?: string;
}): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) {
    console.info("Campaign request saved; email notify skipped (GMAIL_USER / NOTIFY_EMAIL unset).");
    return;
  }

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      replyTo: input.contactEmail,
      subject: `Campaign request: ${input.organizationName}`,
      text: [
        "A club or nonprofit asked Next Point Coffee to start a campaign.",
        "",
        `Organization: ${input.organizationName}`,
        `Type: ${input.organizationType}`,
        `Contact: ${input.contactName} <${input.contactEmail}>`,
        `Phone: ${input.phone || "—"}`,
        `City: ${input.city || "—"}`,
        `Athlete (if named): ${input.athleteName || "—"}`,
        "",
        "Notes:",
        input.notes || "(none)",
        "",
        "Open /campaigns/admin to set this up.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#1a1a1a;">Request to start a campaign</h2>
          <p><strong>Organization:</strong> ${input.organizationName}</p>
          <p><strong>Type:</strong> ${input.organizationType}</p>
          <p><strong>Contact:</strong> ${input.contactName} &lt;${input.contactEmail}&gt;</p>
          <p><strong>Phone:</strong> ${input.phone || "—"}</p>
          <p><strong>City:</strong> ${input.city || "—"}</p>
          <p><strong>Athlete:</strong> ${input.athleteName || "—"}</p>
          <p><strong>Notes:</strong></p>
          <p style="white-space: pre-wrap;">${input.notes || "(none)"}</p>
          <p style="color:#888; font-size:12px; margin-top:24px;">Set this up from the Next Point Coffee admin dashboard.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send campaign request notification:", err);
  }
}

/**
 * Email club and athlete temporary passwords from the Gmail account in GMAIL_USER
 * (ryan@nextpointcoffee.com in production). Admin passwords are never included.
 * Returns a warning string when nothing could be delivered. Does not throw.
 */
export async function emailPartnerTemporaryPasswords(
  credentials: IssuedPortalCredential[],
  context?: { organizationName?: string; campaignName?: string }
): Promise<string | null> {
  const recipients = partnerLoginsToEmail(credentials);
  if (recipients.length === 0) return null;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    console.warn("Partner login email skipped: GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
    return summarizePartnerEmailDelivery(
      recipients.map((row) => ({
        email: row.email,
        role: row.role,
        sent: false,
        reason: "unconfigured",
      }))
    );
  }

  const t = getTransporter();
  if (!t) {
    return summarizePartnerEmailDelivery(
      recipients.map((row) => ({
        email: row.email,
        role: row.role,
        sent: false,
        reason: "unconfigured",
      }))
    );
  }

  const results: PartnerEmailSendResult[] = await Promise.all(
    recipients.map(async (row) => {
      const message = buildPartnerLoginEmail({
        role: row.role,
        name: row.name,
        email: row.email,
        temporaryPassword: row.temporaryPassword,
        organizationName: context?.organizationName,
        campaignName: context?.campaignName,
      });
      try {
        await t.sendMail({
          from: `"Next Point Coffee" <${user}>`,
          to: row.email,
          replyTo: user,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        return { email: row.email, role: row.role, sent: true };
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Unknown mail error";
        console.error("Failed to send partner login email:", detail);
        return { email: row.email, role: row.role, sent: false, reason: "failed" };
      }
    })
  );

  return summarizePartnerEmailDelivery(results);
}

/**
 * Internal alert when a paid order could not be stored in books.
 * Uses the same Gmail account and NOTIFY_EMAIL inbox as other site alerts.
 * Does not throw.
 */
export async function notifyBooksIngestFailure(notice: { subject: string; text: string }): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) {
    console.error(
      JSON.stringify({
        source: "next-point-coffee",
        event: "books.ingest.email_unconfigured",
        email_subject: notice.subject,
        email_text: notice.text,
      })
    );
    return;
  }

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      subject: notice.subject,
      text: notice.text,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown mail error";
    console.error(
      JSON.stringify({
        source: "next-point-coffee",
        event: "books.ingest.email_failed",
        error: detail,
        email_subject: notice.subject,
        email_text: notice.text,
      })
    );
  }
}

/**
 * Customer-facing mail from GMAIL_USER. Throws when Gmail is not configured
 * or the send fails so the caller can log it without failing checkout.
 */
export async function sendCustomerMail(input: {
  to: string;
  fromName: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const user = process.env.GMAIL_USER;
  const t = getTransporter();
  if (!t || !user) {
    throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
  }
  await t.sendMail({
    from: `"${input.fromName}" <${user}>`,
    to: input.to,
    replyTo: input.replyTo,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

/**
 * Internal notification (e.g. the new-order alert) from GMAIL_USER to an
 * explicit inbox. Throws when Gmail is not configured or the send fails so the
 * caller can log it; callers must catch.
 */
export async function sendInternalMail(input: {
  to: string;
  replyTo?: string | null;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  const user = process.env.GMAIL_USER;
  const t = getTransporter();
  if (!t || !user) {
    throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
  }
  await t.sendMail({
    from: `"Next Point Coffee Orders" <${user}>`,
    to: input.to,
    replyTo: input.replyTo || undefined,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

/**
 * Ops alert when a paid customer's confirmation email did not send.
 * Same Gmail account and NOTIFY_EMAIL inbox as other site alerts. Does not throw.
 */
export async function notifyOrderConfirmationFailure(notice: { subject: string; text: string }): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) {
    console.error(
      JSON.stringify({
        source: "next-point-coffee",
        event: "orders.confirmation_email.alert_unconfigured",
        email_subject: notice.subject,
        email_text: notice.text,
      })
    );
    return;
  }

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      subject: notice.subject,
      text: notice.text,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown mail error";
    console.error(
      JSON.stringify({
        source: "next-point-coffee",
        event: "orders.confirmation_email.alert_failed",
        error: detail,
        email_subject: notice.subject,
        email_text: notice.text,
      })
    );
  }
}

export async function notifyContactForm(name: string, email: string, message: string): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) return;

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      replyTo: email,
      subject: `New contact form message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#1a1a1a;">New Contact Form Message</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Message:</strong></p>
          <p style="white-space: pre-wrap;">${message}</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send contact form notification email:", err);
  }
}
