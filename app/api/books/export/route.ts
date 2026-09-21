import { NextResponse } from "next/server";
import { exportBooksLedger } from "@/lib/campaigns/books";
import { getStore } from "@/lib/campaigns/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await getStore();
  return NextResponse.json(exportBooksLedger(store));
}
