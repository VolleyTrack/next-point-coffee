import assert from "node:assert/strict";
import test from "node:test";
import { buildBooksOrderIngestBody, buildOrderInsert } from "./books/order-ingest.ts";
import {
  attachRetailForm,
  resolveRetailCart,
  retailCheckoutMetadata,
  retailCheckoutSessionParams,
  toStripeLineItem,
} from "./retail-checkout.ts";

test("launch cart accepts First Serve and Second Wind in both forms", () => {
  const cart = resolveRetailCart([
    { slug: "first-serve", grind: "ground", quantity: 1 },
    { slug: "second-wind", grind: "whole-bean", quantity: 3 },
  ]);
  assert.equal(cart.ok, true);
  if (!cart.ok) return;
  assert.deepEqual(
    cart.lines.map((line) => ({ title: line.title, priceCents: line.priceCents, quantity: line.quantity })),
    [
      { title: "First Serve — Ground", priceCents: 2000, quantity: 1 },
      { title: "Second Wind — Whole bean", priceCents: 2000, quantity: 3 },
    ]
  );

  const stripe = toStripeLineItem(cart.lines[1]);
  assert.equal(stripe.price_data.product_data.name, "Second Wind — Whole bean");
  assert.equal(stripe.price_data.product_data.metadata.grind, "whole-bean");
  assert.equal(stripe.price_data.product_data.metadata.form, "Whole bean");
  assert.match(stripe.price_data.product_data.description, /^Whole bean\. Dark Roast\./);
  assert.equal(stripe.price_data.unit_amount, 2000);
  assert.equal(stripe.quantity, 3);
});

test("retail checkout sessions accept a promotion code", () => {
  const cart = resolveRetailCart([{ slug: "first-serve", grind: "whole-bean", quantity: 2 }]);
  assert.equal(cart.ok, true);
  if (!cart.ok) return;

  const params = retailCheckoutSessionParams(cart.lines, "https://nextpointcoffee.com");
  assert.equal(params.mode, "payment");
  assert.equal(params.allow_promotion_codes, true);
  assert.equal(params.discounts, undefined);
  assert.equal(params.success_url, "https://nextpointcoffee.com/order-confirmed?session_id={CHECKOUT_SESSION_ID}");
  assert.equal(params.cancel_url, "https://nextpointcoffee.com/shop");
  assert.deepEqual(params.shipping_address_collection, { allowed_countries: ["US"] });
  assert.equal(params.shipping_options, undefined);
  assert.equal(params.metadata?.channel, "retail");
  assert.equal(params.metadata?.grind, "whole-bean");
  assert.equal(params.line_items?.length, 1);
  assert.equal(params.line_items?.[0].quantity, 2);
  assert.equal(params.line_items?.[0].price_data?.unit_amount, 2000);
});

test("retail checkout rejects Half Caff and a missing grind", () => {
  const half = resolveRetailCart([{ slug: "half-caff", grind: "ground", quantity: 1 }]);
  assert.equal(half.ok, false);
  if (!half.ok) assert.equal(half.error, "That coffee isn't available.");

  const missing = resolveRetailCart([{ slug: "first-serve", quantity: 1 }]);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.error, "Choose Ground or Whole bean.");

  const unknown = resolveRetailCart([{ slug: "house-blend", grind: "ground", quantity: 1 }]);
  assert.equal(unknown.ok, false);
});

test("quantity stays inside the existing retail range", () => {
  const cart = resolveRetailCart([{ slug: "first-serve", grind: "ground", quantity: 99 }]);
  assert.equal(cart.ok, true);
  if (!cart.ok) return;
  assert.equal(cart.lines[0].quantity, 20);
});

test("a single bag puts grind on session metadata", () => {
  const cart = resolveRetailCart([{ slug: "first-serve", grind: "ground", quantity: 2 }]);
  assert.equal(cart.ok, true);
  if (!cart.ok) return;
  const metadata = retailCheckoutMetadata(cart.lines);
  assert.equal(metadata.channel, "retail");
  assert.equal(metadata.productSlug, "first-serve");
  assert.equal(metadata.productName, "First Serve");
  assert.equal(metadata.grind, "ground");
  assert.equal(metadata.form, "Ground");
  assert.equal(metadata.quantity, "2");
  assert.deepEqual(JSON.parse(metadata.items), [
    {
      product_slug: "first-serve",
      product_name: "First Serve",
      grind: "ground",
      form: "Ground",
      quantity: 2,
    },
  ]);
});

test("stored line items and books ingest keep grind and form", () => {
  const cart = resolveRetailCart([
    { slug: "first-serve", grind: "ground", quantity: 1 },
    { slug: "second-wind", grind: "whole-bean", quantity: 2 },
  ]);
  assert.equal(cart.ok, true);
  if (!cart.ok) return;

  const metadata = retailCheckoutMetadata(cart.lines);
  const stripeLines = cart.lines.map((line) => ({
    description: line.title,
    quantity: line.quantity,
  }));
  const stored = attachRetailForm(stripeLines, metadata);
  assert.equal(Array.isArray(stored), true);
  if (!Array.isArray(stored)) return;
  assert.equal(stored[0].grind, "ground");
  assert.equal(stored[0].form, "Ground");
  assert.equal(stored[1].product_slug, "second-wind");
  assert.equal(stored[1].form, "Whole bean");

  const inserted = buildOrderInsert(
    {
      id: "cs_test_grind",
      created: 1_758_000_000,
      amount_subtotal: 6000,
      amount_shipping: 0,
      amount_total: 6000,
      currency: "usd",
      payment_status: "paid",
      customer_email: "buyer@example.com",
      customer_name: "Buyer",
      shipping_address: null,
      line_items: stripeLines,
      metadata,
    },
    null
  );
  assert.equal((inserted.line_items as Array<{ grind: string }>)[1].grind, "whole-bean");

  const body = buildBooksOrderIngestBody(
    {
      id: "order-grind",
      stripe_session_id: "cs_test_grind",
      amount_total: 6000,
      currency: "usd",
      channel: "retail",
      campaign_id: null,
      campaign_name: null,
      campaign_share_owed: null,
      line_items: inserted.line_items,
    },
    "2026-09-29T15:00:00.000Z"
  );
  assert.equal(body.channel, "retail");
  assert.equal(body.campaign_share_owed, null);
  assert.deepEqual(body.items, [
    {
      product_slug: "first-serve",
      product_name: "First Serve",
      grind: "ground",
      form: "Ground",
      quantity: 1,
    },
    {
      product_slug: "second-wind",
      product_name: "Second Wind",
      grind: "whole-bean",
      form: "Whole bean",
      quantity: 2,
    },
  ]);
});
