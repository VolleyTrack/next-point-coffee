import { confirmationLines, formatShippingAddress, orderNumber } from "@/lib/order-confirmation";

/**
 * Internal "new order" email to the shop inbox. Sent once per paid order from
 * the Stripe webhook. Pure builders here; wiring lives in lib/send-order-alert.ts.
 */

export const DEFAULT_ORDER_ALERT_EMAIL = "info@nextpointcoffee.com";
export const ADMIN_ORDERS_URL = "https://nextpointcoffee.com/admin/orders";
export const ORDER_ALERT_TIME_ZONE = "America/New_York";

const BLACK = "#191615";
const CREAM = "#F1ECDF";
const GOLD = "#B89251";

/** ORDER_ALERT_EMAIL (comma-separated allowed), else info@nextpointcoffee.com. */
export function orderAlertRecipient(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.ORDER_ALERT_EMAIL ?? "").replace(/[\r\n]/g, "").trim();
  const list = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(part));
  return list.length > 0 ? list.join(", ") : DEFAULT_ORDER_ALERT_EMAIL;
}

export interface OrderAlertOrder {
  id: string;
  stripe_session_id: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
  line_items: unknown;
  amount_subtotal: number;
  amount_shipping: number;
  amount_total: number;
  currency: string;
  payment_status: string;
  channel?: string;
  campaign_name?: string | null;
  created_at?: string | null;
  /** Present once supabase/orders-order-alert.sql is applied. Null until the alert is sent. */
  order_alert_sent_at?: string | null;
}

export interface OrderAlertContext {
  /** Checkout phone (customer_details.phone), when collected. */
  phone?: string | null;
  /** Promotion code the customer typed, e.g. LAUNCH10. */
  promoCode?: string | null;
  /** Discount from Stripe total_details.amount_discount; otherwise derived from the order. */
  discountCents?: number | null;
  /** Unix seconds (Stripe `created`) or ISO string. Falls back to order.created_at. */
  placedAt?: number | string | null;
  /** "renewal" for subscription invoices (PR #23). */
  kind?: "order" | "renewal";
  /**
   * Whether the row was already paid before this webhook saved it. Used to
   * dedupe when order_alert_sent_at does not exist yet. null = unknown.
   */
  wasPaidBefore?: boolean | null;
}

export interface OrderAlertMessage {
  to: string;
  replyTo: string | null;
  subject: string;
  text: string;
  html: string;
}

export interface OrderAlertLine {
  name: string;
  grind: string | null;
  quantity: number;
  unitCents: number;
  lineCents: number;
}

export function orderAlertLines(lineItems: unknown): OrderAlertLine[] {
  return confirmationLines(lineItems).map((line) => ({
    name: line.name,
    grind: line.grind,
    quantity: line.quantity,
    unitCents: Math.round(line.priceCents / Math.max(1, line.quantity)),
    lineCents: line.priceCents,
  }));
}

export function orderAlertDiscountCents(order: OrderAlertOrder, context: OrderAlertContext = {}): number {
  if (typeof context.discountCents === "number" && Number.isFinite(context.discountCents)) {
    return Math.max(0, Math.round(context.discountCents));
  }
  const known = confirmationLines(order.line_items).map((line) => line.discountCents);
  if (known.length > 0 && known.every((cents) => cents != null)) {
    return known.reduce<number>((sum, cents) => sum + (cents ?? 0), 0);
  }
  const gap = Math.round(order.amount_subtotal + order.amount_shipping - order.amount_total);
  return gap > 0 ? gap : 0;
}

/** "Sep 25, 2026, 1:17 PM EDT" in America/New_York. */
export function formatEasternTime(value: number | string | Date | null | undefined): string | null {
  if (value == null || value === "") return null;
  const date =
    value instanceof Date ? value : typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: ORDER_ALERT_TIME_ZONE,
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(date);
}

