import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { checkoutCustomerFromSession } from "./checkout-customer.ts";
import {
  CONFIRMATION_FROM_NAME,
  CONFIRMATION_LOGO_HEIGHT,
  CONFIRMATION_LOGO_URL,
  CONFIRMATION_LOGO_WIDTH,
  CONFIRMATION_REPLY_TO,
  CONFIRMATION_SUBJECT,
  CONFIRMATION_TAGLINE,
  buildOrderConfirmationEmail,
  deliverOrderConfirmation,
  orderNumber,
  type ConfirmationMessage,
  type ConfirmationOrder,
} from "./order-confirmation.ts";
import { preorderEmailShipSentence } from "./preorder.ts";

const shipSentence = preorderEmailShipSentence({ PREORDER_SHIP_DATE: "2026-10-08" } as NodeJS.ProcessEnv);

const sampleOrder: ConfirmationOrder = {
  id: "32ba6fd5-ead1-417a-aef6-06a4c5f3fdbe",
  customer_email: "alex@example.com",
  customer_name: "Alex Morgan",
  shipping_address: {
    line1: "120 Main Street",
    line2: "Apt 4",
    city: "Athens",
    state: "GA",
    postal_code: "30601",
    country: "US",
  },
  line_items: [
    {
      product_name: "First Serve",
      grind: "whole-bean",
      form: "Whole bean",
      quantity: 2,
      amount_subtotal: 4300,
      amount_discount: 500,
      amount_total: 3800,
    },
    {
      description: "Second Wind — Ground",
      quantity: 1,
      amount_subtotal: 2150,
      amount_discount: 0,
      amount_total: 2150,
    },
  ],
  amount_subtotal: 6450,
  amount_shipping: 0,
  amount_total: 5950,
  currency: "usd",
  payment_status: "paid",
  channel: "retail",
  confirmation_email_sent_at: null,
};

