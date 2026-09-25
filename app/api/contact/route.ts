import { NextResponse } from "next/server";
import { assessPublicFormSubmission, rejectBotSubmission } from "@/lib/bot-check";
import { notifyContactForm } from "@/lib/mailer";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, message } = body ?? {};
  if (
    rejectBotSubmission(
      "contact",
      assessPublicFormSubmission(body, { emails: typeof email === "string" ? [email] : [] })
    )
  ) {
    return NextResponse.json({ success: true });
  }

  if (!name || !email || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  try {
    await notifyContactForm(name, email, message);
  } catch (err) {
    console.error("Contact form email failed:", err);
    // Don't fail the request just because email delivery had an issue.
  }

  return NextResponse.json({ success: true });
}