export function buildOrderAlertEmail(
  order: OrderAlertOrder,
  context: OrderAlertContext = {},
  env: NodeJS.ProcessEnv = process.env
): OrderAlertMessage {
  const currency = order.currency || "usd";
  const money = (cents: number) => formatMoney(cents, currency);
  const lines = orderAlertLines(order.line_items);
  const discountCents = orderAlertDiscountCents(order, context);
  const promoCode = oneLine(context.promoCode);
  const phone = oneLine(context.phone);
  const name = oneLine(order.customer_name);
  const email = oneLine(order.customer_email) ?? "unknown";
  const who = name ?? email;
  const address = formatShippingAddress(order.shipping_address, null);
  const placed = formatEasternTime(context.placedAt ?? null) ?? formatEasternTime(order.created_at ?? null) ?? "—";
  const number = orderNumber(order.id);
  const renewal = context.kind === "renewal";
  const heading = renewal ? "New subscription renewal" : "New order";
  const campaign = order.channel === "campaign" ? oneLine(order.campaign_name) ?? "campaign" : null;

  const subject = oneLine(`${heading}: ${subjectItems(lines)} - ${money(order.amount_total)} - ${who}`) ?? heading;

  const lineText = lines.length
    ? lines.map((line) => `- ${line.quantity} x ${itemLabel(line)} @ ${money(line.unitCents)} = ${money(line.lineCents)}`)
    : ["- (no line items on the order row)"];

  const text = [
    `${heading} on nextpointcoffee.com`,
    "",
    `Customer: ${name ?? "—"}`,
    `Email: ${email}`,
    `Phone: ${phone ?? "—"}`,
    "Ship to:",
    ...(address.length ? address.map((line) => `  ${line}`) : ["  —"]),
    "",
    "Items:",
    ...lineText,
    "",
    `Subtotal: ${money(order.amount_subtotal)}`,
    ...(discountCents > 0 ? [`Discount${promoCode ? ` (${promoCode})` : ""}: -${money(discountCents)}`] : []),
    ...(discountCents <= 0 && promoCode ? [`Promo code: ${promoCode}`] : []),
    ...(order.amount_shipping > 0 ? [`Shipping: ${money(order.amount_shipping)}`] : []),
    `Total paid: ${money(order.amount_total)}`,
    "",
    `Order: ${number} (${order.id})`,
    `Stripe ${renewal ? "invoice" : "session"}: ${order.stripe_session_id}`,
    ...(campaign ? [`Campaign: ${campaign}`] : []),
    `Placed: ${placed}`,
    "",
    `Admin: ${ADMIN_ORDERS_URL}`,
  ].join("\n");

  const html = renderHtml({
    heading,
    name,
    email,
    phone,
    address,
    lines,
    money,
    subtotalCents: order.amount_subtotal,
    discountCents,
    promoCode,
    shippingCents: order.amount_shipping,
    totalCents: order.amount_total,
    number,
    orderId: order.id,
    stripeLabel: renewal ? "Stripe invoice" : "Stripe session",
    stripeId: order.stripe_session_id,
    campaign,
    placed,
  });

  return {
    to: orderAlertRecipient(env),
    replyTo: safeEmail(order.customer_email),
    subject,
    text,
    html,
  };
}

export interface OrderAlertDelivery {
  status: "sent" | "skipped" | "failed";
  reason?: "no_order" | "not_paid" | "already_sent" | "already_paid";
  error?: string;
  warning?: string;
  to?: string;
}

export interface OrderAlertDeps {
  send: (message: OrderAlertMessage) => Promise<void>;
  /** Stamp order_alert_sent_at. Optional; a failure only logs. */
  markSent?: (orderId: string, sentAt: string) => Promise<void>;
  now?: () => string;
  env?: NodeJS.ProcessEnv;
  log?: (level: "info" | "warn" | "error", event: string, fields: Record<string, unknown>) => void;
}

/**
 * Decide whether this webhook delivery should alert.
 * - Only paid orders.
 * - With the order_alert_sent_at column: send while it is null.
 * - Without it (migration not applied): send only when this delivery is the one
 *   that made the order paid (wasPaidBefore !== true).
 */
