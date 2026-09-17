import { NextResponse } from "next/server";
import { listOrders } from "@/lib/orders";

function isAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-admin-key");
  const expected = process.env.ADMIN_ACCESS_KEY;
  return Boolean(expected) && provided === expected;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await listOrders();
    return NextResponse.json({ count: rows.length, rows });
  } catch (err) {
    console.error("Admin orders fetch failed:", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
