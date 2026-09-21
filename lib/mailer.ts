import nodemailer from "nodemailer";

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
  alreadySubscribed = false
): Promise<void> {
  const t = getTransporter();
  const to = notifyAddress();
  if (!t || !to) return;

  try {
    await t.sendMail({
      from: `"Next Point Coffee" <${process.env.GMAIL_USER}>`,
      to,
      subject: alreadySubscribed
        ? `Waitlist again: ${email}`
        : `New launch signup: ${email}`,
      text: `New newsletter signup\n\nEmail: ${email}\nSource: ${context}\nAlready on list: ${alreadySubscribed}\nTime: ${new Date().toISOString()}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px;">
          <h2 style="color:#1a1a1a;">${alreadySubscribed ? "Repeat waitlist submit" : "New launch signup"}</h2>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Source:</strong> ${context}</p>
          <p><strong>Already on list:</strong> ${alreadySubscribed ? "yes" : "no"}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          <p style="color:#888; font-size:12px; margin-top:24px;">Next Point Coffee Co. automated notification</p>
        </div>
      `,
    });
  } catch (err) {
    console.error("Failed to send signup notification email:", err);
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
