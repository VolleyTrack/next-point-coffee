import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_PREORDER_SHIP_DATE,
  formatPreorderShipDate,
  preorderCardLine,
  preorderCheckoutCustomText,
  preorderCheckoutMessage,
  preorderEmailShipSentence,
  preorderShipDateIso,
  preorderShipDateLabel,
} from "./preorder.ts";

const october = { PREORDER_SHIP_DATE: "2026-10-08" } as NodeJS.ProcessEnv;
const november = { PREORDER_SHIP_DATE: "2026-11-12" } as NodeJS.ProcessEnv;

test("ship date defaults to October 8, 2026", () => {
  assert.equal(preorderShipDateIso({} as NodeJS.ProcessEnv), DEFAULT_PREORDER_SHIP_DATE);
  assert.equal(preorderShipDateIso({ PREORDER_SHIP_DATE: "next week" } as NodeJS.ProcessEnv), DEFAULT_PREORDER_SHIP_DATE);
  assert.equal(preorderShipDateLabel(october), "October 8, 2026");
  assert.equal(formatPreorderShipDate("2026-10-08"), "October 8, 2026");
});

test("one env value changes shop, checkout, and email copy", () => {
  assert.equal(preorderCardLine(october), "Pre-order: roasted, packaged, and shipping October 8, 2026.");
  assert.equal(
    preorderCheckoutMessage(october),
    "Pre-order: your coffee is roasted and packaged on October 8, 2026 and ships that day."
  );
  assert.equal(
    preorderEmailShipSentence(october),
    "Pre-orders are roasted and packaged on October 8, 2026, and we'll start shipping them that day. You'll get another email with tracking as soon as your order ships."
  );

  assert.match(preorderCardLine(november), /November 12, 2026/);
  assert.match(preorderCheckoutMessage(november), /November 12, 2026/);
  assert.match(preorderEmailShipSentence(november), /November 12, 2026/);
  assert.equal(preorderCheckoutCustomText(november).submit.message, preorderCheckoutMessage(november));
  assert.equal(preorderCheckoutCustomText(november).after_submit.message, preorderCheckoutMessage(november));
});

test("shop, thank-you page, and checkout read the shared ship date", async () => {
  const card = await readFile(new URL("../components/product-card.tsx", import.meta.url), "utf8");
  const shop = await readFile(new URL("../app/shop/page.tsx", import.meta.url), "utf8");
  const confirmedPage = await readFile(new URL("../app/order-confirmed/page.tsx", import.meta.url), "utf8");
  const confirmed = await readFile(new URL("../components/order-confirmed.tsx", import.meta.url), "utf8");
  const checkout = await readFile(new URL("./retail-checkout.ts", import.meta.url), "utf8");
  const webhook = await readFile(new URL("../app/api/webhooks/stripe/route.ts", import.meta.url), "utf8");

  assert.match(card, /preorderCardLine/);
  assert.match(shop, /preorderCardLine/);
  assert.match(confirmedPage, /preorderCardLine/);
  assert.match(confirmed, /Check your email for your confirmation/);
  assert.match(confirmed, /Thank you for your pre-order/);
  assert.match(checkout, /preorderCheckoutCustomText/);
  assert.match(checkout, /shipping_address_collection: \{ allowed_countries: \["US"\] \}/);
  assert.match(webhook, /sendOrderConfirmation/);
  assert.match(webhook, /payment_status === "paid"/);
  assert.match(webhook, /checkoutCustomerFromSession/);
});
