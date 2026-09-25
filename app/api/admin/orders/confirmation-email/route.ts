import { NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { sendOrderConfirmation } from "@/lib/send-order-confirmation";

export const dynamic = "force-dynamic";

const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-admin-key");
  const expected = process.env.ADMIN_ACCESS_KEY;
  return Boolean(expected) && provided === expected;
}

/**
 * Resend the pre-order confirmation for one public.orders id.
 * Header: x-admin-key: ADMIN_ACCESS_KEY
 * Body: { "orderId": "32ba6fd5-ead1-417a-aef6-06a4c5f3fdbe" }
 * Sends again even when confirmation_email_sent_at is already set.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let orderId = "";
  try {
    const body = (await request.json()) as { orderId?: unknown };
    orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  } catch {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  if (!ORDER_ID.test(orderId)) {
    return NextResponse.json({ error: "Order id is required." }, { status: 400 });
  }

  try {
    const order = await getOrderById(orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const result = await sendOrderConfirmation(order, { force: true });
    if (result.status === "failed") {
      return NextResponse.json(
        { ok: false, status: result.status, orderId, error: result.error || "Could not send the confirmation email." },
        { status: 502 }
      );
    }
    if (result.status === "skipped") {
      return NextResponse.json(
        { ok: false, status: result.status, reason: result.reason, orderId, error: "That order is not paid." },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      status: result.status,
      orderId,
      to: result.to ?? order.customer_email,
      warning: result.warning ?? null,
    });
  } catch (err) {
    console.error("Confirmation email resend failed:", err);
    return NextResponse.json({ error: "Could not send the confirmation email." }, { status: 500 });
  }
}
