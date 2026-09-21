import { NextResponse } from "next/server";
import { canReadBooksLedger, unauthorizedBooks } from "@/lib/campaigns/books-auth";
import { exportBooksLedger } from "@/lib/campaigns/books";
import { getStore } from "@/lib/campaigns/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await canReadBooksLedger(request))) return unauthorizedBooks();
  const store = await getStore();
  return NextResponse.json(exportBooksLedger(store));
}
