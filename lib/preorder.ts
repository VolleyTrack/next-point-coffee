/**
 * Pre-order roast and ship day.
 *
 * Set PREORDER_SHIP_DATE=YYYY-MM-DD (default 2026-10-08). Shop cards, Stripe
 * Checkout, the thank-you page, and the customer confirmation email all read
 * this so the date can change in one place.
 */

export const DEFAULT_PREORDER_SHIP_DATE = "2026-10-08";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Stripe custom_text messages cannot exceed 1200 characters. */
export const STRIPE_CUSTOM_TEXT_LIMIT = 1200;

export function preorderShipDateIso(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.PREORDER_SHIP_DATE ?? "").trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return DEFAULT_PREORDER_SHIP_DATE;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return DEFAULT_PREORDER_SHIP_DATE;
  return raw;
}

/** "October 8, 2026" from a YYYY-MM-DD calendar date. Parsed as a date, not UTC midnight. */
export function formatPreorderShipDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return formatPreorderShipDate(DEFAULT_PREORDER_SHIP_DATE);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const monthName = MONTHS[month - 1];
  if (!monthName || day < 1 || day > 31) return formatPreorderShipDate(DEFAULT_PREORDER_SHIP_DATE);
  return `${monthName} ${day}, ${year}`;
}

export function preorderShipDateLabel(env: NodeJS.ProcessEnv = process.env): string {
  return formatPreorderShipDate(preorderShipDateIso(env));
}

/** Shop page and product cards. */
export function preorderCardLine(env: NodeJS.ProcessEnv = process.env): string {
  return `Pre-order: roasted, packaged, and shipping ${preorderShipDateLabel(env)}.`;
}

/** Stripe Checkout custom text, shown before the customer pays. */
export function preorderCheckoutMessage(env: NodeJS.ProcessEnv = process.env): string {
  const message = `Pre-order: your coffee is roasted and packaged on ${preorderShipDateLabel(env)} and ships that day.`;
  if (message.length <= STRIPE_CUSTOM_TEXT_LIMIT) return message;
  return message.slice(0, STRIPE_CUSTOM_TEXT_LIMIT);
}

export function preorderCheckoutCustomText(env: NodeJS.ProcessEnv = process.env): {
  submit: { message: string };
  after_submit: { message: string };
} {
  const message = preorderCheckoutMessage(env);
  return {
    submit: { message },
    after_submit: { message },
  };
}

/** Confirmation email ship sentence. */
export function preorderEmailShipSentence(env: NodeJS.ProcessEnv = process.env): string {
  return `Pre-orders are roasted and packaged on ${preorderShipDateLabel(env)}, and we'll start shipping them that day. You'll get another email with tracking as soon as your order ships.`;
}
