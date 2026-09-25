import { notifyOrderConfirmationFailure, sendCustomerMail } from "@/lib/mailer";
import { markConfirmationEmailSent, type OrderRow } from "@/lib/orders";
import { deliverOrderConfirmation, type ConfirmationDelivery } from "@/lib/order-confirmation";

/**
 * Send the pre-order confirmation through the existing Gmail account.
 * Does not throw. Pass force to resend after confirmation_email_sent_at is set.
 */
export function sendOrderConfirmation(
  order: OrderRow,
  options?: { force?: boolean }
): Promise<ConfirmationDelivery> {
  return deliverOrderConfirmation(order, {
    force: options?.force,
    send: (message) => sendCustomerMail(message),
    markSent: markConfirmationEmailSent,
    notifyFailure: notifyOrderConfirmationFailure,
  });
}
