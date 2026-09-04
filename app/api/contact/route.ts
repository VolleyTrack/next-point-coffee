import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { name, email, message } = body ?? {};
  if (!name || !email || !message) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }
  // In production this would email site.contactEmail via a mail provider.
  console.log("Contact form submission:", { name, email, message });
  return NextResponse.json({ success: true });
}
