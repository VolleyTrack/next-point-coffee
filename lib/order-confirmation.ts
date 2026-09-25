import { preorderEmailShipSentence } from "@/lib/preorder";

/**
 * Branded pre-order confirmation. HTML is table-based with inline styles so
 * Gmail and Apple Mail keep the layout. The logo is the full official wordmark
 * (NEXT POINT / COFFEE CO.) at its natural aspect ratio — never cropped.
 */

export const CONFIRMATION_FROM_NAME = "Next Point Coffee Co.";
export const CONFIRMATION_REPLY_TO = "ryan@nextpointcoffee.com";
export const CONFIRMATION_SUBJECT = "Thank you for your pre-order, Next Point Coffee Co.";
export const CONFIRMATION_TAGLINE = "You Can't Change the Last Point. Own the Next.";
export const CONFIRMATION_LOGO_URL = "https://nextpointcoffee.com/brand/next-point-logo.png";

/**
 * Natural pixel size of public/brand/next-point-logo.png.
 * Cropped from the official round badge so the arrow, NEXT POINT, and the
 * full COFFEE CO. line sit on #0A0A0A with margin on every side.
 */
const LOGO_NATURAL_WIDTH = 627;
const LOGO_NATURAL_HEIGHT = 543;
/** Display size inside the 600px email. Height keeps the full wordmark. */
export const CONFIRMATION_LOGO_WIDTH = 480;
export const CONFIRMATION_LOGO_HEIGHT = Math.round(
  (CONFIRMATION_LOGO_WIDTH * LOGO_NATURAL_HEIGHT) / LOGO_NATURAL_WIDTH
);

const BLACK = "#0A0A0A";
const CREAM = "#F0E0D0";
const GOLD = "#B08030";
const LOGO_BLACK = BLACK;

export interface ConfirmationOrder {
  id: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
  line_items: unknown;
  amount_subtotal: number;
  amount_shipping: number;
  amount_total: number;
  currency: string;
  payment_status: string;
  channel: "retail" | "campaign";
  confirmation_email_sent_at?: string | null;
}

export interface ConfirmationMessage {
  to: string;
  fromName: string;
  replyTo: string;
  subject: string;
  text: string;
  html: string;
}

export interface ConfirmationLine {
  name: string;
  grind: string | null;
  quantity: number;
  priceCents: number;
  discountCents: number | null;
}

export type BuiltConfirmation =
  | { ok: true; message: ConfirmationMessage; lines: ConfirmationLine[]; discountCents: number }
  | { ok: false; error: string };

export function orderNumber(id: string): string {
  const compact = id.replace(/-/g, "").slice(0, 8);
  return (compact || id.slice(0, 8)).toUpperCase();
}

export function buildOrderConfirmationEmail(
  order: ConfirmationOrder,
  options?: { shipSentence?: string }
): BuiltConfirmation {
  const to = safeEmail(order.customer_email);
  if (!to) {
    return { ok: false, error: "This order has no customer email." };
  }

  const lines = confirmationLines(order.line_items);
  const discountCents = orderDiscountCents(order, lines);
  const shipSentence = options?.shipSentence ?? preorderEmailShipSentence();
  const greeting = greetingName(order.customer_name);
  const hello = greeting ? `Hi ${greeting},` : "Hi there,";
  const number = orderNumber(order.id);
  const currency = order.currency || "usd";
  const addressLines = formatShippingAddress(order.shipping_address, order.customer_name);
  const shippingNote = shippingNoteFor(order);

  const itemBlocks = lines.map((line) => {
    const rows = [line.name];
    if (line.grind) rows.push(`Grind: ${line.grind}`);
    rows.push(`Quantity: ${line.quantity}`, `Price: ${formatMoney(line.priceCents, currency)}`);
    return rows.join("\n");
  });

  const textLines = [
    "Next Point Coffee Co.",
    CONFIRMATION_TAGLINE,
    "",
    hello,
    "",
    "Thank you for your pre-order, and for supporting a new small business. It means a lot.",
    "",
    `Order ${number}`,
    `Order id: ${order.id}`,
    "",
    itemBlocks.join("\n\n"),
    "",
    ...(discountCents > 0 ? [`Promo discount: -${formatMoney(discountCents, currency)}`] : []),
    `Total: ${formatMoney(order.amount_total, currency)}`,
    shippingNote,
    "",
    ...(addressLines.length > 0 ? ["Ship to:", ...addressLines, ""] : []),
    shipSentence,
    "",
    `Questions go to ${CONFIRMATION_REPLY_TO}.`,
    "",
    "Ryan Mullen",
    "Next Point Coffee",
    `${CONFIRMATION_REPLY_TO} · nextpointcoffee.com`,
  ];

  const html = renderHtml({
    hello,
    number,
    orderId: order.id,
    lines,
    discountCents,
    totalCents: order.amount_total,
    currency,
    shippingNote,
    addressLines,
    shipSentence,
  });

  return {
    ok: true,
    lines,
    discountCents,
    message: {
      to,
      fromName: CONFIRMATION_FROM_NAME,
      replyTo: CONFIRMATION_REPLY_TO,
      subject: CONFIRMATION_SUBJECT,
      text: textLines.join("\n"),
      html,
    },
  };
}

