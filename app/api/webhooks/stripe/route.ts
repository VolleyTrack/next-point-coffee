import { NextResponse } from "next/server";
import { booksIngestLog, isPaidCheckout, type CheckoutOrderInput } from "@/lib/books/order-ingest";
import { recordPaidCheckout } from "@/lib/books/sync-paid-order";
import { getCampaignById, recordSale } from "@/lib/campaigns/store";
import { checkoutCustomerFromSession } from "@/lib/checkout-customer";
import { markOrderPaymentIncomplete } from "@/lib/orders";
import { sendOrderAlert, wasOrderPaid } from "@/lib/send-order-alert";
import { sendOrderConfirmation } from "@/lib/send-order-confirmation";
import { getStripe } from "@/lib/stripe";
import { paidRetailPaymentSummary } from "@/lib/stripe-order-summary";
import {
  frequencyWeeks,
  isSubscriptionRenewal,
  renewalOrderInput,
  selectionFromPlanMetadata,
  subscriptionCycleIndex,
  subscriptionIdFromInvoice,
} from "@/lib/subscription";
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

  // Subscription renewals (every 2/4/6 weeks) become their own paid order.
  // The first subscription payment is recorded by checkout.session.completed above.
  if (event.type === "invoice.paid") {
    const invoice = event.data.object as Stripe.Invoice;
    if (isSubscriptionRenewal(invoice)) await handleSubscriptionRenewal(invoice);
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
    // Read before the upsert so the internal alert can tell a first payment from a redelivery.
    const wasPaidBefore = await wasOrderPaid(fullSession.id);
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

    if (saved.order?.payment_status === "paid") {
      try {
        await sendOrderConfirmation(saved.order);
      } catch (err) {
        console.error("Pre-order confirmation email failed:", err);
      }
    }

    // Internal "new order" email to ORDER_ALERT_EMAIL (default info@). Never throws.
    if (saved.order?.payment_status === "paid") {
      try {
        await sendOrderAlert(saved.order, {
          wasPaidBefore,
          placedAt: fullSession.created ?? null,
          phone: fullSession.customer_details?.phone ?? null,
          discountCents: fullSession.total_details?.amount_discount ?? null,
          promoCode: await checkoutPromoCode(stripe, fullSession),
        });
      } catch (err) {
        console.error("Internal order alert failed:", err instanceof Error ? err.message : err);
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

async function handleSubscriptionRenewal(invoice: Stripe.Invoice) {
  try {
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) {
      booksIngestLog("error", "subscription.renewal.no_subscription", { invoice_id: invoice.id });
      return;
    }
    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ["customer"] });
    const selection = selectionFromPlanMetadata(subscription.metadata);
    if (!selection) {
      booksIngestLog("warn", "subscription.renewal.not_coffee_plan", { invoice_id: invoice.id });
      return;
    }
    const periodStart = invoice.lines?.data?.[0]?.period?.start ?? invoice.period_end;
    const cycle = subscriptionCycleIndex(periodStart, subscription.billing_cycle_anchor, frequencyWeeks(selection.frequency));
    const customer =
      subscription.customer && typeof subscription.customer === "object" && !("deleted" in subscription.customer && subscription.customer.deleted)
        ? (subscription.customer as Stripe.Customer)
        : null;
    const input = renewalOrderInput(
      {
        id: invoice.id ?? "",
        created: invoice.status_transitions?.paid_at ?? invoice.created,
        subtotal: invoice.subtotal,
        amount_paid: invoice.amount_paid,
        currency: invoice.currency,
        customer_email: invoice.customer_email ?? customer?.email ?? null,
        customer_name: invoice.customer_name ?? customer?.name ?? null,
        customer_shipping: invoice.customer_shipping,
        quantity: invoice.lines?.data?.[0]?.quantity ?? null,
      },
      selection,
      cycle,
      customer?.shipping ?? null
    );
    // No pre-order confirmation email on renewals. Stripe sends the receipt.
    await recordPaidCheckout(input, null);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record subscription renewal";
    booksIngestLog("error", "orders.record.failed", { stripe_invoice_id: invoice.id, error: message });
  }
}

/**
 * Promotion code the shopper typed (e.g. LAUNCH10), for the internal alert only.
 * Best effort: any Stripe error returns null and never affects the order.
 */
async function checkoutPromoCode(stripe: Stripe, session: Stripe.Checkout.Session): Promise<string | null> {
  try {
    for (const discount of session.discounts ?? []) {
      const promo = discount.promotion_code;
      if (promo && typeof promo === "object" && promo.code) return promo.code;
      if (typeof promo === "string" && promo) {
        const found = await stripe.promotionCodes.retrieve(promo);
        if (found.code) return found.code;
      }
      const coupon = discount.coupon;
      if (coupon && typeof coupon === "object" && coupon.name) return coupon.name;
    }
  } catch (err) {
    console.error("Could not read the checkout promotion code:", err instanceof Error ? err.message : err);
  }
  return null;
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
    ...checkoutCustomerFromSession(session),
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
