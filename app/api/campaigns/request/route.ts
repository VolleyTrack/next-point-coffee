import { NextResponse } from "next/server";
import { assessPublicFormSubmission, rejectBotSubmission } from "@/lib/bot-check";
import { notifyCampaignRequest } from "@/lib/mailer";
import { createCampaignRequest } from "@/lib/campaigns/store";
import type { CampaignRequest, OrganizationType } from "@/lib/campaigns/types";
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

  if (rejectBotSubmission("campaign-request", assessPublicFormSubmission(body, { emails: [contactEmail] }))) {
    return NextResponse.json({
      ok: true,
      request: unsavedCampaignRequest({
        organizationName,
        organizationType,
        contactName,
        contactEmail,
        phone,
        city,
        athleteName,
        notes,
      }),
    });
  }

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

/** Same JSON shape as a stored request, without writing the lead or sending mail. */
function unsavedCampaignRequest(input: {
  organizationName: string;
  organizationType: OrganizationType;
  contactName: string;
  contactEmail: string;
  phone: string;
  city: string;
  athleteName: string;
  notes: string;
}): CampaignRequest {
  return {
    id: crypto.randomUUID(),
    organizationName: input.organizationName,
    organizationType: input.organizationType,
    contactName: input.contactName,
    contactEmail: input.contactEmail,
    phone: input.phone,
    city: input.city,
    athleteName: input.athleteName,
    notes: input.notes,
    status: "new",
    createdAt: new Date().toISOString(),
    handledAt: null,
  };
}
