import assert from "node:assert/strict";
import test from "node:test";
import {
  ADMIN_ORDERS_URL,
  DEFAULT_ORDER_ALERT_EMAIL,
  buildOrderAlertEmail,
  deliverOrderAlert,
  formatEasternTime,
  orderAlertRecipient,
  orderAlertSkipReason,
  type OrderAlertMessage,
  type OrderAlertOrder,
} from "./order-alert.ts";

const order: OrderAlertOrder = {
  id: "8f14e45f-ceea-467a-9575-3f1c2b7d9e01",
  stripe_session_id: "cs_test_sample123",
  customer_email: "jane.doe@example.com",
  customer_name: "Jane Doe",
  shipping_address: { line1: "12 Baseline Rd", line2: null, city: "Orlando", state: "FL", postal_code: "32801", country: "US" },
  line_items: [
    {
      product_name: "First Serve",
      form: "Whole bean",
      quantity: 2,
      amount_subtotal: 4300,
      amount_discount: 430,
      amount_total: 3870,
    },
  ],
  amount_subtotal: 4300,
  amount_shipping: 0,
  amount_total: 3870,
  currency: "usd",
  payment_status: "paid",
  channel: "retail",
  created_at: "2026-09-25T17:17:00.000Z",
};

const quiet = () => {};

test("recipient defaults to info@ and honors ORDER_ALERT_EMAIL", () => {
  assert.equal(DEFAULT_ORDER_ALERT_EMAIL, "info@nextpointcoffee.com");
  assert.equal(orderAlertRecipient({} as NodeJS.ProcessEnv), "info@nextpointcoffee.com");
  assert.equal(orderAlertRecipient({ ORDER_ALERT_EMAIL: "  " } as NodeJS.ProcessEnv), "info@nextpointcoffee.com");
  assert.equal(orderAlertRecipient({ ORDER_ALERT_EMAIL: "not-an-email" } as NodeJS.ProcessEnv), "info@nextpointcoffee.com");
  assert.equal(orderAlertRecipient({ ORDER_ALERT_EMAIL: "ops@example.com" } as NodeJS.ProcessEnv), "ops@example.com");
  assert.equal(
    orderAlertRecipient({ ORDER_ALERT_EMAIL: "a@example.com, b@example.com\r\nBcc: x@evil.com" } as NodeJS.ProcessEnv),
    "a@example.com"
  );
});

