import { attachRetailForm } from "@/lib/retail-checkout";
import { grindLabel, isGrindId, retailMaxQuantity, type GrindId } from "@/lib/site";

/**
 * Paid-order ingest for VolleyTrack/nextpoint-books (CPA sales).
 *
 * One POST per paid Stripe Checkout. Books must upsert on `stripe_session_id`
 * (also sent as Idempotency-Key). Replays update the same sale; they do not
 * insert another one.
 *
 * This is separate from BOOKS_WEBHOOK_URL, which still carries campaign ledger
 * events (including payouts and simulated sales).
 */

export const BOOKS_ORDER_SOURCE = "next-point-coffee" as const;
export const BOOKS_ORDER_CONTRACT = "paid-order" as const;
export const BOOKS_ORDER_CONTRACT_VERSION = 1 as const;

export type OrderChannel = "retail" | "campaign";

export interface BooksOrderIngestBody {
  source: typeof BOOKS_ORDER_SOURCE;
  contract: typeof BOOKS_ORDER_CONTRACT;
  contract_version: typeof BOOKS_ORDER_CONTRACT_VERSION;
  channel: OrderChannel;
  /** Set for campaign checkouts. Null for retail. */
  campaign_id: string | null;
  /** Set for campaign checkouts. Null for retail. */
  campaign_name: string | null;
  /** ISO-8601, from the Stripe Checkout session `created` time. */
  order_date: string;
  /**
   * Stripe Checkout `amount_total` in cents (products plus shipping when
   * shipping is charged as its own line). Retail bag prices already include
   * shipping, so retail gross equals the bag total.
   */
  gross_amount_cents: number;
  currency: string;
  stripe_session_id: string;
  /** public.orders.id */
  order_id: string;
  /**
   * Cents owed to the campaign organization (bag share × quantity).
   * Null for retail, and null when a campaign checkout could not resolve the
   * org bag share. `0` means the split applies and the share is zero.
   * Shipping is not part of this amount.
   */
  campaign_share_owed: number | null;
  /**
   * Retail bags when grind/form was captured. Omitted for campaign checkouts
   * and for older retail orders that have no form.
   */
  items?: BooksOrderItem[];
}

export interface BooksOrderItem {
  product_slug: string;
  product_name: string;
  /** Stable id: `ground` or `whole-bean`. */
  grind: GrindId;
  /** Customer label: Ground or Whole bean. */
  form: string;
  quantity: number;
}

export interface CheckoutOrderInput {
  id: string;
  created: number | null;
  amount_subtotal: number;
  amount_shipping: number;
  amount_total: number;
  currency: string | null;
  payment_status: string | null;
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
  line_items: unknown;
  metadata: Record<string, string> | null;
}

export interface ResolvedCampaign {
  id: string;
  name: string;
  bagShareCents: number;
}

export interface OrderInsert {
  stripe_session_id: string;
  customer_email: string;
  customer_name: string | null;
  shipping_address: unknown;
  line_items: unknown;
  amount_subtotal: number;
  amount_shipping: number;
  amount_total: number;
  currency: string;
  payment_status: string;
  channel: OrderChannel;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_share_owed: number | null;
}

export interface BooksIngestAlert {
  subject: string;
  text: string;
}

export interface BooksIngestSynced {
  ok: true;
  status: "synced";
  attempts: number;
  detail: null;
}

export interface BooksIngestSkipped {
  ok: true;
  status: "skipped";
  attempts: number;
  detail: string;
}

export interface BooksIngestFailed {
  ok: false;
  status: "failed";
  attempts: number;
  error: string;
  alert: BooksIngestAlert;
}

export type BooksIngestResult = BooksIngestSynced | BooksIngestSkipped | BooksIngestFailed;

export type OrderBooksSyncStatus = "pending" | "synced" | "failed" | "skipped";

/** Site order row the ingest path reads. Matches public.orders. */
export interface PaidOrderRecord {
  id: string;
  stripe_session_id: string;
  amount_total: number;
  currency: string;
  payment_status: string;
  channel: OrderChannel;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_share_owed: number | null;
  books_sync_status: OrderBooksSyncStatus;
  created_at: string;
}

export interface BooksSyncPatch {
  books_sync_status: OrderBooksSyncStatus;
  books_last_error: string | null;
  books_synced_at: string | null;
}

export const BOOKS_INGEST_MAX_ATTEMPTS = 3;
export const BOOKS_INGEST_RETRY_DELAYS_MS = [250, 1000];
const BOOKS_INGEST_TIMEOUT_MS = 3500;

