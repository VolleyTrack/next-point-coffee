import {
  CONFIRMATION_FROM_NAME,
  CONFIRMATION_LOGO_HEIGHT,
  CONFIRMATION_LOGO_URL,
  CONFIRMATION_LOGO_WIDTH,
  CONFIRMATION_REPLY_TO,
  CONFIRMATION_TAGLINE,
  confirmationLines,
  formatShippingAddress,
  orderNumber,
  type ConfirmationMessage,
} from "@/lib/order-confirmation";

/**
 * "Your order has shipped" email plus the idempotent ship action.
 * Same table-based, inline-styled layout as the pre-order confirmation
 * (lib/order-confirmation.ts): full NEXT POINT / COFFEE CO. logo on black,
 * tagline, gold bar, cream card, Ryan's signature.
 */

export const SHIPPED_SUBJECT = "Your Next Point Coffee order has shipped";

export const CARRIERS = ["usps", "ups", "fedex"] as const;
export type Carrier = (typeof CARRIERS)[number];

export const CARRIER_LABELS: Record<Carrier, string> = {
  usps: "USPS",
  ups: "UPS",
  fedex: "FedEx",
};

const BLACK = "#0A0A0A";
const CREAM = "#F0E0D0";
const GOLD = "#B08030";

export function parseCarrier(value: unknown): Carrier | null {
  if (typeof value !== "string") return null;
  const key = value.trim().toLowerCase();
  return (CARRIERS as readonly string[]).includes(key) ? (key as Carrier) : null;
}

/** Letters, digits, spaces and dashes only; spaces/dashes removed. */
export function normalizeTrackingNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const compact = value.replace(/[\s-]+/g, "").toUpperCase();
  if (!compact || compact.length > 40 || !/^[A-Z0-9]+$/.test(compact)) return null;
  return compact;
}

