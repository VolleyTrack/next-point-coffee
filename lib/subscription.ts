import type Stripe from "stripe";
import type { CheckoutOrderInput } from "@/lib/books/order-ingest";
import { preorderShipDateLabel, STRIPE_CUSTOM_TEXT_LIMIT } from "@/lib/preorder";
import { resolveRetailCart, retailCheckoutMetadata } from "@/lib/retail-checkout";
import { grindLabel, isGrindId, products, site, type GrindId, type Product } from "@/lib/site";

/**
 * Coffee subscription (/subscribe). Gated by the same switch as the shop
 * (NEXT_PUBLIC_STORE_LIVE). While the store is off, /subscribe collects waitlist
 * signups through /api/waitlist. When it is on, POST /api/subscribe/checkout
 * starts a Stripe Checkout Session in mode "subscription".
 */

/**
 * Subscriber savings off the retail bag price, in whole percent.
 *
 * TODO(Ryan): confirm the subscriber discount before subscriptions go live.
 * 10% is a placeholder that matches the common subscribe-and-save rate. Every
 * price on /subscribe (and the tests) reads this one constant.
 */
export const SUBSCRIBER_DISCOUNT_PERCENT = 10;

/** Launch coffees only. Half Caff and anything not purchasable stays out. */
export const subscriptionProducts: Product[] = products.filter(
  (product) => product.slug === "first-serve" || product.slug === "second-wind"
);

export const coffeeChoices = [
  { id: "first-serve", label: "First Serve", detail: "Medium roast" },
  { id: "second-wind", label: "Second Wind", detail: "Dark roast" },
  { id: "alternate", label: "Alternate both", detail: "First Serve, then Second Wind, then repeat" },
] as const;

export type CoffeeChoiceId = (typeof coffeeChoices)[number]["id"];

export const frequencyOptions = [
  { id: "2wk", weeks: 2, label: "Every 2 weeks" },
  { id: "4wk", weeks: 4, label: "Every 4 weeks" },
  { id: "6wk", weeks: 6, label: "Every 6 weeks" },
] as const;

export type FrequencyId = (typeof frequencyOptions)[number]["id"];

export const MIN_BAGS_PER_DELIVERY = 1;
export const MAX_BAGS_PER_DELIVERY = 4;

export interface SubscriptionSelection {
  coffee: CoffeeChoiceId;
  grind: GrindId;
  bags: number;
  frequency: FrequencyId;
}

export const defaultSelection: SubscriptionSelection = {
  coffee: "first-serve",
  grind: "whole-bean",
  bags: 1,
  frequency: "4wk",
};

export interface SubscriptionPrice {
  discountPercent: number;
  /** Retail bag price, shipping included. */
  retailPerBagCents: number;
  subscriberPerBagCents: number;
  bags: number;
  retailPerDeliveryCents: number;
  subscriberPerDeliveryCents: number;
  savingsPerDeliveryCents: number;
}

/** Retail bag price shared by both launch coffees ($21.50, shipping included). */
export function subscriptionRetailBagCents(): number {
  return subscriptionProducts[0]?.priceCents ?? 2150;
}

export function clampBags(bags: number): number {
  const whole = Math.floor(bags) || MIN_BAGS_PER_DELIVERY;
  return Math.max(MIN_BAGS_PER_DELIVERY, Math.min(MAX_BAGS_PER_DELIVERY, whole));
}

/**
 * Price for one delivery. The discount is applied per bag and rounded to the
 * nearest cent, so the per-bag price shown always multiplies to the total.
 */
export function calculateSubscriptionPrice(
  bags: number,
  discountPercent: number = SUBSCRIBER_DISCOUNT_PERCENT,
  retailPerBagCents: number = subscriptionRetailBagCents()
): SubscriptionPrice {
  const count = clampBags(bags);
  const pct = Math.max(0, Math.min(100, discountPercent));
  const subscriberPerBagCents = Math.round((retailPerBagCents * (100 - pct)) / 100);
  const retailPerDeliveryCents = retailPerBagCents * count;
  const subscriberPerDeliveryCents = subscriberPerBagCents * count;
  return {
    discountPercent: pct,
    retailPerBagCents,
    subscriberPerBagCents,
    bags: count,
    retailPerDeliveryCents,
    subscriberPerDeliveryCents,
    savingsPerDeliveryCents: retailPerDeliveryCents - subscriberPerDeliveryCents,
  };
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function frequencyLabel(id: FrequencyId): string {
  return frequencyOptions.find((option) => option.id === id)?.label ?? id;
}

export function coffeeLabel(id: CoffeeChoiceId): string {
  return coffeeChoices.find((option) => option.id === id)?.label ?? id;
}

/**
 * Waitlist context stored with the signup, e.g.
 * `subscribe-first-serve-whole-bean-2bag-2wk`.
 */
export function subscriptionContext(selection: SubscriptionSelection): string {
  const grind = isGrindId(selection.grind) ? selection.grind : defaultSelection.grind;
  return `subscribe-${selection.coffee}-${grind}-${clampBags(selection.bags)}bag-${selection.frequency}`;
}

/** One human line for the summary card. */
export function selectionSummary(selection: SubscriptionSelection): string {
  const bags = clampBags(selection.bags);
  return `${bags} × 12 oz ${coffeeLabel(selection.coffee)} (${grindLabel(selection.grind)}), ${frequencyLabel(
    selection.frequency
  ).toLowerCase()}`;
}

/** Skip / pause / cancel contact while (or instead of) the Stripe customer portal. */
export const subscriptionHelpEmail = `ryan@${site.domain}`;

/**
 * Optional Stripe customer portal login link (Dashboard > Settings > Billing >
 * Customer portal > "Login link"). When set, /subscribe shows a Manage link.
 */
export function customerPortalUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = (env.NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL ?? "").trim();
  return /^https:\/\/billing\.stripe\.com\//.test(raw) ? raw : null;
}

