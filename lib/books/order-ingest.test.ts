import assert from "node:assert/strict";
import test from "node:test";
import type { OrderRow } from "../orders.ts";
import {
  BOOKS_INGEST_MAX_ATTEMPTS,
  booksIngestRequired,
  buildBooksOrderIngestBody,
  buildOrderInsert,
  checkoutChannel,
  ingestBooksOrder,
  mergeCampaignFields,
  type BooksOrderIngestBody,
  type CheckoutOrderInput,
  recordPaidCheckout,
  saveCheckoutOrder,
  syncPaidOrderToBooks,
} from "./order-ingest.ts";

const SESSION = "cs_test_idempotent_1";

function checkout(overrides: Partial<CheckoutOrderInput> = {}): CheckoutOrderInput {
  return {
    id: SESSION,
    created: 1_758_000_000,
    amount_subtotal: 4000,
    amount_shipping: 650,
    amount_total: 4650,
    currency: "usd",
    payment_status: "paid",
    customer_email: "buyer@example.com",
    customer_name: "Buyer",
    shipping_address: null,
    line_items: [{ quantity: 2 }],
    metadata: { channel: "retail" },
    ...overrides,
  };
}

function order(overrides: Partial<OrderRow> = {}): OrderRow {
  return {
    id: "order-1",
    stripe_session_id: SESSION,
    customer_email: "buyer@example.com",
    customer_name: "Buyer",
    shipping_address: null,
    line_items: [],
    amount_subtotal: 4000,
    amount_shipping: 0,
    amount_total: 4000,
    currency: "usd",
    payment_status: "paid",
    fulfillment_status: "unfulfilled",
    channel: "retail",
    campaign_id: null,
    campaign_name: null,
    campaign_share_owed: null,
    books_sync_status: "pending",
    books_last_error: null,
    books_synced_at: null,
    created_at: "2026-09-23T12:00:00.000Z",
    ...overrides,
  };
}

function enabledEnv(extra: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    BOOKS_ORDER_INGEST: "true",
    BOOKS_INGEST_URL: "https://books.example/ingest",
    BOOKS_INGEST_SECRET: "secret-value",
    ...extra,
  };
}

function captureConsole() {
  const lines: { level: string; line: string }[] = [];
  const orig = { error: console.error, warn: console.warn, info: console.info };
  for (const level of ["error", "warn", "info"] as const) {
    console[level] = (...args: unknown[]) => {
      lines.push({ level, line: args.map((part) => String(part)).join(" ") });
    };
  }
  return {
    lines,
    restore() {
      console.error = orig.error;
      console.warn = orig.warn;
      console.info = orig.info;
    },
  };
}

