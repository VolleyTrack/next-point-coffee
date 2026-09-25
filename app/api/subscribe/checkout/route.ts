import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { storeLive } from "@/lib/site";
import { parseSubscriptionSelection, subscriptionCheckoutSessionParams } from "@/lib/subscription";

export async function POST(request: Request) {
  if (!storeLive) {
    return NextResponse.json(
      { error: "Subscriptions open when the store goes live. Join the waitlist!" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Build your subscription to continue." }, { status: 400 });
  }

  const parsed = parseSubscriptionSelection(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const stripe = getStripe();
    const origin = request.headers.get("origin") || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    const session = await stripe.checkout.sessions.create(subscriptionCheckoutSessionParams(parsed.selection, origin));
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Subscription checkout session creation failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
