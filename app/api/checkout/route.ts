import { NextResponse } from "next/server";
import { retailCheckoutSessionParams, resolveRetailCart } from "@/lib/retail-checkout";
import { getStripe } from "@/lib/stripe";
import { storeLive } from "@/lib/site";

export async function POST(request: Request) {
  if (!storeLive) {
    return NextResponse.json(
      { error: "The store isn't live yet — check back soon!" },
      { status: 403 }
    );
  }

  let body: { items?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }

  const cart = resolveRetailCart(body?.items);
  if (!cart.ok) {
    return NextResponse.json({ error: cart.error }, { status: cart.status });
  }

  try {
    const stripe = getStripe();
    const origin = request.headers.get("origin") || `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;

    // Shipping is included in product.priceCents. Collect an address for fulfillment only.
    const session = await stripe.checkout.sessions.create(
      retailCheckoutSessionParams(cart.lines, origin)
    );

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("Checkout session creation failed:", err);
    return NextResponse.json({ error: "Could not start checkout. Please try again." }, { status: 500 });
  }
}
