import { sendInternalMail } from "@/lib/mailer";
import { getOrderBySessionId, markOrderAlertSent, type OrderRow } from "@/lib/orders";
import {
  deliverOrderAlert,
  orderAlertLog,
  type OrderAlertContext,
  type OrderAlertDelivery,
} from "@/lib/order-alert";

/**
 * Internal "new order" email to ORDER_ALERT_EMAIL (default info@nextpointcoffee.com)
 * through the existing Gmail account (GMAIL_USER / GMAIL_APP_PASSWORD).
 * Never throws, so it cannot affect order saving, books, or the customer email.
 *
 * Call wasOrderPaid(id) BEFORE recordPaidCheckout, then sendOrderAlert(saved.order, ...)
 * after it. `id` is the value stored in orders.stripe_session_id (checkout session
 * id, or the invoice id for subscription renewals).
 */
export function sendOrderAlert(order: OrderRow | null, context: OrderAlertContext): Promise<OrderAlertDelivery> {
  return deliverOrderAlert(order, context, {
    send: (message) =>
      sendInternalMail({
        to: message.to,
        replyTo: message.replyTo,
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    markSent: markOrderAlertSent,
  });
}

/** true/false = row existed and was / was not paid; null = no row or lookup failed. Never throws. */
export async function wasOrderPaid(stripeSessionId: string): Promise<boolean | null> {
  try {
    const existing = await getOrderBySessionId(stripeSessionId);
    if (!existing) return null;
    return existing.payment_status === "paid";
  } catch (err) {
    orderAlertLog("warn", "orders.order_alert.prior_lookup_failed", {
      stripe_session_id: stripeSessionId,
      error: err instanceof Error ? err.message : "lookup failed",
    });
    return null;
  }
}
