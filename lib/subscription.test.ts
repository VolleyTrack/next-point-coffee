import assert from "node:assert/strict";
import test from "node:test";
import {
  SUBSCRIBER_DISCOUNT_PERCENT,
  calculateSubscriptionPrice,
  clampBags,
  formatUsd,
  selectionSummary,
  subscriptionContext,
  subscriptionProducts,
} from "./subscription.ts";

test("subscription uses the two launch coffees at $21.50", () => {
  assert.deepEqual(
    subscriptionProducts.map((p) => p.slug),
    ["first-serve", "second-wind"]
  );
  for (const product of subscriptionProducts) assert.equal(product.priceCents, 2150);
});

test("default subscriber discount is 10% off $21.50", () => {
  assert.equal(SUBSCRIBER_DISCOUNT_PERCENT, 10);
  const one = calculateSubscriptionPrice(1);
  assert.equal(one.retailPerBagCents, 2150);
  assert.equal(one.subscriberPerBagCents, 1935);
  assert.equal(one.savingsPerDeliveryCents, 215);
  assert.equal(formatUsd(one.subscriberPerBagCents), "$19.35");
});

test("per-delivery totals multiply the rounded bag price", () => {
  const four = calculateSubscriptionPrice(4);
  assert.equal(four.retailPerDeliveryCents, 8600);
  assert.equal(four.subscriberPerDeliveryCents, 7740);
  assert.equal(four.savingsPerDeliveryCents, 860);

  const custom = calculateSubscriptionPrice(3, 15);
  assert.equal(custom.subscriberPerBagCents, 1828); // 1827.5 rounds up
  assert.equal(custom.subscriberPerDeliveryCents, 5484);
  assert.equal(calculateSubscriptionPrice(2, 0).savingsPerDeliveryCents, 0);
});

test("bags per delivery stay between 1 and 4", () => {
  assert.equal(clampBags(0), 1);
  assert.equal(clampBags(9), 4);
  assert.equal(clampBags(2.7), 2);
  assert.equal(calculateSubscriptionPrice(10).bags, 4);
});

test("waitlist context carries every choice", () => {
  const selection = { coffee: "first-serve", grind: "whole-bean", bags: 2, frequency: "2wk" } as const;
  assert.equal(subscriptionContext(selection), "subscribe-first-serve-whole-bean-2bag-2wk");
  assert.equal(
    subscriptionContext({ coffee: "alternate", grind: "ground", bags: 7, frequency: "6wk" }),
    "subscribe-alternate-ground-4bag-6wk"
  );
  assert.equal(selectionSummary(selection), "2 × 12 oz First Serve (Whole bean), every 2 weeks");
});

test("subscription checkout is mode subscription with inline recurring price", async () => {
  const { subscriptionCheckoutSessionParams } = await import("./subscription.ts");
  const params = subscriptionCheckoutSessionParams(
    { coffee: "second-wind", grind: "ground", bags: 3, frequency: "6wk" },
    "https://example.com",
    { PREORDER_SHIP_DATE: "2026-10-08" } as NodeJS.ProcessEnv
  );
  assert.equal(params.mode, "subscription");
  assert.equal(params.line_items?.length, 1);
  const line = params.line_items![0];
  assert.equal(line.quantity, 3);
  assert.equal(line.price_data?.unit_amount, 1935);
  assert.equal(line.price_data?.currency, "usd");
  assert.deepEqual(line.price_data?.recurring, { interval: "week", interval_count: 6 });
  assert.equal(line.price_data?.product_data?.name, "Second Wind Subscription — Ground");
  assert.deepEqual(params.shipping_address_collection, { allowed_countries: ["US"] });
  assert.equal(params.allow_promotion_codes, undefined);
  assert.equal(params.payment_intent_data, undefined);
  assert.equal(params.cancel_url, "https://example.com/subscribe");
  assert.equal(params.success_url, "https://example.com/order-confirmed?session_id={CHECKOUT_SESSION_ID}&type=subscription");
  assert.match(params.custom_text?.submit?.message ?? "", /October 8, 2026/);
  assert.equal(params.metadata?.channel, "retail");
  assert.equal(params.metadata?.order_type, "subscription");
  assert.equal(params.metadata?.productSlug, "second-wind");
  assert.equal(params.metadata?.grind, "ground");
  assert.equal(params.metadata?.quantity, "3");
  assert.equal(params.metadata?.sub_frequency, "6wk");
  assert.equal(params.subscription_data?.metadata?.sub_coffee, "second-wind");
  assert.equal(params.subscription_data?.metadata?.sub_bags, "3");
});

