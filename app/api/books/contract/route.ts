import { NextResponse } from "next/server";
import { BOOKS_ORDER_CONTRACT, BOOKS_ORDER_CONTRACT_VERSION } from "@/lib/books/order-ingest";
import { BOOKS_CONTRACT_NOTES, BOOKS_CONTRACT_VERSION, BOOKS_SOURCE } from "@/lib/campaigns/books-contract";

export const dynamic = "force-dynamic";

/** Machine-readable handshake for nextpoint-books. */
export async function GET() {
  return NextResponse.json({
    ...BOOKS_CONTRACT_NOTES,
    source: BOOKS_SOURCE,
    contractVersion: BOOKS_CONTRACT_VERSION,
    events: ["sale.recorded", "payout.computed", "payout.paid"],
    endpoints: {
      export: "/api/books/export",
      sync: "/api/books/sync",
      contract: "/api/books/contract",
    },
    upsertKeys: {
      organizations: "id",
      athletes: "id",
      campaigns: "id",
      sales: "saleId",
      payouts: "payoutId",
      events: "id",
      paidOrders: "stripe_session_id",
    },
    paidOrderIngest: {
      contract: BOOKS_ORDER_CONTRACT,
      contractVersion: BOOKS_ORDER_CONTRACT_VERSION,
      method: "POST",
      urlEnv: "BOOKS_INGEST_URL",
      secretEnv: "BOOKS_INGEST_SECRET",
      flagEnv: "BOOKS_ORDER_INGEST",
      idempotency: "Header Idempotency-Key and body.stripe_session_id. HTTP 409 is success.",
      when: "Stripe checkout.session.completed or async_payment_succeeded, after public.orders is saved, only when payment_status is paid.",
      body: [
        "source",
        "contract",
        "contract_version",
        "channel",
        "campaign_id",
        "campaign_name",
        "order_date",
        "gross_amount_cents",
        "currency",
        "stripe_session_id",
        "order_id",
        "campaign_share_owed",
      ],
    },
  });
}