export function trackingUrl(carrier: Carrier, trackingNumber: string): string {
  const num = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case "ups":
      return `https://www.ups.com/track?tracknum=${num}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${num}`;
    case "usps":
    default:
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${num}`;
  }
}

export interface ShippableOrder {
  id: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
  line_items: unknown;
  payment_status: string;
  fulfillment_status: string;
  carrier?: string | null;
  tracking_number?: string | null;
  shipped_at?: string | null;
  shipped_email_sent_at?: string | null;
}

export interface ShippedItem {
  name: string;
  grind: string | null;
  quantity: number;
}

export function shippedItems(lineItems: unknown): ShippedItem[] {
  return confirmationLines(lineItems).map((line) => ({
    name: line.name,
    grind: line.grind,
    quantity: line.quantity,
  }));
}

export type BuiltShipped = { ok: true; message: ConfirmationMessage } | { ok: false; error: string };

export function buildShippedEmail(
  order: ShippableOrder,
  shipment: { carrier: Carrier; trackingNumber: string }
): BuiltShipped {
  const to = safeEmail(order.customer_email);
  if (!to) return { ok: false, error: "This order has no customer email." };

  const items = shippedItems(order.line_items);
  const greeting = greetingName(order.customer_name);
  const hello = greeting ? `Hi ${greeting},` : "Hi there,";
  const number = orderNumber(order.id);
  const addressLines = formatShippingAddress(order.shipping_address, order.customer_name);
  const carrierLabel = CARRIER_LABELS[shipment.carrier];
  const url = trackingUrl(shipment.carrier, shipment.trackingNumber);

  const itemText = items.map((item) =>
    `${item.quantity} × ${item.name}${item.grind ? ` — ${item.grind}` : ""}`
  );

  const text = [
    "Next Point Coffee Co.",
    CONFIRMATION_TAGLINE,
    "",
    hello,
    "",
    "Good news: your Next Point Coffee order is on its way.",
    "",
    `Order ${number}`,
    "",
    ...(itemText.length > 0 ? [...itemText, ""] : []),
    ...(addressLines.length > 0 ? ["Ship to:", ...addressLines, ""] : []),
    `Carrier: ${carrierLabel}`,
    `Tracking number: ${shipment.trackingNumber}`,
    `Track your package: ${url}`,
    "",
    "Tracking can take up to a day to show the first scan.",
    "",
    `Questions go to ${CONFIRMATION_REPLY_TO}.`,
    "",
    "Ryan Mullen",
    "Founder | Next Point Coffee Co.",
    `${CONFIRMATION_REPLY_TO} · nextpointcoffee.com`,
  ].join("\n");

  const html = renderShippedHtml({
    hello,
    number,
    items,
    addressLines,
    carrierLabel,
    trackingNumber: shipment.trackingNumber,
    url,
  });

  return {
    ok: true,
    message: {
      to,
      fromName: CONFIRMATION_FROM_NAME,
      replyTo: CONFIRMATION_REPLY_TO,
      subject: SHIPPED_SUBJECT,
      text,
      html,
    },
  };
}

export interface ShipInput {
  carrier: Carrier;
  trackingNumber: string;
  /** Send the email again even if shipped_email_sent_at is set. */
  resend?: boolean;
}

export interface ShippingPatch {
  fulfillment_status: "shipped";
  carrier: Carrier;
  tracking_number: string;
  shipped_at: string;
}

export interface ShipDeps {
  saveShipping: (orderId: string, patch: ShippingPatch) => Promise<void>;
  send: (message: ConfirmationMessage) => Promise<void>;
  markEmailSent: (orderId: string, sentAt: string) => Promise<void>;
  now?: () => string;
}

export type ShipResult =
  | {
      ok: true;
      orderId: string;
      carrier: Carrier;
      trackingNumber: string;
      trackingUrl: string;
      shippedAt: string;
      email: "sent" | "skipped_already_sent" | "failed";
      emailSentAt: string | null;
      emailError?: string;
      to?: string;
    }
  | { ok: false; status: 400 | 409; error: string };

/**
 * Mark an order shipped and email the customer once.
 * - Only paid orders can ship.
 * - shipped_at keeps the first ship time when tracking is edited.
 * - Email goes out when shipped_email_sent_at is empty, or when resend is true.
 * - A failed send leaves shipped_email_sent_at alone so a resend can retry.
 */
export async function shipOrder(order: ShippableOrder, input: ShipInput, deps: ShipDeps): Promise<ShipResult> {
  if (order.payment_status !== "paid" && order.payment_status !== "no_payment_required") {
    return { ok: false, status: 409, error: "Only paid orders can be marked shipped." };
  }
  const now = deps.now ?? (() => new Date().toISOString());
  const shippedAt = order.shipped_at || now();
  const patch: ShippingPatch = {
    fulfillment_status: "shipped",
    carrier: input.carrier,
    tracking_number: input.trackingNumber,
    shipped_at: shippedAt,
  };
  await deps.saveShipping(order.id, patch);

  const base = {
    ok: true as const,
    orderId: order.id,
    carrier: input.carrier,
    trackingNumber: input.trackingNumber,
    trackingUrl: trackingUrl(input.carrier, input.trackingNumber),
    shippedAt,
  };

  if (order.shipped_email_sent_at && !input.resend) {
    return { ...base, email: "skipped_already_sent", emailSentAt: order.shipped_email_sent_at };
  }

  const built = buildShippedEmail(order, { carrier: input.carrier, trackingNumber: input.trackingNumber });
  if (!built.ok) {
    return { ...base, email: "failed", emailSentAt: order.shipped_email_sent_at ?? null, emailError: built.error };
  }
  try {
    await deps.send(built.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shipped email failed";
    return { ...base, email: "failed", emailSentAt: order.shipped_email_sent_at ?? null, emailError: message };
  }
  const sentAt = now();
  try {
    await deps.markEmailSent(order.id, sentAt);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save shipped_email_sent_at";
    return { ...base, email: "sent", emailSentAt: null, emailError: message, to: built.message.to };
  }
  return { ...base, email: "sent", emailSentAt: sentAt, to: built.message.to };
}

function renderShippedHtml(input: {
  hello: string;
  number: string;
  items: ShippedItem[];
  addressLines: string[];
  carrierLabel: string;
  trackingNumber: string;
  url: string;
}): string {
  const itemRows = input.items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${GOLD};font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:22px;color:${BLACK};">
            <strong>${escapeHtml(item.name)}</strong><br /><span style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:${BLACK};">${item.grind ? `Grind: ${escapeHtml(item.grind)} &middot; ` : ""}Qty ${item.quantity}</span>
          </td>
        </tr>`
    )
    .join("");

  const addressBlock =
    input.addressLines.length > 0
      ? `
              <p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};">Ship to</p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">${input.addressLines.map((line) => escapeHtml(line)).join("<br />")}</p>`
      : "";

  const url = escapeHtml(input.url);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(SHIPPED_SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:${BLACK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BLACK};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:${CREAM};">
          <tr>
            <td align="center" style="background:${BLACK};padding:28px 24px 8px;">
              <img src="${CONFIRMATION_LOGO_URL}" width="${CONFIRMATION_LOGO_WIDTH}" height="${CONFIRMATION_LOGO_HEIGHT}" alt="Next Point Coffee Co." style="display:block;width:${CONFIRMATION_LOGO_WIDTH}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" style="background:${BLACK};padding:8px 24px 22px;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:14px;line-height:20px;color:${CREAM};">${escapeHtml(CONFIRMATION_TAGLINE)}</p>
            </td>
          </tr>
          <tr>
            <td style="background:${GOLD};height:6px;line-height:6px;font-size:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:32px 32px 28px;background:${CREAM};">
              <p style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:18px;line-height:26px;color:${BLACK};">${escapeHtml(input.hello)}</p>
              <p style="margin:0 0 20px;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">Good news: your Next Point Coffee order is on its way.</p>
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};">Order ${escapeHtml(input.number)}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;border-collapse:collapse;">
                ${itemRows}
              </table>
              ${addressBlock}
              <p style="margin:24px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:16px;letter-spacing:0.08em;text-transform:uppercase;color:${GOLD};">Tracking</p>
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">${escapeHtml(input.carrierLabel)} &middot; ${escapeHtml(input.trackingNumber)}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 0;">
                <tr>
                  <td style="background:${BLACK};border-radius:4px;">
                    <a href="${url}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:bold;color:${CREAM};text-decoration:none;">Track your package</a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:${BLACK};">Or open: <a href="${url}" style="color:${GOLD};text-decoration:underline;word-break:break-all;">${url}</a><br />Tracking can take up to a day to show the first scan.</p>
              <p style="margin:24px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">Questions go to <a href="mailto:${CONFIRMATION_REPLY_TO}" style="color:${GOLD};text-decoration:underline;">${CONFIRMATION_REPLY_TO}</a>.</p>
              <p style="margin:28px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:24px;color:${BLACK};">
                Ryan Mullen<br />
                Founder | Next Point Coffee Co.<br />
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
