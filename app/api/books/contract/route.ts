import { NextResponse } from "next/server";
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
    },
  });
}