export function orderAlertSkipReason(
  order: OrderAlertOrder | null | undefined,
  context: OrderAlertContext = {}
): OrderAlertDelivery["reason"] | null {
  if (!order) return "no_order";
  if (order.payment_status !== "paid") return "not_paid";
  if (Object.prototype.hasOwnProperty.call(order, "order_alert_sent_at")) {
    return order.order_alert_sent_at ? "already_sent" : null;
  }
  return context.wasPaidBefore === true ? "already_paid" : null;
}

/** Send the internal alert once. Never throws. */
export async function deliverOrderAlert(
  order: OrderAlertOrder | null | undefined,
  context: OrderAlertContext,
  deps: OrderAlertDeps
): Promise<OrderAlertDelivery> {
  const log = deps.log ?? orderAlertLog;
  const fields = { order_id: order?.id ?? null, stripe_session_id: order?.stripe_session_id ?? null };
  try {
    const reason = orderAlertSkipReason(order, context);
    if (reason || !order) {
      log("info", "orders.order_alert.skipped", { ...fields, reason });
      return { status: "skipped", reason: reason ?? "no_order" };
    }

    const message = buildOrderAlertEmail(order, context, deps.env ?? process.env);
    try {
      await deps.send(message);
    } catch (err) {
      const error = err instanceof Error ? err.message : "Order alert email failed";
      log("error", "orders.order_alert.failed", { ...fields, error });
      return { status: "failed", error };
    }

    if (deps.markSent) {
      const sentAt = (deps.now ?? (() => new Date().toISOString()))();
      try {
        await deps.markSent(order.id, sentAt);
      } catch (err) {
        const warning = err instanceof Error ? err.message : "Could not record order_alert_sent_at";
        log("warn", "orders.order_alert.stamp_failed", { ...fields, error: warning });
        return { status: "sent", to: message.to, warning };
      }
    }

    log("info", "orders.order_alert.sent", { ...fields, to: message.to });
    return { status: "sent", to: message.to };
  } catch (err) {
    const error = err instanceof Error ? err.message : "Order alert email failed";
    log("error", "orders.order_alert.failed", { ...fields, error });
    return { status: "failed", error };
  }
}

