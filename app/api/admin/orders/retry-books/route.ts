import { NextResponse } from "next/server";
import { booksIngestRequired, isPaidCheckout, orderDateIso } from "@/lib/books/order-ingest";
import { syncPaidOrderToBooks } from "@/lib/books/sync-paid-order";
import { listOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const provided = request.headers.get("x-admin-key");
  const expected = process.env.ADMIN_ACCESS_KEY;
  return Boolean(expected) && provided === expected;
}

/** Re-push paid orders whose books ingest is still pending, failed, or skipped. */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!booksIngestRequired()) {
    return NextResponse.json(
      {
        error:
          "Books ingest is off. Set BOOKS_ORDER_INGEST=true plus BOOKS_INGEST_URL and BOOKS_INGEST_SECRET, then retry.",
      },
      { status: 409 }
    );
  }

  try {
    const rows = await listOrders();
    const targets = rows.filter(
      (row) =>
        isPaidCheckout(row.payment_status) &&
        (row.books_sync_status === "failed" ||
          row.books_sync_status === "pending" ||
          row.books_sync_status === "skipped")
    );

    let synced = 0;
    let failed = 0;
    let skipped = 0;
    for (const row of targets) {
      const result = await syncPaidOrderToBooks(row, { orderDate: orderDateIso(null, row.created_at) });
      if (result.status === "synced") synced += 1;
      else if (result.status === "skipped") skipped += 1;
      else failed += 1;
    }

    return NextResponse.json({ attempted: targets.length, synced, failed, skipped });
  } catch (err) {
    console.error("Books ingest retry failed:", err);
    return NextResponse.json({ error: "Failed to retry books ingest" }, { status: 500 });
  }
}
