const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
  created_at: string;
}

interface NewOrder {
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
}

function assertConfigured() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error("Supabase env vars are not configured.");
  }
}

export async function recordOrder(order: NewOrder): Promise<void> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_SERVICE_KEY as string,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=representation",
    },
    body: JSON.stringify([order]),
  });

  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`Supabase order insert failed: ${res.status} ${text}`);
  }
}

export async function listOrders(): Promise<OrderRow[]> {
  assertConfigured();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`, {
    headers: {
      apikey: SUPABASE_SERVICE_KEY as string,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase orders fetch failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getOrderBySessionId(sessionId: string): Promise<OrderRow | null> {
  assertConfigured();
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/orders?stripe_session_id=eq.${encodeURIComponent(sessionId)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_KEY as string,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0] ?? null;
}
