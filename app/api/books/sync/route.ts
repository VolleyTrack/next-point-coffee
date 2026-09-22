import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/campaigns/auth";
import { runBooksSync } from "@/lib/campaigns/store";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const user = await getPortalUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Next Point Coffee admin role required." }, { status: 401 });
  }
  const events = await runBooksSync();
  return NextResponse.json({
    mode: process.env.BOOKS_WEBHOOK_URL ? "webhook" : "stub",
    events,
  });
}
