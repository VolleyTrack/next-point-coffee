import { NextResponse } from "next/server";
import { booksIngestLog, isPaidCheckout, type CheckoutOrderInput } from "@/lib/books/order-ingest";
import { recordPaidCheckout } from "@/lib/books/sync-paid-order";
import { getCampaignById, recordSale } from "@/lib/campaigns/store";
import { markOrderPaymentIncomplete } from "@/lib/orders";
import { getStripe } from "@/lib/stripe";
import { paidRetailPaymentSummary } from "@/lib/stripe-order-summary";
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

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handlePaidCheckout(session);
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await markOrderPaymentIncomplete(session.id, session.payment_status ?? "unpaid");
      booksIngestLog("warn", "books.ingest.payment_failed", { stripe_session_id: session.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not mark the payment incomplete";
      booksIngestLog("error", "books.ingest.payment_failed", {
        stripe_session_id: session.id,
        error: message,
      });
    }
  }

  // Books being down must not make Stripe retry as a failed payment.
  return NextResponse.json({ received: true });
}

async function handlePaidCheckout(session: Stripe.Checkout.Session) {
  try {
    const stripe = getStripe();
    const fullSession = await stripe.checkout.sessions.retrieve(session.id, {
      expand: ["line_items"],
    });
    const input = checkoutInputFromStripe(fullSession);
    const campaign = await resolveCampaign(input.metadata);
    const saved = await recordPaidCheckout(input, campaign);
    await refreshPaymentSummary(stripe, fullSession);

    const campaignId = input.metadata?.campaignId;
    const productSlug = input.metadata?.productSlug;
    const paid = isPaidCheckout(saved.order?.payment_status ?? input.payment_status);
    if (paid && campaignId && productSlug) {
      try {
        await recordSale({
          campaignId,
          productSlug,
          quantity: Number(input.metadata?.quantity ?? 1),
          buyerName: input.metadata?.buyerName || input.customer_name || "Supporter",
          buyerEmail: input.customer_email,
          source: "stripe",
          stripeSessionId: fullSession.id,
          shippingCents: input.amount_shipping,
        });
      } catch (err) {
        console.error("Failed to record campaign sale:", err);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record paid checkout";
    booksIngestLog("error", "orders.record.failed", {
      stripe_session_id: session.id,
      error: message,
    });
  }
}

/**
 * Rewrite the Stripe payment description with the final bag counts
 * ("2 × First Serve — Whole bean"). Shoppers can change quantity on the
 * Stripe page, so the description set at session creation can be stale.
 * Best effort: a failure here never affects the order.
 */
async function refreshPaymentSummary(stripe: Stripe, session: Stripe.Checkout.Session) {
  const update = paidRetailPaymentSummary(session);
  if (!update) return;
  try {
    await stripe.paymentIntents.update(update.paymentIntentId, {
      description: update.description,
      metadata: update.metadata,
    });
  } catch (err) {
    console.error("Could not update the Stripe payment description:", err instanceof Error ? err.message : err);
  }
}

function checkoutInputFromStripe(session: Stripe.Checkout.Session): CheckoutOrderInput {
  return {
    id: session.id,
    created: session.created ?? null,
    amount_subtotal: session.amount_subtotal ?? 0,
    amount_shipping: session.total_details?.amount_shipping ?? 0,
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
    payment_status: session.payment_status ?? null,
    customer_email: session.customer_details?.email ?? session.customer_email ?? "unknown",
    customer_name: session.customer_details?.name ?? null,
    shipping_address: session.customer_details?.address ?? null,
    line_items: session.line_items?.data ?? [],
    metadata: session.metadata ?? null,
  };
}

async function resolveCampaign(metadata: Record<string, string> | null) {
  const campaignId = metadata?.campaignId;
  if (!campaignId) return null;
  try {
    const campaign = await getCampaignById(campaignId);
    if (!campaign) {
      booksIngestLog("error", "books.ingest.campaign_unresolved", { campaign_id: campaignId });
      return null;
    }
    return {
      id: campaign.id,
      name: campaign.name,
      bagShareCents: campaign.organization.bagShareCents,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Campaign lookup failed";
    booksIngestLog("error", "books.ingest.campaign_lookup_failed", { campaign_id: campaignId, error: message });
    return null;
  }
}
