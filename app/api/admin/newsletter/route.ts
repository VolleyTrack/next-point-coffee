import { NextResponse } from "next/server";
import { listSignups } from "@/lib/newsletter";

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
    const rows = await listSignups();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "csv") {
      const header = "email,context,created_at\n";
      const csv =
        header +
        rows
          .map((r) => `${r.email},${r.context},${r.created_at}`)
          .join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": "attachment; filename=newsletter-signups.csv",
        },
      });
    }

    return NextResponse.json({ count: rows.length, rows });
  } catch (err) {
    console.error("Admin newsletter fetch failed:", err);
    return NextResponse.json({ error: "Failed to load signups" }, { status: 500 });
  }
}