export function frequencyWeeks(id: FrequencyId): number {
  return frequencyOptions.find((option) => option.id === id)?.weeks ?? 4;
}

function isCoffeeChoice(value: unknown): value is CoffeeChoiceId {
  return coffeeChoices.some((choice) => choice.id === value);
}

function isFrequencyId(value: unknown): value is FrequencyId {
  return frequencyOptions.some((option) => option.id === value);
}

export type ParsedSelection = { ok: true; selection: SubscriptionSelection } | { ok: false; error: string };

/** Validate a selection from the browser or from Stripe metadata. */
export function parseSubscriptionSelection(raw: unknown): ParsedSelection {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Build your subscription to continue." };
  const row = raw as Record<string, unknown>;
  if (!isCoffeeChoice(row.coffee)) return { ok: false, error: "Choose a coffee." };
  if (!isGrindId(row.grind)) return { ok: false, error: "Choose Ground or Whole bean." };
  if (!isFrequencyId(row.frequency)) return { ok: false, error: "Choose how often." };
  const bags = Number(row.bags);
  if (!Number.isFinite(bags)) return { ok: false, error: "Choose how many bags." };
  return {
    ok: true,
    selection: { coffee: row.coffee, grind: row.grind, bags: clampBags(bags), frequency: row.frequency },
  };
}

/** Stripe product name, e.g. "First Serve Subscription — Whole bean". */
export function subscriptionProductTitle(coffee: CoffeeChoiceId, grind: GrindId): string {
  const name = coffee === "alternate" ? "First Serve + Second Wind Alternating" : coffeeLabel(coffee);
  return `${name} Subscription — ${grindLabel(grind)}`;
}

/** Which coffee ships on a delivery. Alternate: even cycles First Serve, odd Second Wind. */
export function deliverySlug(coffee: CoffeeChoiceId, cycleIndex: number): "first-serve" | "second-wind" {
  if (coffee === "alternate") return Math.abs(Math.floor(cycleIndex)) % 2 === 1 ? "second-wind" : "first-serve";
  return coffee;
}

/**
 * Zero-based delivery number from the invoice period start. Stable across
 * webhook retries, so an alternating renewal always gets the same coffee.
 */
export function subscriptionCycleIndex(periodStart: number, billingAnchor: number, weeks: number): number {
  const period = weeks * 7 * 24 * 60 * 60;
  if (!Number.isFinite(periodStart) || !Number.isFinite(billingAnchor) || period <= 0) return 0;
  return Math.max(0, Math.round((periodStart - billingAnchor) / period));
}

/** Plan metadata kept on the Stripe subscription (renewals read this). */
export function subscriptionPlanMetadata(selection: SubscriptionSelection): Record<string, string> {
  return {
    channel: "retail",
    order_type: "subscription",
    sub_coffee: selection.coffee,
    sub_grind: selection.grind,
    sub_bags: String(clampBags(selection.bags)),
    sub_frequency: selection.frequency,
  };
}

export function selectionFromPlanMetadata(metadata: Record<string, string> | null | undefined): SubscriptionSelection | null {
  if (!metadata || metadata.order_type !== "subscription") return null;
  const parsed = parseSubscriptionSelection({
    coffee: metadata.sub_coffee,
    grind: metadata.sub_grind,
    bags: metadata.sub_bags,
    frequency: metadata.sub_frequency,
  });
  return parsed.ok ? parsed.selection : null;
}

/**
 * Order metadata for one delivery: plan keys plus the same retail keys the
 * shop uses (productSlug, grind, form, quantity, items), so public.orders,
 * the confirmation email, and the books ingest read it like a retail order.
 */
export function subscriptionDeliveryMetadata(
  selection: SubscriptionSelection,
  cycleIndex: number
): Record<string, string> {
  const cart = resolveRetailCart([
    { slug: deliverySlug(selection.coffee, cycleIndex), grind: selection.grind, quantity: clampBags(selection.bags) },
  ]);
  const retail = cart.ok ? retailCheckoutMetadata(cart.lines) : {};
  return { ...retail, ...subscriptionPlanMetadata(selection), sub_cycle: String(Math.max(0, Math.floor(cycleIndex))) };
}

