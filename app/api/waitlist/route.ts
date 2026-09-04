import { NextResponse } from "next/server";

interface WaitlistEntry {
  email: string;
  context: string;
  createdAt: string;
}

const entries: WaitlistEntry[] = [];

export async function POST(request: Request) {
  const body = await request.json();
  if (!body?.email || typeof body.email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }
  entries.push({
    email: body.email,
    context: body.context ?? "general",
    createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ success: true });
}

export async function GET() {
  return NextResponse.json({ count: entries.length, entries });
}
