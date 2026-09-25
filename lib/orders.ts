const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

export type OrderChannel = "retail" | "campaign";
export type OrderBooksSyncStatus = "pending" | "synced" | "failed" | "skipped";

export interface OrderRow {
  id: string;
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
  fulfillment_status: string;
  channel: OrderChannel;
  campaign_id: string | null;
  campaign_name: string | null;
  /** Cents owed to the campaign org. Null when the split does not apply. */
  campaign_share_owed: number | null;
  books_sync_status: OrderBooksSyncStatus;
  books_last_error: string | null;
  books_synced_at: string | null;
  /** Null until the pre-order confirmation email is sent. */
  confirmation_email_sent_at?: string | null;
  created_at: string;
}

export interface NewOrder {
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

export interface BooksSyncPatch {
  books_sync_status: OrderBooksSyncStatus;
  books_last_error: string | null;
  books_synced_at: string | null;
}

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase env vars are not configured.");
  }
}

function headers(prefer?: string): Record<string, string> {
  const value: Record<string, string> = {
    apikey: SUPABASE_SERVICE_KEY as string,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  if (prefer) value.Prefer = prefer;
  return value;
}

/**
 * Insert or update the Stripe session row. Books sync columns are not in the
 * body, so a replay does not clear a successful ingest.
 */
export async function recordOrder(order: NewOrder): Promise<OrderRow> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?on_conflict=stripe_session_id`, {
    method: "POST",
    headers: headers("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify([order]),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase order insert failed: ${res.status} ${text}`);
  }

  const rows = (await res.json()) as OrderRow[];
  const row = rows[0];
  if (!row) throw new Error("Supabase order upsert returned no row.");
  return row;
}

export async function listOrders(): Promise<OrderRow[]> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, {
    headers: headers(),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase orders fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getOrderById(orderId: string): Promise<OrderRow | null> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?id=eq.${encodeURIComponent(orderId)}&select=*`,
    {
      headers: headers(),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase order fetch failed: ${res.status} ${text}`);
  }
  const rows = (await res.json()) as OrderRow[];
  return rows[0] ?? null;
}

/** Set after a successful confirmation email. Not part of the checkout upsert. */
export async function markConfirmationEmailSent(orderId: string, sentAt: string): Promise<void> {
  await patchOrderBy("id", orderId, { confirmation_email_sent_at: sentAt });
}

export async function getOrderBySessionId(sessionId: string): Promise<OrderRow | null> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    {
      headers: headers(),
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const rows = (await res.json()) as OrderRow[];
  return rows[0] ?? null;
}

export async function updateOrderBooksSync(sessionId: string, patch: BooksSyncPatch): Promise<void> {
  const lastError = patch.books_last_error ? patch.books_last_error.slice(0, 1000) : null;
  await patchOrder(sessionId, {
    books_sync_status: patch.books_sync_status,
    books_last_error: lastError,
    books_synced_at: patch.books_synced_at,
  });
}

/** Leave a row when Stripe says the payment will not complete. Does not touch a synced ingest. */
export async function markOrderPaymentIncomplete(sessionId: string, paymentStatus: string): Promise<void> {
  const existing = await getOrderBySessionId(sessionId);
  if (!existing || existing.books_sync_status === "synced") return;
  await patchOrder(sessionId, {
    payment_status: paymentStatus,
    books_sync_status: "skipped",
    books_last_error: "Stripe payment did not complete.",
    books_synced_at: null,
  });
}

async function patchOrder(sessionId: string, patch: Record<string, unknown>): Promise<void> {
  await patchOrderBy("stripe_session_id", sessionId, patch);
}

async function patchOrderBy(
  column: "id" | "stripe_session_id",
  value: string,
  patch: Record<string, unknown>
): Promise<void> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?${column}=eq.${encodeURIComponent(value)}`,
    {
      method: "PATCH",
      headers: headers("return=minimal"),
      body: JSON.stringify(patch),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase order update failed: ${res.status} ${text}`);
  }
}