export function orderAlertLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({ source: "next-point-coffee", event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

function subjectItems(lines: OrderAlertLine[]): string {
  if (lines.length === 0) return "order";
  const shown = lines.slice(0, 3).map((line) => `${line.quantity}x ${itemLabel(line)}`);
  const more = lines.length > 3 ? ` +${lines.length - 3} more` : "";
  return `${shown.join(", ")}${more}`;
}

function itemLabel(line: { name: string; grind: string | null }): string {
  return line.grind ? `${line.name} (${line.grind})` : line.name;
}

function renderHtml(input: {
  heading: string;
  name: string | null;
  email: string;
  phone: string | null;
  address: string[];
  lines: OrderAlertLine[];
  money: (cents: number) => string;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  shippingCents: number;
  totalCents: number;
  number: string;
  orderId: string;
  stripeLabel: string;
  stripeId: string;
  campaign: string | null;
  placed: string;
}): string {
  const cell = `font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BLACK};`;
  const label = `font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};`;
  const detail = (key: string, value: string) =>
    `<tr><td style="${cell}padding:3px 12px 3px 0;color:#6b6259;white-space:nowrap;vertical-align:top;">${escapeHtml(key)}</td><td style="${cell}padding:3px 0;">${value}</td></tr>`;

  const itemRows = input.lines.length
    ? input.lines
        .map(
          (line) => `
                <tr>
                  <td style="${cell}padding:8px 0;border-bottom:1px solid #d9cfb8;"><strong>${escapeHtml(line.name)}</strong>${line.grind ? `<br /><span style="color:#6b6259;">${escapeHtml(line.grind)}</span>` : ""}</td>
                  <td align="center" style="${cell}padding:8px;border-bottom:1px solid #d9cfb8;">${line.quantity}</td>
                  <td align="right" style="${cell}padding:8px;border-bottom:1px solid #d9cfb8;white-space:nowrap;">${escapeHtml(input.money(line.unitCents))}</td>
                  <td align="right" style="${cell}padding:8px 0 8px 8px;border-bottom:1px solid #d9cfb8;white-space:nowrap;">${escapeHtml(input.money(line.lineCents))}</td>
                </tr>`
        )
        .join("")
    : `<tr><td colspan="4" style="${cell}padding:8px 0;">(no line items on the order row)</td></tr>`;

  const totalRow = (key: string, value: string, bold = false) =>
    `<tr><td colspan="3" align="right" style="${cell}padding:4px 8px;">${bold ? `<strong>${key}</strong>` : key}</td><td align="right" style="${cell}padding:4px 0 4px 8px;white-space:nowrap;">${bold ? `<strong>${value}</strong>` : value}</td></tr>`;

  const discountLabel = `Discount${input.promoCode ? ` (${escapeHtml(input.promoCode)})` : ""}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(input.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${CREAM};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};">
    <tr>
      <td align="center" style="padding:20px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border:1px solid #e3dac6;">
          <tr>
            <td style="background:${BLACK};padding:16px 24px;">
              <p style="margin:0;${label}">Next Point Coffee &middot; internal</p>
              <p style="margin:4px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:28px;color:${CREAM};">${escapeHtml(input.heading)} &middot; ${escapeHtml(input.money(input.totalCents))}</p>
            </td>
          </tr>
          <tr><td style="background:${GOLD};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
          <tr>
            <td style="padding:20px 24px 8px;">
              <p style="margin:0 0 6px;${label}">Customer</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${detail("Name", escapeHtml(input.name ?? "—"))}
                ${detail("Email", `<a href="mailto:${escapeHtml(input.email)}" style="color:${BLACK};">${escapeHtml(input.email)}</a>`)}
                ${detail("Phone", escapeHtml(input.phone ?? "—"))}
                ${detail("Ship to", input.address.length ? input.address.map(escapeHtml).join("<br />") : "—")}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 8px;">
              <p style="margin:0 0 6px;${label}">Items</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td style="${label}padding:4px 0;border-bottom:1px solid ${BLACK};">Coffee</td>
                  <td align="center" style="${label}padding:4px 8px;border-bottom:1px solid ${BLACK};">Qty</td>
                  <td align="right" style="${label}padding:4px 8px;border-bottom:1px solid ${BLACK};">Unit</td>
                  <td align="right" style="${label}padding:4px 0 4px 8px;border-bottom:1px solid ${BLACK};">Line</td>
                </tr>${itemRows}
                ${totalRow("Subtotal", escapeHtml(input.money(input.subtotalCents)))}
                ${input.discountCents > 0 ? totalRow(discountLabel, `-${escapeHtml(input.money(input.discountCents))}`) : ""}
                ${input.discountCents <= 0 && input.promoCode ? totalRow("Promo code", escapeHtml(input.promoCode)) : ""}
                ${input.shippingCents > 0 ? totalRow("Shipping", escapeHtml(input.money(input.shippingCents))) : ""}
                ${totalRow("Total paid", escapeHtml(input.money(input.totalCents)), true)}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 24px 8px;">
              <p style="margin:0 0 6px;${label}">Order</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                ${detail("Order", `${escapeHtml(input.number)} <span style="color:#6b6259;">(${escapeHtml(input.orderId)})</span>`)}
                ${detail(input.stripeLabel, escapeHtml(input.stripeId))}
                ${input.campaign ? detail("Campaign", escapeHtml(input.campaign)) : ""}
                ${detail("Placed", escapeHtml(input.placed))}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px 24px;">
              <a href="${ADMIN_ORDERS_URL}" style="display:inline-block;background:${BLACK};color:${CREAM};font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:bold;text-decoration:none;padding:10px 18px;border-radius:4px;">Open admin orders</a>
              <p style="margin:10px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b6259;"><a href="${ADMIN_ORDERS_URL}" style="color:${GOLD};">${ADMIN_ORDERS_URL}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#6b6259;">Automated order notification from nextpointcoffee.com</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function formatMoney(cents: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function oneLine(value: string | null | undefined): string | null {
  const trimmed = value?.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  return trimmed ? trimmed : null;
}

function safeEmail(value: string | null | undefined): string | null {
  const email = value?.trim() ?? "";
  if (!email || email.length > 320 || /[\r\n]/.test(email)) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
