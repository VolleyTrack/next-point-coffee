import { NextResponse } from "next/server";
import { addSignup } from "@/lib/newsletter";
import { notifyNewSignup } from "@/lib/mailer";

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.email || typeof body.email !== "string" || !body.email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    const { alreadySubscribed } = await addSignup(body.email, body.context ?? "general");
    if (!alreadySubscribed) {
      // Fire-and-forget — never let email delivery block or fail the signup response.
      notifyNewSignup(body.email, body.context ?? "general");
    }
    return NextResponse.json({ success: true, alreadySubscribed });
  } catch (err) {
    console.error("Waitlist signup failed:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