function header(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

test("retail and campaign checkouts are tagged separately", () => {
  assert.equal(checkoutChannel({ channel: "retail" }), "retail");
  assert.equal(checkoutChannel(null), "retail");
  assert.equal(checkoutChannel({ channel: "campaign", campaignId: "cmp-1" }), "campaign");
  assert.equal(checkoutChannel({ channel: "retail", campaignId: "cmp-1" }), "campaign");

  const retail = buildOrderInsert(checkout(), null);
  assert.equal(retail.channel, "retail");
  assert.equal(retail.campaign_id, null);
  assert.equal(retail.campaign_name, null);
  assert.equal(retail.campaign_share_owed, null);
  assert.equal(retail.amount_total, 4650);

  const campaign = buildOrderInsert(
    checkout({
      metadata: {
        channel: "campaign",
        campaignId: "cmp-1",
        campaignName: "Metadata name",
        quantity: "2",
      },
    }),
    { id: "cmp-1", name: "Maya Season Fund", bagShareCents: 300 }
  );
  assert.equal(campaign.channel, "campaign");
  assert.equal(campaign.campaign_id, "cmp-1");
  assert.equal(campaign.campaign_name, "Maya Season Fund");
  assert.equal(campaign.campaign_share_owed, 600);

  const unresolved = buildOrderInsert(
    checkout({
      metadata: { channel: "campaign", campaignId: "cmp-9", campaignName: "From Stripe", quantity: "1" },
    }),
    null
  );
  assert.equal(unresolved.campaign_id, "cmp-9");
  assert.equal(unresolved.campaign_name, "From Stripe");
  assert.equal(unresolved.campaign_share_owed, null);
});

test("a later lookup does not wipe a campaign share already stored", () => {
  const draft = buildOrderInsert(
    checkout({ metadata: { channel: "campaign", campaignId: "cmp-1", quantity: "2" } }),
    null
  );
  const merged = mergeCampaignFields(
    {
      channel: "campaign",
      campaign_id: "cmp-1",
      campaign_name: "Maya Season Fund",
      campaign_share_owed: 600,
    },
    draft
  );
  assert.equal(merged.campaign_name, "Maya Season Fund");
  assert.equal(merged.campaign_share_owed, 600);
});

test("ingest body uses gross cents and omits campaign fields for retail", () => {
  const body = buildBooksOrderIngestBody(order({ amount_total: 2150 }), "2026-09-23T15:04:05.000Z");
  assert.deepEqual(body, {
    source: "next-point-coffee",
    contract: "paid-order",
    contract_version: 1,
    channel: "retail",
    campaign_id: null,
    campaign_name: null,
    order_date: "2026-09-23T15:04:05.000Z",
    gross_amount_cents: 2150,
    currency: "usd",
    stripe_session_id: SESSION,
    order_id: "order-1",
    campaign_share_owed: null,
  } satisfies BooksOrderIngestBody);
});

test("the same stripe session is idempotent across retries and replays", async () => {
  const logs = captureConsole();
  const seen: { key: string | null; session: string; auth: string | null }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    const raw = typeof init?.body === "string" ? init.body : "";
    const body = JSON.parse(raw) as BooksOrderIngestBody;
    seen.push({
      key: header(init, "Idempotency-Key"),
      session: body.stripe_session_id,
      auth: header(init, "Authorization"),
    });
    if (seen.length === 1) return new Response("unavailable", { status: 503 });
    return new Response(JSON.stringify({ error: "duplicate" }), { status: 409 });
  };

  try {
    const payload = buildBooksOrderIngestBody(
      order({
        channel: "campaign",
        campaign_id: "cmp-1",
        campaign_name: "Maya Season Fund",
        campaign_share_owed: 600,
        amount_total: 4650,
      }),
      "2026-09-23T15:04:05.000Z"
    );
    const first = await ingestBooksOrder(payload, {
      env: enabledEnv(),
      fetchImpl,
      sleep: async () => undefined,
    });
    assert.equal(first.ok, true);
    assert.equal(first.status, "synced");
    assert.equal(first.attempts, 2);

    const second = await ingestBooksOrder(payload, {
      env: enabledEnv(),
      fetchImpl: async (_url, init) => {
        const raw = typeof init?.body === "string" ? init.body : "";
        const body = JSON.parse(raw) as BooksOrderIngestBody;
        seen.push({
          key: header(init, "Idempotency-Key"),
          session: body.stripe_session_id,
          auth: header(init, "Authorization"),
        });
        return new Response(null, { status: 200 });
      },
      sleep: async () => undefined,
    });
    assert.equal(second.status, "synced");
    assert.deepEqual(
      seen.map((row) => row.key),
      [SESSION, SESSION, SESSION]
    );
    assert.ok(seen.every((row) => row.session === SESSION));
    assert.ok(seen.every((row) => row.auth === "Bearer secret-value"));
    assert.ok(logs.lines.every((line) => !line.line.includes("secret-value")));
  } finally {
    logs.restore();
  }
});

test("a non-retryable books response fails once and keeps an email-ready log", async () => {
  const logs = captureConsole();
  let calls = 0;
  try {
    const result = await ingestBooksOrder(buildBooksOrderIngestBody(order(), "2026-09-23T15:04:05.000Z"), {
      env: enabledEnv(),
      fetchImpl: async () => {
        calls += 1;
        return new Response("bad payload", { status: 400 });
      },
      sleep: async () => undefined,
    });
    assert.equal(calls, 1);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.alert.subject, new RegExp(SESSION));
      assert.match(result.alert.text, /Checkout was not rolled back/);
      assert.match(result.alert.text, /400/);
    }
    const failed = logs.lines.find((line) => line.line.includes("books.ingest.failed"));
    assert.ok(failed);
    assert.equal(failed?.level, "error");
    assert.match(failed?.line ?? "", /email_text/);
  } finally {
    logs.restore();
  }
});

