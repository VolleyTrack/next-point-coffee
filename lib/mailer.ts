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