export interface ConfirmationDelivery {
  status: "sent" | "skipped" | "failed";
  reason?: "not_paid" | "already_sent";
  error?: string;
  warning?: string;
  to?: string;
}

export interface ConfirmationDeliveryDeps {
  send: (message: ConfirmationMessage) => Promise<void>;
  markSent: (orderId: string, sentAt: string) => Promise<void>;
  notifyFailure?: (notice: { subject: string; text: string }) => Promise<void>;
  now?: () => string;
  force?: boolean;
  shipSentence?: string;
  log?: (level: "info" | "error", event: string, fields: Record<string, unknown>) => void;
}

/**
 * Send the confirmation once. Skips when payment_status is not paid, or when
 * confirmation_email_sent_at is already set (unless force). Never throws.
 * A send failure does not mark the row, so a later attempt can retry.
 */
export async function deliverOrderConfirmation(
  order: ConfirmationOrder & { stripe_session_id?: string },
  deps: ConfirmationDeliveryDeps
): Promise<ConfirmationDelivery> {
  const log = deps.log ?? confirmationLog;
  const fields = {
    order_id: order.id,
    stripe_session_id: order.stripe_session_id ?? null,
  };

  try {
    if (order.payment_status !== "paid") {
      log("info", "orders.confirmation_email.skipped", { ...fields, reason: "not_paid" });
      return { status: "skipped", reason: "not_paid" };
    }

    if (!deps.force && order.confirmation_email_sent_at) {
      log("info", "orders.confirmation_email.skipped", { ...fields, reason: "already_sent" });
      return { status: "skipped", reason: "already_sent" };
    }

    const built = buildOrderConfirmationEmail(order, { shipSentence: deps.shipSentence });
    if (!built.ok) {
      await reportFailure(deps, order, built.error, log);
      return { status: "failed", error: built.error };
    }

    try {
      await deps.send(built.message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Confirmation email failed";
      await reportFailure(deps, order, message, log);
      return { status: "failed", error: message };
    }

    const sentAt = (deps.now ?? (() => new Date().toISOString()))();
    try {
      await deps.markSent(order.id, sentAt);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not record confirmation_email_sent_at";
      log("error", "orders.confirmation_email.stamp_failed", { ...fields, error: message });
      await safeNotify(deps, {
        subject: `Confirmation email sent, stamp failed: ${order.id}`,
        text: [
          "The pre-order confirmation email was sent, but confirmation_email_sent_at was not saved.",
          "Apply supabase/orders-confirmation-email.sql if the column is missing.",
          "A Stripe retry may send the email again until the timestamp is set.",
          "",
          `Order id: ${order.id}`,
          `To: ${built.message.to}`,
          "",
          message,
        ].join("\n"),
      });
      return { status: "sent", to: built.message.to, warning: message };
    }

    log("info", "orders.confirmation_email.sent", { ...fields, to: built.message.to });
    return { status: "sent", to: built.message.to };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirmation email failed";
    await reportFailure(deps, order, message, log);
    return { status: "failed", error: message };
  }
}

export function confirmationLog(
  level: "info" | "error",
  event: string,
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({ source: "next-point-coffee", event, ...fields });
  if (level === "error") console.error(line);
  else console.info(line);
}

function renderHtml(input: {
  hello: string;
  number: string;
  orderId: string;
  lines: ConfirmationLine[];
  discountCents: number;
  totalCents: number;
  currency: string;
  shippingNote: string;
  addressLines: string[];
  shipSentence: string;
}): string {
  const lineRows = input.lines
    .map((line) => {
      const grind = line.grind
        ? `<br /><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BLACK};">Grind: ${escapeHtml(line.grind)} &middot; Qty ${line.quantity}</span>`
        : `<br /><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BLACK};">Qty ${line.quantity}</span>`;
      return `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${GOLD};font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};">
            <strong>${escapeHtml(line.name)}</strong>${grind}
          </td>
          <td align="right" valign="top" style="padding:12px 0 12px 12px;border-bottom:1px solid ${GOLD};font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};white-space:nowrap;">
            ${escapeHtml(formatMoney(line.priceCents, input.currency))}
          </td>
        </tr>`;
    })
    .join("");

  const discountRow =
    input.discountCents > 0
      ? `
        <tr>
          <td style="padding:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};">Promo discount</td>
          <td align="right" style="padding:12px 0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};white-space:nowrap;">-${escapeHtml(formatMoney(input.discountCents, input.currency))}</td>
        </tr>`
      : "";

  const addressBlock =
    input.addressLines.length > 0
      ? `
        <p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};">Ship to</p>
        <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">${input.addressLines.map((line) => escapeHtml(line)).join("<br />")}</p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(CONFIRMATION_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:${BLACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BLACK};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${CREAM};">
          <tr>
            <td align="center" style="background:${LOGO_BLACK};padding:28px 24px 8px;">
              <img src="${CONFIRMATION_LOGO_URL}" width="${CONFIRMATION_LOGO_WIDTH}" height="${CONFIRMATION_LOGO_HEIGHT}" alt="Next Point Coffee Co." style="display:block;width:${CONFIRMATION_LOGO_WIDTH}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="background:${LOGO_BLACK};padding:8px 24px 22px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:20px;color:${CREAM};">${escapeHtml(CONFIRMATION_TAGLINE)}</p>
            </td>
          </tr>
          <tr>
            <td style="background:${GOLD};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;background:${CREAM};">
              <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:26px;color:${BLACK};">${escapeHtml(input.hello)}</p>
              <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">Thank you for your pre-order, and for supporting a new small business. It means a lot.</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};">Order ${escapeHtml(input.number)}</p>
              <p style="margin:4px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;color:${BLACK};">Order id: ${escapeHtml(input.orderId)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:collapse;">
                ${lineRows}
                ${discountRow}
                <tr>
                  <td style="padding:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};"><strong>Total</strong></td>
                  <td align="right" style="padding:12px 0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};white-space:nowrap;"><strong>${escapeHtml(formatMoney(input.totalCents, input.currency))}</strong></td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:22px;color:${BLACK};">${escapeHtml(input.shippingNote)}</p>
              ${addressBlock}
              <p style="margin:24px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};"><strong>${escapeHtml(input.shipSentence)}</strong></p>
              <p style="margin:16px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">Questions go to <a href="mailto:${CONFIRMATION_REPLY_TO}" style="color:${GOLD};text-decoration:underline;">${CONFIRMATION_REPLY_TO}</a>.</p>
              <p style="margin:28px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">
                Ryan Mullen<br />
                Next Point Coffee<br />
                <a href="mailto:${CONFIRMATION_REPLY_TO}" style="color:${GOLD};text-decoration:underline;">${CONFIRMATION_REPLY_TO}</a>
                &middot;
                <a href="https://nextpointcoffee.com" style="color:${GOLD};text-decoration:underline;">nextpointcoffee.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function confirmationLines(lineItems: unknown): ConfirmationLine[] {
  if (!Array.isArray(lineItems)) return [];
  const lines: ConfirmationLine[] = [];
  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const quantity = positiveInt(row.quantity) ?? 1;
    const named = productNameAndGrind(row);
    if (!named) continue;
    const priceCents = linePriceCents(row, quantity);
    if (priceCents == null) continue;
    lines.push({
      name: named.name,
      grind: named.grind,
      quantity,
      priceCents,
      discountCents: lineDiscountCents(row),
    });
  }
  return lines;
}

function orderDiscountCents(order: ConfirmationOrder, lines: ConfirmationLine[]): number {
  const known = lines.map((line) => line.discountCents);
  if (known.length > 0 && known.every((cents) => cents != null)) {
    return known.reduce((sum, cents) => sum + (cents ?? 0), 0);
  }
  const gap = Math.round(order.amount_subtotal + order.amount_shipping - order.amount_total);
  return gap > 0 ? gap : 0;
}

function shippingNoteFor(order: ConfirmationOrder): string {
  if (order.channel === "retail" || order.amount_shipping <= 0) return "Shipping is included.";
  return `Shipping: ${formatMoney(order.amount_shipping, order.currency)}.`;
}

function productNameAndGrind(row: Record<string, unknown>): { name: string; grind: string | null } | null {
  const productName = text(row.product_name);
  const grind = emailGrindLabel(text(row.form) || text(row.grind));
  if (productName) return { name: productName, grind };

  const description = text(row.description) || text(nestedName(row));
  if (!description) return null;
  const parts = description.split(/\s+[—–-]\s+/);
  if (parts.length >= 2) {
    const name = parts[0]?.trim();
    if (!name) return null;
    return { name, grind: emailGrindLabel(parts.slice(1).join(" ")) ?? grind };
  }
  return { name: description, grind };
}

function nestedName(row: Record<string, unknown>): string | null {
  const price = row.price;
  if (!price || typeof price !== "object") return null;
  const product = (price as { product?: unknown }).product;
  if (!product || typeof product !== "object") return null;
  return text((product as { name?: unknown }).name);
}

export function emailGrindLabel(value: string | null): string | null {
  if (!value) return null;
  const lower = value.toLowerCase();
  if (lower.includes("whole")) return "Whole Bean";
  if (lower.includes("ground")) return "Ground";
  return value.trim() || null;
}

function linePriceCents(row: Record<string, unknown>, quantity: number): number | null {
  if (typeof row.amount_subtotal === "number" && Number.isFinite(row.amount_subtotal)) {
    return Math.max(0, Math.round(row.amount_subtotal));
  }
  const price = row.price;
  const unit =
    price && typeof price === "object" ? (price as { unit_amount?: unknown }).unit_amount : null;
  if (typeof unit === "number" && Number.isFinite(unit)) {
    return Math.max(0, Math.round(unit) * quantity);
  }
  if (typeof row.amount_total === "number" && Number.isFinite(row.amount_total)) {
    return Math.max(0, Math.round(row.amount_total));
  }
  return null;
}

function lineDiscountCents(row: Record<string, unknown>): number | null {
  if (typeof row.amount_discount !== "number" || !Number.isFinite(row.amount_discount)) return null;
  return Math.max(0, Math.round(row.amount_discount));
}

export function formatShippingAddress(address: unknown, name: string | null): string[] {
  if (!address || typeof address !== "object") return [];
  const row = address as Record<string, unknown>;
  const line1 = text(row.line1);
  const line2 = text(row.line2);
  const city = text(row.city);
  const state = text(row.state);
  const postal = text(row.postal_code);
  const country = text(row.country);
  const cityLine = [city, [state, postal].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const lines = [text(name), line1, line2, cityLine || null, country && country !== "US" ? country : null].filter(
    (line): line is string => Boolean(line)
  );
  if (!line1 && !city) return [];
  return lines;
}

function formatMoney(cents: number, currency: string): string {
  const code = (currency || "usd").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

function greetingName(name: string | null): string | null {
  const trimmed = name?.replace(/\s+/g, " ").trim();
  if (!trimmed || trimmed.includes("@")) return null;
  const first = trimmed.split(" ")[0];
  if (!first || first.length > 40) return null;
  return first;
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

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function positiveInt(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return null;
  return Math.floor(parsed);
}

async function reportFailure(
  deps: ConfirmationDeliveryDeps,
  order: ConfirmationOrder & { stripe_session_id?: string },
  error: string,
  log: NonNullable<ConfirmationDeliveryDeps["log"]>
): Promise<void> {
  log("error", "orders.confirmation_email.failed", {
    order_id: order.id,
    stripe_session_id: order.stripe_session_id ?? null,
    error,
  });
  await safeNotify(deps, {
    subject: `Pre-order confirmation email failed: ${order.id}`,
    text: [
      "A paid Next Point Coffee order was saved, but the customer confirmation email was not sent.",
      "Checkout and books sync were not rolled back. Resend from POST /api/admin/orders/confirmation-email.",
      "",
      `Order id: ${order.id}`,
      `Stripe session: ${order.stripe_session_id ?? "—"}`,
      `Customer email: ${order.customer_email}`,
      "",
      "Error:",
      error,
    ].join("\n"),
  });
}

async function safeNotify(
  deps: ConfirmationDeliveryDeps,
  notice: { subject: string; text: string }
): Promise<void> {
  if (!deps.notifyFailure) return;
  try {
    await deps.notifyFailure(notice);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ops alert failed";
    confirmationLog("error", "orders.confirmation_email.alert_failed", {
      error: message,
      email_subject: notice.subject,
    });
  }
}
