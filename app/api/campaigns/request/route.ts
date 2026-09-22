import { NextResponse } from "next/server";
import { notifyCampaignRequest } from "@/lib/mailer";
import { createCampaignRequest } from "@/lib/campaigns/store";
import type { OrganizationType } from "@/lib/campaigns/types";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const body = await request.json().catch(() => ({}));
  const organizationName = String(body.organizationName ?? "").trim();
  const organizationType: OrganizationType = body.organizationType === "nonprofit" ? "nonprofit" : "club";
  const contactName = String(body.contactName ?? "").trim();
  const contactEmail = String(body.contactEmail ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const city = String(body.city ?? "").trim();
  const athleteName = String(body.athleteName ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  if (!organizationName || !contactName || !contactEmail.includes("@")) {
    return NextResponse.json(
      { error: "Organization name, your name, and a valid email are required." },
      { status: 400 }
    );
  }

  const campaignRequest = await createCampaignRequest({
    organizationName,
    organizationType,
    contactName,
    contactEmail,
    phone,
    city,
    athleteName,
    notes,
  });

  await notifyCampaignRequest({
    organizationName,
    organizationType,
    contactName,
    contactEmail,
    phone,
    city,
    athleteName,
    notes,
  });

  return NextResponse.json({ ok: true, request: campaignRequest });
}