export function subscriptionCheckoutMessage(selection: SubscriptionSelection, env: NodeJS.ProcessEnv = process.env): string {
  const message = `Subscription: your first delivery is roasted, packaged, and ships ${preorderShipDateLabel(
    env
  )}, like our pre-orders. You're billed today, then ${frequencyLabel(selection.frequency).toLowerCase()}. Skip, pause, or cancel anytime.`;
  return message.slice(0, STRIPE_CUSTOM_TEXT_LIMIT);
}

/**
 * Stripe Checkout Session for /subscribe. Inline recurring price_data (no
 * Stripe products to manage), subscriber price per bag, quantity = bags per
 * delivery, US shipping address like the retail checkout. Shipping stays in
 * the bag price. Promotion codes are off: the subscriber discount is the deal.
 */
export function subscriptionCheckoutSessionParams(
  selection: SubscriptionSelection,
  origin: string,
  env: NodeJS.ProcessEnv = process.env
): Stripe.Checkout.SessionCreateParams {
  const price = calculateSubscriptionPrice(selection.bags);
  const title = subscriptionProductTitle(selection.coffee, selection.grind);
  const plan = subscriptionPlanMetadata(selection);
  return {
    mode: "subscription",
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: title,
            description: `12 oz bags. ${grindLabel(selection.grind)}. Shipping included. Subscriber price (${price.discountPercent}% off retail).`,
            metadata: plan,
          },
          unit_amount: price.subscriberPerBagCents,
          recurring: { interval: "week", interval_count: frequencyWeeks(selection.frequency) },
        },
        quantity: price.bags,
      },
    ],
    shipping_address_collection: { allowed_countries: ["US"] },
    custom_text: { submit: { message: subscriptionCheckoutMessage(selection, env) } },
    success_url: `${origin}/order-confirmed?session_id={CHECKOUT_SESSION_ID}&type=subscription`,
    cancel_url: `${origin}/subscribe`,
    metadata: subscriptionDeliveryMetadata(selection, 0),
    subscription_data: {
      description: selectionSummary(selection),
      metadata: plan,
    },
  };
}

/** Pull the subscription id off an invoice (new `parent` shape or legacy field). */
export function subscriptionIdFromInvoice(invoice: unknown): string | null {
  if (!invoice || typeof invoice !== "object") return null;
  const row = invoice as {
    parent?: { subscription_details?: { subscription?: unknown } | null } | null;
    subscription?: unknown;
  };
  const candidate = row.parent?.subscription_details?.subscription ?? row.subscription;
  if (typeof candidate === "string") return candidate;
  if (candidate && typeof candidate === "object" && typeof (candidate as { id?: unknown }).id === "string") {
    return (candidate as { id: string }).id;
  }
  return null;
}

export interface RenewalInvoice {
  id: string;
  created: number;
  subtotal: number;
  amount_paid: number;
  currency: string;
  customer_email: string | null;
  customer_name: string | null;
  customer_shipping?: { name?: string | null; address?: unknown } | null;
}

/**
 * public.orders input for a paid renewal invoice (billing_reason
 * subscription_cycle). The invoice id stands in for the Checkout Session id,
 * so the order upsert and the books Idempotency-Key are both one per invoice.
 */
export function renewalOrderInput(
  invoice: RenewalInvoice,
  selection: SubscriptionSelection,
  cycleIndex: number,
  fallbackShipping?: { name?: string | null; address?: unknown } | null
): CheckoutOrderInput {
  const slug = deliverySlug(selection.coffee, cycleIndex);
  const product = subscriptionProducts.find((entry) => entry.slug === slug);
  const bags = clampBags(selection.bags);
  const shipping = invoice.customer_shipping?.address ? invoice.customer_shipping : fallbackShipping ?? null;
  return {
    id: invoice.id,
    created: invoice.created,
    amount_subtotal: invoice.subtotal,
    amount_shipping: 0,
    amount_total: invoice.amount_paid,
    currency: invoice.currency || "usd",
    payment_status: "paid",
    customer_email: invoice.customer_email?.trim() || "unknown",
    customer_name: invoice.customer_name?.trim() || shipping?.name?.trim() || null,
    shipping_address: shipping?.address ?? null,
    line_items: [
      {
        description: `${product?.name ?? slug} — ${grindLabel(selection.grind)}`,
        quantity: bags,
        amount_total: invoice.amount_paid,
      },
    ],
    metadata: subscriptionDeliveryMetadata(selection, cycleIndex),
  };
}

/** Only renewals become new orders. The first invoice is the Checkout order. */
export function isSubscriptionRenewal(invoice: { billing_reason?: string | null } | null | undefined): boolean {
  return invoice?.billing_reason === "subscription_cycle";
}