test("missing books env fails loudly and does not call fetch", async () => {
  const logs = captureConsole();
  let calls = 0;
  try {
    const result = await ingestBooksOrder(buildBooksOrderIngestBody(order(), "2026-09-23T15:04:05.000Z"), {
      env: { BOOKS_ORDER_INGEST: "true", VERCEL_ENV: "production" },
      fetchImpl: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /BOOKS_INGEST_URL/);
    assert.ok(logs.lines.some((line) => line.level === "error" && line.line.includes("books.ingest.unconfigured")));
  } finally {
    logs.restore();
  }
});

test("production does not treat an unset flag as a silent skip", () => {
  assert.equal(booksIngestRequired({ VERCEL_ENV: "production" }), true);
  assert.equal(booksIngestRequired({}), false);
  assert.equal(booksIngestRequired({ BOOKS_ORDER_INGEST: "false", VERCEL_ENV: "production" }), false);
  assert.equal(booksIngestRequired({ BOOKS_ORDER_INGEST: "true" }), true);
});

test("an explicit off skips the POST and logs it", async () => {
  const logs = captureConsole();
  let calls = 0;
  try {
    const result = await ingestBooksOrder(buildBooksOrderIngestBody(order(), "2026-09-23T15:04:05.000Z"), {
      env: { BOOKS_ORDER_INGEST: "false", VERCEL_ENV: "production" },
      fetchImpl: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.status, "skipped");
    assert.ok(logs.lines.some((line) => line.level === "error" && line.line.includes("books.ingest.skipped")));
  } finally {
    logs.restore();
  }
});

test("books outages retry with backoff then give up without throwing", async () => {
  const logs = captureConsole();
  const waits: number[] = [];
  let calls = 0;
  try {
    const result = await ingestBooksOrder(buildBooksOrderIngestBody(order(), "2026-09-23T15:04:05.000Z"), {
      env: enabledEnv(),
      fetchImpl: async () => {
        calls += 1;
        throw new Error("network down");
      },
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    assert.equal(calls, BOOKS_INGEST_MAX_ATTEMPTS);
    assert.deepEqual(waits, [250, 1000]);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /network down/);
  } finally {
    logs.restore();
  }
});

test("a synced order is not posted again", async () => {
  let calls = 0;
  let updates = 0;
  let emails = 0;
  const result = await syncPaidOrderToBooks(
    order({ books_sync_status: "synced" }),
    { orderDate: "2026-09-23T15:04:05.000Z" },
    {
      env: enabledEnv(),
      fetchImpl: async () => {
        calls += 1;
        return new Response(null, { status: 200 });
      },
      updateSync: async () => {
        updates += 1;
      },
      notify: async () => {
        emails += 1;
      },
    }
  );
  assert.equal(result.status, "synced");
  assert.equal(calls, 0);
  assert.equal(updates, 0);
  assert.equal(emails, 0);
});

test("a failed ingest is stored on the order and emailed once", async () => {
  const patches: Array<{ status: string; error: string | null }> = [];
  let emails = 0;
  const result = await syncPaidOrderToBooks(order(), { orderDate: "2026-09-23T15:04:05.000Z" }, {
    env: enabledEnv(),
    fetchImpl: async () => new Response("nope", { status: 500 }),
    sleep: async () => undefined,
    updateSync: async (_session, patch) => {
      patches.push({ status: patch.books_sync_status, error: patch.books_last_error });
    },
    notify: async (alert) => {
      emails += 1;
      assert.match(alert.text, /nope/);
    },
  });
  assert.equal(result.status, "failed");
  assert.equal(emails, 1);
  assert.deepEqual(patches, [{ status: "failed", error: patches[0]?.error ?? "" }]);
  assert.match(patches[0]?.error ?? "", /500/);
});

test("save keeps payment success when books and the order write fail", async () => {
  let emails = 0;
  const saved = await recordPaidCheckout(checkout(), null, {
    getOrder: async () => null,
    record: async () => {
      throw new Error("supabase down");
    },
    notify: async () => {
      emails += 1;
    },
  });
  assert.equal(saved.order, null);
  assert.equal(emails, 1);

  let posts = 0;
  const deferred = await recordPaidCheckout(checkout({ payment_status: "unpaid" }), null, {
    getOrder: async () => null,
    record: async (draft) => order({ payment_status: draft.payment_status, books_sync_status: "pending" }),
    fetchImpl: async () => {
      posts += 1;
      return new Response(null, { status: 200 });
    },
    env: enabledEnv(),
  });
  assert.equal(deferred.order?.payment_status, "unpaid");
  assert.equal(deferred.books, null);
  assert.equal(posts, 0);
});

test("saveCheckoutOrder preserves an existing campaign share", async () => {
  let savedShare: number | null = null;
  const row = await saveCheckoutOrder(
    checkout({ metadata: { channel: "campaign", campaignId: "cmp-1", quantity: "2" } }),
    null,
    {
      getOrder: async () =>
        order({
          channel: "campaign",
          campaign_id: "cmp-1",
          campaign_name: "Maya Season Fund",
          campaign_share_owed: 600,
        }),
      record: async (draft) => {
        savedShare = draft.campaign_share_owed;
        return order({ ...draft, books_sync_status: "pending" });
      },
    }
  );
  assert.equal(savedShare, 600);
  assert.equal(row.campaign_name, "Maya Season Fund");
});
