import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendCustomerMail } from "@/lib/mailer";
import { getOrderById, markShippedEmailSent, updateOrderShipping } from "@/lib/orders";
import { normalizeTrackingNumber, parseCarrier, shipOrder } from "@/lib/order-shipped";

export const dynamic = "force-dynamic";

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** x-admin-key: ADMIN_ACCESS_KEY, or Authorization: Bearer BOOKS_INGEST_SECRET (books app). */
function isAuthorized(request: Request): boolean {
  const adminKey = process.env.ADMIN_ACCESS_KEY;
  const provided = request.headers.get("x-admin-key");
  if (adminKey && provided && safeEqual(provided, adminKey)) return true;

  const booksSecret = process.env.BOOKS_INGEST_SECRET;
  const auth = request.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  return Boolean(booksSecret && bearer && safeEqual(bearer, booksSecret));
}

/**
 * Mark one public.orders row shipped and email the customer tracking.
 * Body: { orderId, carrier: "usps" | "ups" | "fedex", trackingNumber, resend?: boolean }
 * The email is sent once (shipped_email_sent_at). Editing tracking without
 * resend=true only updates the row.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON body is required." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  if (!ORDER_ID.test(orderId)) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }
  const carrier = parseCarrier(body.carrier ?? "usps");
  if (!carrier) {
    return NextResponse.json({ error: "Carrier must be USPS, UPS, or FedEx." }, { status: 400 });
  }
  const trackingNumber = normalizeTrackingNumber(body.trackingNumber);
  if (!trackingNumber) {
    return NextResponse.json({ error: "Enter a valid tracking number." }, { status: 400 });
  }
  const resend = body.resend === true;

  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const result = await shipOrder(
      order,
      { carrier, trackingNumber, resend },
      {
        saveShipping: updateOrderShipping,
        send: (message) => sendCustomerMail(message),
        markEmailSent: markShippedEmailSent,
      }
    );

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
    }
    console.info(
      JSON.stringify({
        source: "next-point-coffee",
        event: "orders.shipped",
        order_id: orderId,
        carrier,
        email: result.email,
        resend,
      })
    );
    return NextResponse.json(result, { status: result.email === "failed" ? 502 : 200 });
  } catch (err) {
    console.error("Mark shipped failed:", err);
    const message = err instanceof Error ? err.message : "Could not mark the order shipped.";
    return NextResponse.json({ ok: false, error: message.slice(0, 300) }, { status: 500 });
  }
}
