import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/campaigns/auth";
import { emailPartnerTemporaryPasswords } from "@/lib/mailer";
import {
  closeCampaign,
  computeCurrentPayouts,
  createAthlete,
  createCampaign,
  createOrganization,
  createSetup,
  markCampaignRequestHandled,
  markPayoutPaid,
  toPublicPortalUser,
  updateOrganization,
  publishCampaign,
  resetStore,
} from "@/lib/campaigns/store";
import type { IssuedPortalCredential, OrganizationType } from "@/lib/campaigns/types";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<"ok" | "signin" | "password"> {
  const user = await getPortalUser();
  if (!user || user.role !== "admin") return "signin";
  if (user.mustChangePassword) return "password";
  return "ok";
}

async function withLoginEmails<T>(
  payload: T,
  credentials: IssuedPortalCredential[],
  context?: { organizationName?: string; campaignName?: string }
): Promise<T & { emailWarning: string | null }> {
  try {
    const emailWarning = await emailPartnerTemporaryPasswords(credentials, context);
    return { ...payload, emailWarning };
  } catch (err) {
    console.error("Partner login email failed:", err instanceof Error ? err.message : err);
    return {
      ...payload,
      emailWarning:
        "Logins were created, but the temporary-password email failed. Copy the passwords below and send them yourself.",
    };
  }
}

export async function POST(request: Request) {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const adminGate = await requireAdmin();
  if (adminGate === "password") {
    return NextResponse.json({ error: "Set a new password before using the portal." }, { status: 403 });
  }
  if (adminGate !== "ok") {
    return NextResponse.json({ error: "Next Point Coffee admin role required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action as string;

  try {
    switch (action) {
      case "createOrganization": {
        const name = String(body.name ?? "").trim();
        const type = body.type === "nonprofit" ? "nonprofit" : "club";
        const contactEmail = String(body.contactEmail ?? "").trim();
        const bagShareCents = Math.round(Number(body.bagShareDollars) * 100);
        if (!name || !contactEmail.includes("@")) {
          return NextResponse.json({ error: "Name and a valid email are required." }, { status: 400 });
        }
        if (!Number.isFinite(bagShareCents) || bagShareCents < 0) {
          return NextResponse.json({ error: "Bag share ($ per bag) is required." }, { status: 400 });
        }
        const { organization, credential } = await createOrganization({
          name,
          type: type as OrganizationType,
          contactEmail,
          bagShareCents,
        });
        return NextResponse.json(
          await withLoginEmails({ organization, credential }, [credential], {
            organizationName: organization.name,
          })
        );
      }
      case "updateOrganization": {
        const organizationId = String(body.organizationId ?? "");
        const bagShareCents = Math.round(Number(body.bagShareDollars) * 100);
        if (!organizationId) {
          return NextResponse.json({ error: "organizationId required." }, { status: 400 });
        }
        if (!Number.isFinite(bagShareCents) || bagShareCents < 0) {
          return NextResponse.json({ error: "Bag share ($ per bag) is required." }, { status: 400 });
        }
        const organization = await updateOrganization({ organizationId, bagShareCents });
        return NextResponse.json({ organization });
      }
      case "createAthlete": {
        const organizationId = String(body.organizationId ?? "");
        const name = String(body.name ?? "").trim();
        const email = String(body.email ?? "").trim();
        if (!organizationId || !name || !email.includes("@")) {
          return NextResponse.json({ error: "Organization, name, and email are required." }, { status: 400 });
        }
        const { athlete, credential } = await createAthlete({ organizationId, name, email });
        return NextResponse.json(await withLoginEmails({ athlete, credential }, [credential]));
      }
      case "createSetup": {
        const organizationName = String(body.organizationName ?? "").trim();
        const type = body.type === "nonprofit" ? "nonprofit" : "club";
        const contactEmail = String(body.contactEmail ?? "").trim();
        const bagShareCents = Math.round(Number(body.bagShareDollars) * 100);
        const athleteName = String(body.athleteName ?? "").trim();
        const athleteEmail = String(body.athleteEmail ?? "").trim();
        const campaignName = String(body.campaignName ?? "").trim();
        const story = String(body.story ?? "").trim();
        const goalBags = Number(body.goalBags);
        const publish = Boolean(body.publish);
        const requestId = String(body.requestId ?? "").trim();
        if (
          !organizationName ||
          !contactEmail.includes("@") ||
          !athleteName ||
          !athleteEmail.includes("@") ||
          !campaignName ||
          !story
        ) {
          return NextResponse.json(
            { error: "Organization, athlete, and campaign details are all required." },
            { status: 400 }
          );
        }
        if (!Number.isFinite(bagShareCents) || bagShareCents < 0) {
          return NextResponse.json({ error: "Bag share ($ per bag) is required." }, { status: 400 });
        }
        const setup = await createSetup({
          organizationName,
          type: type as OrganizationType,
          contactEmail,
          bagShareCents,
          athleteName,
          athleteEmail,
          campaignName,
          story,
          goalBags,
          publish,
        });
        if (requestId) {
          await markCampaignRequestHandled(requestId).catch(() => undefined);
        }
        return NextResponse.json(
          await withLoginEmails(setup, setup.credentials, {
            organizationName: setup.organization.name,
            campaignName: setup.campaign.name,
          })
        );
      }
      case "markRequestHandled": {
        const requestId = String(body.requestId ?? "");
        if (!requestId) return NextResponse.json({ error: "requestId required." }, { status: 400 });
        const campaignRequest = await markCampaignRequestHandled(requestId);
        return NextResponse.json({ request: campaignRequest });
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
        const { campaign, credentials } = await createCampaign({
          organizationId,
          athleteId,
          name,
          story,
          goalBags,
        });
        return NextResponse.json(
          await withLoginEmails({ campaign, credentials }, credentials, { campaignName: campaign.name })
        );
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
        return NextResponse.json({
          ok: true,
          store: {
            ...store,
            users: store.users.map((user) => toPublicPortalUser(user)),
          },
        });
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
