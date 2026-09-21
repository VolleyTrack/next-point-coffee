import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/campaigns/auth";
import {
  closeCampaign,
  computeCurrentPayouts,
  createAthlete,
  createCampaign,
  createOrganization,
  markPayoutPaid,
  publishCampaign,
  resetStore,
} from "@/lib/campaigns/store";
import type { OrganizationType } from "@/lib/campaigns/types";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getPortalUser();
  if (!user || user.role !== "admin") {
    return null;
  }
  return user;
}

export async function POST(request: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "NPC admin role required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string;

  try {
    switch (action) {
      case "createOrganization": {
        const name = String(body.name ?? "").trim();
        const type = body.type === "nonprofit" ? "nonprofit" : "club";
        const contactEmail = String(body.contactEmail ?? "").trim();
        if (!name || !contactEmail.includes("@")) {
          return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
        }
        const organization = await createOrganization({
          name,
          type: type as OrganizationType,
          contactEmail,
        });
        return NextResponse.json({ organization });
      }
      case "createAthlete": {
        const organizationId = String(body.organizationId ?? "");
        const name = String(body.name ?? "").trim();
        const email = String(body.email ?? "").trim();
        if (!organizationId || !name || !email.includes("@")) {
          return NextResponse.json({ error: "Organization, name, and email are required." }, { status: 400 });
        }
        const athlete = await createAthlete({ organizationId, name, email });
        return NextResponse.json({ athlete });
      }
      case "createCampaign": {
        const organizationId = String(body.organizationId ?? "");
        const athleteId = String(body.athleteId ?? "");
        const name = String(body.name ?? "").trim();
        const story = String(body.story ?? "").trim();
        const goalBags = Number(body.goalBags);
        if (!organizationId || !athleteId || !name || !story) {
          return NextResponse.json({ error: "Organization, athlete, name, and story are required." }, { status: 400 });
        }
        const campaign = await createCampaign({ organizationId, athleteId, name, story, goalBags });
        return NextResponse.json({ campaign });
      }
      case "publishCampaign": {
        const campaignId = String(body.campaignId ?? "");
        if (!campaignId) return NextResponse.json({ error: "campaignId required." }, { status: 400 });
        const campaign = await publishCampaign(campaignId);
        return NextResponse.json({ campaign });
      }
      case "closeCampaign": {
        const campaignId = String(body.campaignId ?? "");
        if (!campaignId) return NextResponse.json({ error: "campaignId required." }, { status: 400 });
        const campaign = await closeCampaign(campaignId);
        return NextResponse.json({ campaign });
      }
      case "computePayouts": {
        const payouts = await computeCurrentPayouts();
        return NextResponse.json({ payouts });
      }
      case "markPayoutPaid": {
        const payoutId = String(body.payoutId ?? "");
        if (!payoutId) return NextResponse.json({ error: "payoutId required." }, { status: 400 });
        const payout = await markPayoutPaid(payoutId);
        return NextResponse.json({ payout });
      }
      case "resetDemo": {
        const store = await resetStore();
        return NextResponse.json({ ok: true, store });
      }
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
  } catch (err) {
    console.error("Campaign admin action failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed." },
      { status: 400 }
    );
  }
}
