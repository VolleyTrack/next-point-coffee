import { portalLogoutResponse } from "@/lib/campaigns/logout";

export const dynamic = "force-dynamic";

/** Document POST so the browser applies Set-Cookie before following the redirect. */
export async function POST(request: Request) {
  return portalLogoutResponse(request);
}