test("confirmation email is branded, summarized, and does not crop the wordmark", async () => {
  const built = buildOrderConfirmationEmail(sampleOrder, { shipSentence });
  assert.equal(built.ok, true);
  if (!built.ok) return;

  assert.equal(orderNumber(sampleOrder.id), "32BA6FD5");
  assert.equal(built.message.to, "alex@example.com");
  assert.equal(built.message.fromName, CONFIRMATION_FROM_NAME);
  assert.equal(built.message.fromName, "Next Point Coffee Co.");
  assert.equal(built.message.replyTo, CONFIRMATION_REPLY_TO);
  assert.equal(built.message.subject, CONFIRMATION_SUBJECT);
  assert.equal(built.discountCents, 500);

  const { html, text } = built.message;
  assert.match(html, new RegExp(`src="${CONFIRMATION_LOGO_URL.replaceAll(".", "\\.")}"`));
  assert.match(html, new RegExp(`width="${CONFIRMATION_LOGO_WIDTH}"`));
  assert.match(html, new RegExp(`height="${CONFIRMATION_LOGO_HEIGHT}"`));
  assert.match(html, /alt="Next Point Coffee Co\."/);
  assert.doesNotMatch(html, /object-fit|background-size:\s*cover|overflow:\s*hidden/i);
  const logoPng = await readFile(new URL("../public/brand/next-point-logo.png", import.meta.url));
  assert.equal(logoPng.readUInt32BE(16), 627);
  assert.equal(logoPng.readUInt32BE(20), 543);
  assert.equal(CONFIRMATION_LOGO_HEIGHT, Math.round((CONFIRMATION_LOGO_WIDTH * 543) / 627));
  assert.equal(CONFIRMATION_LOGO_WIDTH / CONFIRMATION_LOGO_HEIGHT, 480 / 416);
  assert.match(html, /#0A0A0A/);
  assert.match(html, /#F0E0D0/);
  assert.match(html, /#B08030/);
  assert.match(html, new RegExp(CONFIRMATION_TAGLINE.replaceAll(".", "\\.")));
  assert.match(html, /First Serve/);
  assert.match(html, /Whole Bean/);
  assert.match(html, /Second Wind/);
  assert.match(html, /Ground/);
  assert.match(html, /Promo discount/);
  assert.match(html, /\$5\.00/);
  assert.match(html, /\$59\.50/);
  assert.match(html, /Shipping is included\./);
  assert.match(html, /120 Main Street/);
  assert.match(html, /Athens, GA 30601/);
  assert.match(html, /October 8, 2026/);
  assert.match(html, /ryan@nextpointcoffee\.com/);
  assert.match(html, /Ryan Mullen/);
  assert.match(html, /Ryan Mullen<br \/>\s*Next Point Coffee<br \/>/);
  assert.doesNotMatch(html, /Founder/);
  assert.match(text, /Ryan Mullen\nNext Point Coffee\n/);
  assert.doesNotMatch(text, /Founder/);
  assert.match(html, /nextpointcoffee\.com/);
  assert.match(text, /Hi Alex,/);
  assert.match(text, /Order 32BA6FD5/);
  assert.match(text, /Grind: Whole Bean/);
  assert.match(text, /Grind: Ground/);
  assert.match(text, /Questions go to ryan@nextpointcoffee\.com/);

  const preview = await readFile(new URL("../docs/email-previews/order-confirmation.html", import.meta.url), "utf8");
  assert.equal(preview, html);
});

test("confirmation send is idempotent and a mail failure does not throw", async () => {
  const sent: ConfirmationMessage[] = [];
  const stamps: string[] = [];
  const alerts: string[] = [];
  const deps = {
    send: async (message: ConfirmationMessage) => {
      sent.push(message);
    },
    markSent: async (orderId: string, sentAt: string) => {
      stamps.push(`${orderId}:${sentAt}`);
    },
    notifyFailure: async (notice: { subject: string; text: string }) => {
      alerts.push(notice.subject);
    },
    now: () => "2026-09-25T12:00:00.000Z",
    shipSentence,
    log: () => {},
  };

  const first = await deliverOrderConfirmation(sampleOrder, deps);
  assert.equal(first.status, "sent");
  assert.equal(sent.length, 1);
  assert.deepEqual(stamps, [`${sampleOrder.id}:2026-09-25T12:00:00.000Z`]);

  const replay = await deliverOrderConfirmation(
    { ...sampleOrder, confirmation_email_sent_at: "2026-09-25T12:00:00.000Z" },
    deps
  );
  assert.equal(replay.status, "skipped");
  assert.equal(replay.reason, "already_sent");
  assert.equal(sent.length, 1);

  const forced = await deliverOrderConfirmation(
    { ...sampleOrder, confirmation_email_sent_at: "2026-09-25T12:00:00.000Z" },
    { ...deps, force: true }
  );
  assert.equal(forced.status, "sent");
  assert.equal(sent.length, 2);

  const unpaid = await deliverOrderConfirmation({ ...sampleOrder, payment_status: "unpaid" }, deps);
  assert.equal(unpaid.status, "skipped");
  assert.equal(unpaid.reason, "not_paid");
  assert.equal(sent.length, 2);

  const failed = await deliverOrderConfirmation(sampleOrder, {
    ...deps,
    send: async () => {
      throw new Error("smtp down");
    },
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.error ?? "", /smtp down/);
  assert.equal(stamps.length, 2);
  assert.equal(alerts.length, 1);

  const missing = await deliverOrderConfirmation({ ...sampleOrder, customer_email: "unknown" }, deps);
  assert.equal(missing.status, "failed");
  assert.match(missing.error ?? "", /no customer email/);
});

test("checkout prefers the collected US shipping address and still falls back", () => {
  const collected = checkoutCustomerFromSession({
    customer_details: {
      email: "buyer@example.com",
      name: "Buyer Name",
      address: { line1: "1 Billing", city: "Miami", state: "FL", postal_code: "33101", country: "US" },
    },
    collected_information: {
      shipping_details: {
        name: "Ship Name",
        address: { line1: "9 Ship St", city: "Athens", state: "GA", postal_code: "30601", country: "US" },
      },
    },
  });
  assert.equal(collected.customer_email, "buyer@example.com");
  assert.equal(collected.customer_name, "Buyer Name");
  assert.equal((collected.shipping_address as { line1: string }).line1, "9 Ship St");

  const fallback = checkoutCustomerFromSession({
    customer_email: "legacy@example.com",
    customer_details: {
      address: { line1: "1 Billing", city: "Miami", state: "FL", postal_code: "33101", country: "US" },
    },
  });
  assert.equal(fallback.customer_email, "legacy@example.com");
  assert.equal((fallback.shipping_address as { city: string }).city, "Miami");

  const empty = checkoutCustomerFromSession({
    customer_details: { email: "buyer@example.com", address: { line1: "", city: null } },
  });
  assert.equal(empty.shipping_address, null);
});
