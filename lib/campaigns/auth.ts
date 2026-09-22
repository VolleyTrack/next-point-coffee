import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { portalHome } from "./portal-paths";
import { PORTAL_SESSION_COOKIE, portalSessionSecret, readPortalSessionUserId } from "./session-token";
import { getUserById } from "./store";
import type { PortalRole, PublicPortalUser } from "./types";

export async function getPortalUser(): Promise<PublicPortalUser | null> {
  const jar = await cookies();
  const userId = await readPortalSessionUserId(
    jar.get(PORTAL_SESSION_COOKIE)?.value,
    portalSessionSecret()
  );
  if (!userId) return null;
  return getUserById(userId);
}

export async function requirePortalPage(roles: PortalRole[]): Promise<PublicPortalUser> {
  const user = await getPortalUser();
  if (!user) redirect("/campaigns/login");
  if (!roles.includes(user.role)) redirect(portalHome(user.role));
  return user;
}
