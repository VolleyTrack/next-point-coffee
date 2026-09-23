import { notifyBooksIngestFailure } from "@/lib/mailer";
import {
  getOrderBySessionId,
  recordOrder,
  updateOrderBooksSync,
  type OrderRow,
} from "@/lib/orders";
import {
  recordPaidCheckout as recordPaidCheckoutWithDeps,
  syncPaidOrderToBooks as syncPaidOrderToBooksWithDeps,
  type CheckoutOrderInput,
  type PaidCheckoutSyncResult,
  type ResolvedCampaign,
} from "./order-ingest";

/** Save the checkout on public.orders and ingest it into books when it is paid. */
export function recordPaidCheckout(
  input: CheckoutOrderInput,
  campaign: ResolvedCampaign | null
): Promise<PaidCheckoutSyncResult<OrderRow>> {
  return recordPaidCheckoutWithDeps(input, campaign, {
    getOrder: getOrderBySessionId,
    record: recordOrder,
    updateSync: updateOrderBooksSync,
    notify: notifyBooksIngestFailure,
  });
}

/** Retry helper for paid orders that are not synced yet. */
export function syncPaidOrderToBooks(order: OrderRow, context: { orderDate: string }) {
  return syncPaidOrderToBooksWithDeps(order, context, {
    updateSync: updateOrderBooksSync,
    notify: notifyBooksIngestFailure,
  });
}
