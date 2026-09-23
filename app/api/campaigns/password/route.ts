import { NextResponse } from "next/server";
import { getPortalUser } from "@/lib/campaigns/auth";
import { portalHome } from "@/lib/campaigns/portal-paths";
import { canAccessCampaigns, campaignsUnavailableResponse } from "@/lib/campaigns/preview-access";
import { changePortalPassword } from "@/lib/campaigns/store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!(await canAccessCampaigns())) {
    return campaignsUnavailableResponse();
  }

  const user = await getPortalUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const confirm = typeof body.confirm === "string" ? body.confirm : "";

  try {
    const updated = await changePortalPassword(user.id, password, confirm);
    return NextResponse.json({ user: updated, redirectTo: portalHome(updated.role) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not update password.";
    const status = message === "Account not found." ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
