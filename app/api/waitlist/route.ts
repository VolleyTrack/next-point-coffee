import { NextResponse } from "next/server";
import { assessPublicFormSubmission, rejectBotSubmission } from "@/lib/bot-check";
import { notifyNewSignup } from "@/lib/mailer";
import { addSignup, listSignups } from "@/lib/newsletter";
import { signupsToCsv } from "@/lib/signups-csv";

export async function POST(request: Request) {
  const body = await request.json();
  const email = typeof body?.email === "string" ? body.email : "";
  if (
    rejectBotSubmission(
      "waitlist",
      assessPublicFormSubmission(body, { emails: email ? [email] : [] })
    )
  ) {
    return NextResponse.json({ success: true, alreadySubscribed: false });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  const context = typeof body.context === "string" && body.context ? body.context : "general";

  let alreadySubscribed: boolean;
  try {
    ({ alreadySubscribed } = await addSignup(email, context));
  } catch (err) {
    console.error("Waitlist signup failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  // Email and the CSV are best-effort. A stored signup must still return success.
  const signupCsv = alreadySubscribed ? undefined : await loadSignupCsv();
  try {
    // Await so Vercel does not freeze the function before Gmail sends.
    await notifyNewSignup(email, context, alreadySubscribed, signupCsv);
  } catch (err) {
    console.error("Signup notification failed after the signup was stored.");
    if (err instanceof Error && !err.message.includes("@")) {
      console.error(err.message);
    }
  }

  return NextResponse.json({ success: true, alreadySubscribed });
}

async function loadSignupCsv(): Promise<string | undefined> {
  try {
    const rows = await listSignups();
    return signupsToCsv(rows);
  } catch {
    // Do not log the Supabase body; a failed read can echo row data.
    console.error("Failed to build signup list CSV for owner notification.");
    return undefined;
  }
}