test("selection parsing rejects bad input and round-trips plan metadata", async () => {
  const { parseSubscriptionSelection, selectionFromPlanMetadata, subscriptionPlanMetadata } = await import(
    "./subscription.ts"
  );
  assert.equal(parseSubscriptionSelection({ coffee: "half-caff", grind: "ground", bags: 1, frequency: "2wk" }).ok, false);
  assert.equal(parseSubscriptionSelection({ coffee: "first-serve", grind: "fine", bags: 1, frequency: "2wk" }).ok, false);
  assert.equal(parseSubscriptionSelection({ coffee: "first-serve", grind: "ground", bags: 1, frequency: "1wk" }).ok, false);
  const ok = parseSubscriptionSelection({ coffee: "alternate", grind: "whole-bean", bags: "9", frequency: "2wk" });
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.selection.bags, 4);
  assert.deepEqual(selectionFromPlanMetadata(subscriptionPlanMetadata(ok.selection)), ok.selection);
  assert.equal(selectionFromPlanMetadata({ channel: "retail" }), null);
});

test("alternate deliveries flip by billing cycle", async () => {
  const { deliverySlug, subscriptionCycleIndex } = await import("./subscription.ts");
  const anchor = 1_790_000_000;
  const twoWeeks = 14 * 86400;
  assert.equal(subscriptionCycleIndex(anchor, anchor, 2), 0);
  assert.equal(subscriptionCycleIndex(anchor + twoWeeks, anchor, 2), 1);
  assert.equal(subscriptionCycleIndex(anchor + 2 * twoWeeks + 3600, anchor, 2), 2);
  assert.equal(deliverySlug("alternate", 0), "first-serve");
  assert.equal(deliverySlug("alternate", 1), "second-wind");
  assert.equal(deliverySlug("alternate", 2), "first-serve");
  assert.equal(deliverySlug("second-wind", 1), "second-wind");
});

test("renewal invoice becomes a retail order and books ingest body", async () => {
  const { renewalOrderInput, isSubscriptionRenewal, subscriptionIdFromInvoice } = await import("./subscription.ts");
  const { buildOrderInsert, buildBooksOrderIngestBody } = await import("./books/order-ingest.ts");

  assert.equal(isSubscriptionRenewal({ billing_reason: "subscription_cycle" }), true);
  assert.equal(isSubscriptionRenewal({ billing_reason: "subscription_create" }), false);
  assert.equal(subscriptionIdFromInvoice({ parent: { subscription_details: { subscription: "sub_123" } } }), "sub_123");
  assert.equal(subscriptionIdFromInvoice({ subscription: "sub_legacy" }), "sub_legacy");
  assert.equal(subscriptionIdFromInvoice({}), null);

  const input = renewalOrderInput(
    {
      id: "in_test_1",
      created: 1_791_000_000,
      subtotal: 3870,
      amount_paid: 3870,
      currency: "usd",
      customer_email: "sub@example.com",
      customer_name: null,
      customer_shipping: null,
    },
    { coffee: "alternate", grind: "whole-bean", bags: 2, frequency: "2wk" },
    1,
    { name: "Sub Scriber", address: { line1: "1 Court St", city: "Athens", state: "GA", postal_code: "30601", country: "US" } }
  );
  assert.equal(input.payment_status, "paid");
  assert.equal(input.customer_name, "Sub Scriber");
  assert.equal(input.metadata?.productSlug, "second-wind");
  assert.equal(input.metadata?.sub_cycle, "1");

  const order = buildOrderInsert(input, null);
  assert.equal(order.stripe_session_id, "in_test_1");
  assert.equal(order.channel, "retail");
  assert.equal(order.amount_total, 3870);
  assert.deepEqual((order.shipping_address as { city: string }).city, "Athens");

  const body = buildBooksOrderIngestBody(
    { ...order, id: "order-renewal", campaign_share_owed: null },
    "2026-10-22T15:00:00.000Z"
  );
  assert.equal(body.stripe_session_id, "in_test_1");
  assert.equal(body.gross_amount_cents, 3870);
  assert.deepEqual(body.items, [
    { product_slug: "second-wind", product_name: "Second Wind", grind: "whole-bean", form: "Whole bean", quantity: 2 },
  ]);
});
