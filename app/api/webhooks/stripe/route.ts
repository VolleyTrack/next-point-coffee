import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { recordOrder } from "@/lib/orders";
import { recordSale } from "@/lib/campaigns/store";
import type Stripe from "stripe";

export async function POST(request: Request) {
  const sig = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      const stripe = getStripe();
      const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["line_items"],
      });

      try {
        await recordOrder({
          stripe_session_id: fullSession.id,
          customer_email: fullSession.customer_details?.email ?? "unknown",
          customer_name: fullSession.customer_details?.name ?? null,
          shipping_address: fullSession.customer_details?.address ?? null,
          line_items: fullSession.line_items?.data ?? [],
          amount_subtotal: fullSession.amount_subtotal ?? 0,
          amount_shipping: fullSession.total_details?.amount_shipping ?? 0,
          amount_total: fullSession.amount_total ?? 0,
          currency: fullSession.currency ?? "usd",
          payment_status: fullSession.payment_status ?? "unknown",
        });
      } catch (err) {
        console.error("Failed to record shop order:", err);
      }

      const campaignId = fullSession.metadata?.campaignId;
      const productSlug = fullSession.metadata?.productSlug;
      if (campaignId && productSlug) {
        await recordSale({
          campaignId,
          productSlug,
          quantity: Number(fullSession.metadata?.quantity ?? 1),
          buyerName: fullSession.metadata?.buyerName || fullSession.customer_details?.name || "Supporter",
          buyerEmail: fullSession.customer_details?.email ?? "unknown",
          source: "stripe",
          stripeSessionId: fullSession.id,
          shippingCents: fullSession.total_details?.amount_shipping ?? 0,
        });
      }
    } catch (err) {
      console.error("Failed to record campaign sale:", err);
    }
  }

  return NextResponse.json({ received: true });
}
