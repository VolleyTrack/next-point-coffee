/**
 * Human-readable order summary for the Stripe Dashboard, e.g.
 * "1 × First Serve — Whole bean, 2 × Second Wind — Ground".
 *
 * Stripe caps PaymentIntent descriptions at 1000 characters and metadata
 * values at 500, so both helpers truncate on a whole-item boundary and add
 * "…" when something was cut.
 */

export const PAYMENT_DESCRIPTION_LIMIT = 1000;
export const ITEMS_SUMMARY_METADATA_LIMIT = 500;

export interface SummaryLine {
  quantity: number;
  title: string;
}

export function orderSummaryText(lines: SummaryLine[], limit: number = PAYMENT_DESCRIPTION_LIMIT): string {
  const parts = lines
    .filter((line) => line.title.trim())
    .map((line) => `${Math.max(1, Math.floor(line.quantity || 1))} × ${line.title.trim()}`);
  return truncateParts(parts, limit);
}

function truncateParts(parts: string[], limit: number): string {
  const full = parts.join(", ");
  if (full.length <= limit) return full;
  const ellipsis = "…";
  let out = "";
  for (const part of parts) {
    const next = out ? `${out}, ${part}` : part;
    if (next.length + ellipsis.length + 2 > limit) break;
    out = next;
  }
  if (!out) return `${full.slice(0, Math.max(0, limit - ellipsis.length))}${ellipsis}`;
  return `${out}, ${ellipsis}`;
}

/**
 * Summary lines from Checkout Session line items as Stripe returns them after
 * payment. Uses the final quantity, which can differ from the cart because
 * shoppers can adjust the bag count on the Stripe page.
 */
export function summaryLinesFromStripeLineItems(lineItems: unknown): SummaryLine[] {
  if (!Array.isArray(lineItems)) return [];
  const lines: SummaryLine[] = [];
  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue;
    const row = item as { description?: unknown; quantity?: unknown };
    const title = typeof row.description === "string" ? row.description.trim() : "";
    if (!title) continue;
    const quantity = Number(row.quantity);
    lines.push({ title, quantity: Number.isFinite(quantity) && quantity >= 1 ? quantity : 1 });
  }
  return lines;
}

export interface PaymentSummaryUpdate {
  paymentIntentId: string;
  description: string;
  metadata: { items_summary: string };
}

/**
 * The PaymentIntent update for a paid retail Checkout Session, built from its
 * final line items. Null for campaign sessions, sessions without a
 * PaymentIntent, or when nothing readable is on the line items.
 */
export function paidRetailPaymentSummary(session: {
  payment_intent?: unknown;
  metadata?: Record<string, string> | null;
  line_items?: { data?: unknown } | null;
}): PaymentSummaryUpdate | null {
  const metadata = session.metadata ?? {};
  if (metadata.campaignId || metadata.channel !== "retail") return null;
  const pi = session.payment_intent;
  const paymentIntentId =
    typeof pi === "string" ? pi : pi && typeof pi === "object" && typeof (pi as { id?: unknown }).id === "string" ? (pi as { id: string }).id : "";
  if (!paymentIntentId) return null;
  const lines = summaryLinesFromStripeLineItems(session.line_items?.data);
  if (lines.length === 0) return null;
  return {
    paymentIntentId,
    description: orderSummaryText(lines, PAYMENT_DESCRIPTION_LIMIT),
    metadata: { items_summary: orderSummaryText(lines, ITEMS_SUMMARY_METADATA_LIMIT) },
  };
}
