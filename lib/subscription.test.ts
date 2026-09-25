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