test("subject and body carry customer, items, money, ids, time, and admin link", () => {
  const msg = buildOrderAlertEmail(
    order,
    { phone: "+1 407-555-0142", promoCode: "LAUNCH10", placedAt: 1790356620 },
    {} as NodeJS.ProcessEnv
  );
  assert.equal(msg.to, "info@nextpointcoffee.com");
  assert.equal(msg.replyTo, "jane.doe@example.com");
  assert.equal(msg.subject, "New order: 2x First Serve (Whole Bean) - $38.70 - Jane Doe");

  for (const body of [msg.text, msg.html]) {
    assert.match(body, /Jane Doe/);
    assert.match(body, /jane\.doe@example\.com/);
    assert.match(body, /\+1 407-555-0142/);
    assert.match(body, /12 Baseline Rd/);
    assert.match(body, /Orlando, FL 32801/);
    assert.match(body, /First Serve/);
    assert.match(body, /Whole Bean/);
    assert.match(body, /\$21\.50/); // unit price
    assert.match(body, /\$43\.00/); // subtotal
    assert.match(body, /LAUNCH10/);
    assert.match(body, /-\$4\.30/);
    assert.match(body, /\$38\.70/);
    assert.match(body, /8f14e45f-ceea-467a-9575-3f1c2b7d9e01/);
    assert.match(body, /cs_test_sample123/);
    assert.match(body, /Sep 25, 2026, 1:17 PM EDT/);
    assert.ok(body.includes(ADMIN_ORDERS_URL));
  }
  assert.equal(ADMIN_ORDERS_URL, "https://nextpointcoffee.com/admin/orders");
  assert.match(msg.text, /2 x First Serve \(Whole Bean\) @ \$21\.50 = \$43\.00/);
  assert.match(msg.html, /#191615/);
  assert.match(msg.html, /#F1ECDF/);
  assert.match(msg.html, /#B89251/);
});

test("missing phone/promo and hostile names are handled", () => {
  const msg = buildOrderAlertEmail(
    {
      ...order,
      customer_name: "Eve <script>\r\nBcc: x@evil.com",
      line_items: [
        { description: "Second Wind — Ground", quantity: 1, amount_subtotal: 2150 },
        { product_name: "First Serve", form: "Whole bean", quantity: 1, amount_subtotal: 2150 },
      ],
      amount_subtotal: 4300,
      amount_total: 4300,
    },
    {},
    {} as NodeJS.ProcessEnv
  );
  assert.doesNotMatch(msg.subject, /[\r\n]/);
  assert.equal(msg.subject, "New order: 1x Second Wind (Ground), 1x First Serve (Whole Bean) - $43.00 - Eve <script> Bcc: x@evil.com");
  assert.doesNotMatch(msg.html, /<script>/);
  assert.match(msg.html, /Eve &lt;script&gt;/);
  assert.match(msg.text, /Phone: —/);
  assert.doesNotMatch(msg.text, /Discount/);
  assert.doesNotMatch(msg.text, /Promo code/);
  assert.match(msg.text, /Placed: Sep 25, 2026, 1:17 PM EDT/); // falls back to created_at
});

test("renewal label for subscription invoices", () => {
  const msg = buildOrderAlertEmail({ ...order, stripe_session_id: "in_sample" }, { kind: "renewal" }, {} as NodeJS.ProcessEnv);
  assert.match(msg.subject, /^New subscription renewal: /);
  assert.match(msg.text, /Stripe invoice: in_sample/);
});

test("eastern time formatting handles EST and bad input", () => {
  assert.equal(formatEasternTime("2026-12-01T15:05:00Z"), "Dec 1, 2026, 10:05 AM EST");
  assert.equal(formatEasternTime("nope"), null);
  assert.equal(formatEasternTime(null), null);
});

test("skip rules: unpaid, stamped, and redelivery without the column", () => {
  assert.equal(orderAlertSkipReason(null), "no_order");
  assert.equal(orderAlertSkipReason({ ...order, payment_status: "unpaid" }), "not_paid");
  // Column present.
  assert.equal(orderAlertSkipReason({ ...order, order_alert_sent_at: "2026-09-25T17:18:00Z" }), "already_sent");
  assert.equal(orderAlertSkipReason({ ...order, order_alert_sent_at: null }, { wasPaidBefore: true }), null);
  // Column absent (migration not applied): only the delivery that made it paid.
  assert.equal(orderAlertSkipReason(order, { wasPaidBefore: true }), "already_paid");
  assert.equal(orderAlertSkipReason(order, { wasPaidBefore: false }), null);
  assert.equal(orderAlertSkipReason(order, { wasPaidBefore: null }), null);
});

test("sends once and stamps; replay with stamp does not resend", async () => {
  const sent: OrderAlertMessage[] = [];
  const stamps: string[] = [];
  const deps = {
    send: async (m: OrderAlertMessage) => {
      sent.push(m);
    },
    markSent: async (id: string, at: string) => {
      stamps.push(`${id}:${at}`);
    },
    now: () => "2026-09-25T17:18:00.000Z",
    env: {} as NodeJS.ProcessEnv,
    log: quiet,
  };
  const first = await deliverOrderAlert({ ...order, order_alert_sent_at: null }, { wasPaidBefore: null }, deps);
  assert.equal(first.status, "sent");
  assert.equal(first.to, "info@nextpointcoffee.com");
  assert.deepEqual(stamps, [`${order.id}:2026-09-25T17:18:00.000Z`]);

  const replay = await deliverOrderAlert(
    { ...order, order_alert_sent_at: "2026-09-25T17:18:00.000Z" },
    { wasPaidBefore: true },
    deps
  );
  assert.equal(replay.status, "skipped");
  assert.equal(replay.reason, "already_sent");
  assert.equal(sent.length, 1);

  const noColumnReplay = await deliverOrderAlert(order, { wasPaidBefore: true }, deps);
  assert.equal(noColumnReplay.status, "skipped");
  assert.equal(sent.length, 1);
});

test("mail and stamp failures never throw", async () => {
  const failed = await deliverOrderAlert(order, {}, {
    send: async () => {
      throw new Error("GMAIL_USER or GMAIL_APP_PASSWORD is not set.");
    },
    env: {} as NodeJS.ProcessEnv,
    log: quiet,
  });
  assert.equal(failed.status, "failed");
  assert.match(failed.error ?? "", /GMAIL_USER/);

  const stampFail = await deliverOrderAlert(order, {}, {
    send: async () => {},
    markSent: async () => {
      throw new Error("column order_alert_sent_at does not exist");
    },
    env: {} as NodeJS.ProcessEnv,
    log: quiet,
  });
  assert.equal(stampFail.status, "sent");
  assert.match(stampFail.warning ?? "", /order_alert_sent_at/);

  const badData = await deliverOrderAlert(
    { ...order, line_items: "garbage", shipping_address: 42 as unknown, customer_email: "" },
    {},
    { send: async () => {}, env: {} as NodeJS.ProcessEnv, log: quiet }
  );
  assert.equal(badData.status, "sent");
});
