import { grindLabel, isGrindId, products, type GrindId, type Product } from "@/lib/site";

/**
 * Coffee subscription (/subscribe). Not live yet: subscriptions are deferred
 * until after the Sep 29, 2026 launch. While NEXT_PUBLIC_SUBSCRIPTIONS_LIVE is
 * unset or false, the page collects waitlist signups through /api/waitlist and
 * never starts a payment.
 */
export const subscriptionsLive = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_LIVE === "true";

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

/*
 * TODO(subscriptions-live): Stripe subscription Checkout.
 * When NEXT_PUBLIC_SUBSCRIPTIONS_LIVE=true and Ryan has confirmed the discount:
 *  1. Add POST /api/subscribe/checkout that validates a SubscriptionSelection
 *     (reuse clampBags, isGrindId, coffeeChoices, frequencyOptions).
 *  2. Create a Checkout Session with mode: "subscription", one recurring
 *     line item at calculateSubscriptionPrice(bags).subscriberPerBagCents,
 *     quantity = bags, recurring { interval: "week", interval_count: weeks }.
 *  3. Put coffee/grind/bags/frequency on subscription_data.metadata so the
 *     webhook and fulfillment know what to roast (alternate = flip each cycle).
 *  4. Handle invoice.paid / customer.subscription.* in the Stripe webhook and
 *     enable the Stripe customer portal for skip/pause/cancel.
 * Nothing here creates Stripe products, prices, or sessions yet.
 */