export function booksIngestLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>
): void {
  const line = JSON.stringify({ source: BOOKS_ORDER_SOURCE, event, ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

export function isPaidCheckout(paymentStatus: string | null | undefined): boolean {
  return paymentStatus === "paid" || paymentStatus === "no_payment_required";
}

/** Campaign metadata wins over an explicit retail channel. */
export function checkoutChannel(metadata: Record<string, string> | null | undefined): OrderChannel {
  if (!metadata) return "retail";
  if (metadata.campaignId || metadata.channel === "campaign") return "campaign";
  return "retail";
}

export function checkoutQuantity(metadata: Record<string, string> | null | undefined, lineItems: unknown): number {
  const fromMeta = Number(metadata?.quantity);
  if (Number.isFinite(fromMeta) && fromMeta >= 1) {
    return Math.min(20, Math.floor(fromMeta));
  }
  if (Array.isArray(lineItems)) {
    const sum = lineItems.reduce((total, item) => {
      const qty = Number((item as { quantity?: unknown })?.quantity);
      return total + (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0);
    }, 0);
    if (sum >= 1) return Math.min(20, sum);
  }
  return 1;
}

export function orderDateIso(createdUnix: number | null, fallbackIso: string): string {
  if (typeof createdUnix === "number" && Number.isFinite(createdUnix) && createdUnix > 0) {
    return new Date(createdUnix * 1000).toISOString();
  }
  return fallbackIso;
}

/**
 * Books ingest is required when BOOKS_ORDER_INGEST is on, and when the flag
 * is unset in Vercel production. An explicit off skips the POST. Production
 * does not default to a silent drop.
 */
export function booksIngestRequired(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.BOOKS_ORDER_INGEST ?? "").trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off" || flag === "no") return false;
  if (flag === "true" || flag === "1" || flag === "on" || flag === "yes" || flag === "required") return true;
  return env.VERCEL_ENV === "production";
}

export function buildOrderInsert(input: CheckoutOrderInput, campaign: ResolvedCampaign | null): OrderInsert {
  const channel = checkoutChannel(input.metadata);
  const campaignId = channel === "campaign" ? campaign?.id ?? input.metadata?.campaignId ?? null : null;
  const campaignName =
    channel === "campaign" ? campaign?.name ?? nonempty(input.metadata?.campaignName) : null;
  const campaignShare =
    channel === "campaign" && campaign
      ? bagShareCents(campaign) * checkoutQuantity(input.metadata, input.line_items)
      : null;

  return {
    stripe_session_id: input.id,
    customer_email: input.customer_email,
    customer_name: input.customer_name,
    shipping_address: input.shipping_address,
    line_items: attachRetailForm(input.line_items, input.metadata),
    amount_subtotal: input.amount_subtotal,
    amount_shipping: input.amount_shipping,
    amount_total: input.amount_total,
    currency: (input.currency || "usd").toLowerCase(),
    payment_status: input.payment_status ?? "unknown",
    channel,
    campaign_id: campaignId,
    campaign_name: campaignName,
    campaign_share_owed: campaignShare,
  };
}

export function mergeCampaignFields<T extends OrderInsert>(existing: {
  channel?: OrderChannel;
  campaign_id: string | null;
  campaign_name: string | null;
  campaign_share_owed: number | null;
} | null, draft: T): T {
  if (!existing || draft.channel !== "campaign") return draft;
  return {
    ...draft,
    campaign_id: draft.campaign_id ?? existing.campaign_id,
    campaign_name: draft.campaign_name ?? existing.campaign_name,
    campaign_share_owed: draft.campaign_share_owed ?? existing.campaign_share_owed,
  };
}

export function buildBooksOrderIngestBody(
  order: {
    id: string;
    stripe_session_id: string;
    amount_total: number;
    currency: string;
    channel: OrderChannel;
    campaign_id: string | null;
    campaign_name: string | null;
    campaign_share_owed: number | null;
    line_items?: unknown;
  },
  orderDate: string
): BooksOrderIngestBody {
  const campaign = order.channel === "campaign";
  const items = booksItemsFromLineItems(order.line_items);
  return {
    source: BOOKS_ORDER_SOURCE,
    contract: BOOKS_ORDER_CONTRACT,
    contract_version: BOOKS_ORDER_CONTRACT_VERSION,
    channel: order.channel,
    campaign_id: campaign ? order.campaign_id : null,
    campaign_name: campaign ? order.campaign_name : null,
    order_date: orderDate,
    gross_amount_cents: order.amount_total,
    currency: (order.currency || "usd").toLowerCase(),
    stripe_session_id: order.stripe_session_id,
    order_id: order.id,
    campaign_share_owed: campaign ? order.campaign_share_owed : null,
    ...(items ? { items } : {}),
  };
}

function booksItemsFromLineItems(lineItems: unknown): BooksOrderItem[] | undefined {
  if (!Array.isArray(lineItems)) return undefined;
  const items: BooksOrderItem[] = [];
  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (!isGrindId(row.grind)) continue;
    const product_slug = typeof row.product_slug === "string" ? row.product_slug.trim() : "";
    const product_name = typeof row.product_name === "string" ? row.product_name.trim() : "";
    if (!product_slug || !product_name) continue;
    const quantity = Number(row.quantity);
    const form = typeof row.form === "string" && row.form.trim() ? row.form.trim() : grindLabel(row.grind);
    items.push({
      product_slug,
      product_name,
      grind: row.grind,
      form,
      quantity: Number.isFinite(quantity) && quantity >= 1 ? Math.min(retailMaxQuantity, Math.floor(quantity)) : 1,
    });
  }
  return items.length > 0 ? items : undefined;
}

export function booksIngestFailureAlert(
  payload: Pick<
    BooksOrderIngestBody,
    | "stripe_session_id"
    | "order_id"
    | "channel"
    | "campaign_id"
    | "campaign_name"
    | "gross_amount_cents"
    | "currency"
    | "campaign_share_owed"
  >,
  error: string,
  attempts: number
): BooksIngestAlert {
  const text = [
    "A paid Next Point Coffee order was saved on the site, but it was not stored in books.",
    "Checkout was not rolled back. Replay is safe: books must upsert on stripe_session_id.",
    "",
    `Stripe session: ${payload.stripe_session_id}`,
    `Order id: ${payload.order_id}`,
    `Channel: ${payload.channel}`,
    `Campaign id: ${payload.campaign_id ?? "—"}`,
    `Campaign name: ${payload.campaign_name ?? "—"}`,
    `Gross amount (cents): ${payload.gross_amount_cents} ${payload.currency}`,
    `Campaign share owed (cents): ${payload.campaign_share_owed ?? "n/a"}`,
    `Attempts: ${attempts}`,
    "",
    "Error:",
    error,
  ].join("\n");
  return {
    subject: `Books ingest failed: ${payload.stripe_session_id}`,
    text,
  };
}

export interface IngestBooksOrderDeps {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export async function ingestBooksOrder(
  payload: BooksOrderIngestBody,
  deps: IngestBooksOrderDeps = {}
): Promise<BooksIngestResult> {
  const env = deps.env ?? process.env;
  const logFields = {
    stripe_session_id: payload.stripe_session_id,
    order_id: payload.order_id,
    channel: payload.channel,
    campaign_id: payload.campaign_id,
  };

  if (!booksIngestRequired(env)) {
    const detail =
      "BOOKS_ORDER_INGEST is off, so this paid order was not sent to books. Set BOOKS_ORDER_INGEST=true with BOOKS_INGEST_URL and BOOKS_INGEST_SECRET.";
    const level = env.VERCEL_ENV === "production" ? "error" : "warn";
    booksIngestLog(level, "books.ingest.skipped", { ...logFields, reason: detail, vercel_env: env.VERCEL_ENV ?? null });
    return { ok: true, status: "skipped", attempts: 0, detail };
  }

  const url = env.BOOKS_INGEST_URL?.trim() ?? "";
  const secret = env.BOOKS_INGEST_SECRET?.trim() ?? "";
  const missing = [
    !url ? "BOOKS_INGEST_URL" : "",
    !secret ? "BOOKS_INGEST_SECRET" : "",
    url && !isHttpUrl(url) ? "BOOKS_INGEST_URL (must be an http(s) URL)" : "",
  ].filter(Boolean);

  if (missing.length > 0 || !payloadLooksValid(payload)) {
    const error = !payloadLooksValid(payload)
      ? "Paid order payload is missing stripe_session_id, order_id, or a whole-cent gross amount."
      : `Books ingest is required but ${missing.join(" and ")} is unset. The paid order is saved on the site and was not sent to books.`;
    const alert = booksIngestFailureAlert(payload, error, 0);
    booksIngestLog("error", missing.length > 0 ? "books.ingest.unconfigured" : "books.ingest.failed", {
      ...logFields,
      attempts: 0,
      error,
      email_subject: alert.subject,
      email_text: alert.text,
    });
    return { ok: false, status: "failed", attempts: 0, error, alert };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const sleep = deps.sleep ?? delay;
  let lastError = "Books ingest failed";
  let attempts = 0;

  for (let attempt = 1; attempt <= BOOKS_INGEST_MAX_ATTEMPTS; attempt += 1) {
    attempts = attempt;
    const outcome = await postOnce(url, secret, payload, fetchImpl);
    if (outcome.ok) {
      booksIngestLog("info", "books.ingest.synced", {
        ...logFields,
        attempts,
        http_status: outcome.status,
        duplicate: outcome.status === 409,
        campaign_share_owed: payload.campaign_share_owed,
        share_resolved: payload.channel !== "campaign" || payload.campaign_share_owed !== null,
      });
      if (payload.channel === "campaign" && payload.campaign_share_owed === null) {
        booksIngestLog("error", "books.ingest.share_unresolved", {
          ...logFields,
          error: "Campaign order ingested without campaign_share_owed. The org bag share was not resolved.",
        });
      }
      return { ok: true, status: "synced", attempts, detail: null };
    }

    lastError = outcome.error;
    const retriesLeft = attempt < BOOKS_INGEST_MAX_ATTEMPTS && outcome.retryable;
    if (retriesLeft) {
      const waitMs = BOOKS_INGEST_RETRY_DELAYS_MS[attempt - 1] ?? 1000;
      booksIngestLog("warn", "books.ingest.retry", {
        ...logFields,
        attempts,
        wait_ms: waitMs,
        error: lastError,
      });
      await sleep(waitMs);
      continue;
    }
    break;
  }

  const alert = booksIngestFailureAlert(payload, lastError, attempts);
  booksIngestLog("error", "books.ingest.failed", {
    ...logFields,
    attempts,
    error: lastError,
    email_subject: alert.subject,
    email_text: alert.text,
  });
  return { ok: false, status: "failed", attempts, error: lastError, alert };
}

function payloadLooksValid(payload: BooksOrderIngestBody): boolean {
  return Boolean(
    payload.stripe_session_id &&
      payload.order_id &&
      (payload.channel === "retail" || payload.channel === "campaign") &&
      Number.isInteger(payload.gross_amount_cents) &&
      payload.gross_amount_cents >= 0 &&
      payload.currency &&
      payload.order_date
  );
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Same rule as earningsPerBagCents: the org's contracted per-bag share. */
function bagShareCents(org: { bagShareCents: number }): number {
  return Math.max(0, Math.round(org.bagShareCents || 0));
}

function nonempty(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postOnce(
  url: string,
  secret: string,
  payload: BooksOrderIngestBody,
  fetchImpl: typeof fetch
): Promise<{ ok: true; status: number } | { ok: false; error: string; retryable: boolean }> {
  try {
    const res = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
        "Idempotency-Key": payload.stripe_session_id,
        "X-NPC-Source": BOOKS_ORDER_SOURCE,
        "X-NPC-Contract": BOOKS_ORDER_CONTRACT,
        "X-NPC-Contract-Version": String(BOOKS_ORDER_CONTRACT_VERSION),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(BOOKS_INGEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (res.ok || res.status === 409) return { ok: true, status: res.status };
    const snippet = (await res.text()).slice(0, 300).replace(/\s+/g, " ").trim();
    const retryable = res.status === 408 || res.status === 429 || res.status >= 500;
    return {
      ok: false,
      retryable,
      error: `Books ingest returned ${res.status}${snippet ? `: ${snippet}` : ""}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Books ingest request failed";
    return { ok: false, retryable: true, error: message };
  }
}

export interface SaveCheckoutDeps<TOrder extends PaidOrderRecord> {
  getOrder: (sessionId: string) => Promise<TOrder | null>;
  record: (order: OrderInsert) => Promise<TOrder>;
}

export async function saveCheckoutOrder<TOrder extends PaidOrderRecord>(
  input: CheckoutOrderInput,
  campaign: ResolvedCampaign | null,
  deps: SaveCheckoutDeps<TOrder>
): Promise<TOrder> {
  const existing = await deps.getOrder(input.id);
  const draft = mergeCampaignFields(existing, buildOrderInsert(input, campaign));
  return deps.record(draft);
}

export interface SyncPaidOrderDeps extends IngestBooksOrderDeps {
  updateSync: (sessionId: string, patch: BooksSyncPatch) => Promise<void>;
  notify?: (alert: BooksIngestAlert) => Promise<unknown>;
  now?: () => string;
}

/**
 * Push one paid order into books and store the outcome on the row.
 * A row already marked synced is not posted again. Books failures do not throw.
 */
export async function syncPaidOrderToBooks(
  order: PaidOrderRecord & { line_items?: unknown },
  context: { orderDate: string },
  deps: SyncPaidOrderDeps
): Promise<BooksIngestResult> {
  if (order.books_sync_status === "synced") {
    booksIngestLog("info", "books.ingest.already_synced", {
      stripe_session_id: order.stripe_session_id,
      order_id: order.id,
      channel: order.channel,
    });
    return { ok: true, status: "synced", attempts: 0, detail: null };
  }

  const payload = buildBooksOrderIngestBody(order, context.orderDate);
  const result = await ingestBooksOrder(payload, deps);
  const now = deps.now ?? (() => new Date().toISOString());

  try {
    await deps.updateSync(order.stripe_session_id, {
      books_sync_status: result.status,
      books_last_error: result.ok ? (result.status === "skipped" ? result.detail : null) : result.error,
      books_synced_at: result.status === "synced" ? now() : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not persist books sync status";
    const alert = booksIngestFailureAlert(
      payload,
      result.ok
        ? `Books accepted the order, but the site could not mark it synced. ${message}`
        : `${result.error} Also failed to save books_sync_status: ${message}`,
      result.attempts
    );
    booksIngestLog("error", "books.ingest.status_persist_failed", {
      stripe_session_id: order.stripe_session_id,
      order_id: order.id,
      error: message,
      email_subject: alert.subject,
      email_text: alert.text,
    });
    await deliverAlert(alert, deps.notify);
    if (result.ok) {
      return {
        ok: false,
        status: "failed",
        attempts: result.attempts,
        error: alert.text,
        alert,
      };
    }
    return result;
  }

  if (!result.ok) await deliverAlert(result.alert, deps.notify);
  return result;
}

export interface PaidCheckoutSyncResult<TOrder extends PaidOrderRecord> {
  order: TOrder | null;
  books: BooksIngestResult | null;
}

/**
 * Save the site order, then ingest when Stripe has collected payment.
 * Never throws: a books or database failure leaves checkout success intact.
 */
export async function recordPaidCheckout<TOrder extends PaidOrderRecord>(
  input: CheckoutOrderInput,
  campaign: ResolvedCampaign | null,
  deps: SaveCheckoutDeps<TOrder> & SyncPaidOrderDeps & { notifySaveFailure?: (alert: BooksIngestAlert) => Promise<unknown> }
): Promise<PaidCheckoutSyncResult<TOrder>> {
  let order: TOrder;
  try {
    order = await saveCheckoutOrder(input, campaign, deps);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not save the paid order";
    const alert = booksIngestFailureAlert(
      {
        stripe_session_id: input.id,
        order_id: "unrecorded",
        channel: checkoutChannel(input.metadata),
        campaign_id: input.metadata?.campaignId ?? null,
        campaign_name: input.metadata?.campaignName ?? null,
        gross_amount_cents: input.amount_total,
        currency: (input.currency || "usd").toLowerCase(),
        campaign_share_owed: null,
      },
      `The paid order was not saved on the site, so books ingest did not run. ${message}`,
      0
    );
    booksIngestLog("error", "orders.record.failed", {
      stripe_session_id: input.id,
      error: message,
      email_subject: alert.subject,
      email_text: alert.text,
    });
    await deliverAlert(alert, deps.notifySaveFailure ?? deps.notify);
    return { order: null, books: null };
  }

  if (!isPaidCheckout(order.payment_status)) {
    booksIngestLog("info", "books.ingest.deferred", {
      stripe_session_id: order.stripe_session_id,
      order_id: order.id,
      payment_status: order.payment_status,
    });
    return { order, books: null };
  }

  const books = await syncPaidOrderToBooks(order, { orderDate: orderDateIso(input.created, order.created_at) }, deps);
  return { order, books };
}

async function deliverAlert(
  alert: BooksIngestAlert,
  notify: ((alert: BooksIngestAlert) => Promise<unknown>) | undefined
): Promise<void> {
  try {
    if (notify) {
      await notify(alert);
      return;
    }
    const mailer = await import("@/lib/mailer");
    await mailer.notifyBooksIngestFailure(alert);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Books alert email failed";
    booksIngestLog("error", "books.ingest.email_failed", {
      error: message,
      email_subject: alert.subject,
      email_text: alert.text,
    });
  }
}
