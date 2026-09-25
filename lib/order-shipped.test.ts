import assert from "node:assert/strict";
import test from "node:test";
import {
  buildShippedEmail,
  normalizeTrackingNumber,
  parseCarrier,
  shipOrder,
  trackingUrl,
  type ShippableOrder,
  type ShippingPatch,
} from "@/lib/order-shipped";

const order: ShippableOrder = {
  id: "11111111-2222-3333-4444-555555555555",
  customer_email: "test.buyer@example.com",
  customer_name: "Test Buyer",
  shipping_address: { line1: "1 Main St", line2: null, city: "Tampa", state: "FL", postal_code: "33601", country: "US" },
  line_items: [
    { description: "First Serve — Whole bean", quantity: 1, amount_subtotal: 2150 },
    { product_name: "Second Wind", form: "Ground", quantity: 2, amount_subtotal: 4300 },
  ],
  payment_status: "paid",
  fulfillment_status: "unfulfilled",
};

function harness(start: Partial<ShippableOrder> = {}) {
  const calls = { saved: [] as ShippingPatch[], sent: [] as string[], marked: [] as string[] };
  const deps = {
    saveShipping: async (_id: string, patch: ShippingPatch) => {
      calls.saved.push(patch);
    },
    send: async (message: { to: string }) => {
      calls.sent.push(message.to);
    },
    markEmailSent: async (_id: string, at: string) => {
      calls.marked.push(at);
    },
    now: () => "2026-09-25T15:00:00.000Z",
  };
  return { calls, deps, order: { ...order, ...start } };
}

test("tracking urls per carrier", () => {
  assert.equal(trackingUrl("usps", "9400ABC"), "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400ABC");
  assert.equal(trackingUrl("ups", "1Z999"), "https://www.ups.com/track?tracknum=1Z999");
  assert.equal(trackingUrl("fedex", "7777"), "https://www.fedex.com/fedextrack/?trknbr=7777");
});

test("carrier and tracking validation", () => {
  assert.equal(parseCarrier("USPS"), "usps");
  assert.equal(parseCarrier("dhl"), null);
  assert.equal(normalizeTrackingNumber(" 9400 1000-0000 "), "940010000000");
  assert.equal(normalizeTrackingNumber("abc<script>"), null);
  assert.equal(normalizeTrackingNumber(""), null);
});

test("email has items, ship-to, tracking link, logo and signature", () => {
  const built = buildShippedEmail(order, { carrier: "usps", trackingNumber: "9400111" });
  assert.ok(built.ok);
  if (!built.ok) return;
  const { message } = built;
  assert.equal(message.subject, "Your Next Point Coffee order has shipped");
  assert.equal(message.replyTo, "ryan@nextpointcoffee.com");
  assert.match(message.text, /1 × First Serve — Whole Bean/);
  assert.match(message.text, /2 × Second Wind — Ground/);
  assert.match(message.text, /1 Main St/);
  assert.match(message.text, /Tampa, FL 33601/);
  assert.match(message.html, /tools\.usps\.com\/go\/TrackConfirmAction\?tLabels=9400111/);
  assert.match(message.html, /brand\/next-point-logo\.png/);
  assert.match(message.html, /Ryan Mullen<br \/>\s*Next Point Coffee<br \/>/);
  assert.doesNotMatch(message.html, /Founder/);
  assert.match(message.text, /Ryan Mullen\nNext Point Coffee\n/);
  assert.doesNotMatch(message.text, /Founder/);
});

test("ships and emails once", async () => {
  const h = harness();
  const result = await shipOrder(h.order, { carrier: "usps", trackingNumber: "9400111" }, h.deps);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.email, "sent");
  assert.equal(h.calls.saved[0]?.fulfillment_status, "shipped");
  assert.equal(h.calls.saved[0]?.shipped_at, "2026-09-25T15:00:00.000Z");
  assert.deepEqual(h.calls.sent, ["test.buyer@example.com"]);
  assert.equal(h.calls.marked.length, 1);
});

test("editing tracking without resend does not email again and keeps shipped_at", async () => {
  const h = harness({ shipped_at: "2026-09-24T10:00:00.000Z", shipped_email_sent_at: "2026-09-24T10:00:01.000Z" });
  const result = await shipOrder(h.order, { carrier: "ups", trackingNumber: "1Z999" }, h.deps);
  assert.ok(result.ok);
  if (!result.ok) return;
  assert.equal(result.email, "skipped_already_sent");
  assert.equal(h.calls.sent.length, 0);
  assert.equal(h.calls.saved[0]?.carrier, "ups");
  assert.equal(h.calls.saved[0]?.shipped_at, "2026-09-24T10:00:00.000Z");
});

test("resend sends again", async () => {
  const h = harness({ shipped_at: "2026-09-24T10:00:00.000Z", shipped_email_sent_at: "2026-09-24T10:00:01.000Z" });
  const result = await shipOrder(h.order, { carrier: "fedex", trackingNumber: "7777", resend: true }, h.deps);
  assert.ok(result.ok && result.email === "sent");
  assert.equal(h.calls.sent.length, 1);
});

test("unpaid orders are refused and nothing is saved", async () => {
  const h = harness({ payment_status: "unpaid" });
  const result = await shipOrder(h.order, { carrier: "usps", trackingNumber: "1" }, h.deps);
  assert.equal(result.ok, false);
  assert.equal(h.calls.saved.length, 0);
});

test("send failure does not stamp shipped_email_sent_at", async () => {
  const h = harness();
  h.deps.send = async () => {
    throw new Error("smtp down");
  };
  const result = await shipOrder(h.order, { carrier: "usps", trackingNumber: "1" }, h.deps);
  assert.ok(result.ok && result.email === "failed");
  assert.equal(h.calls.marked.length, 0);
});
