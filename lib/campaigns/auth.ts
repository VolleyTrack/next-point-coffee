import { cookies } from "next/headers";
import { getUserById, listUsers } from "./store";
import type { PortalRole, PortalUser } from "./types";

export const PORTAL_COOKIE = "npc_portal_user";

export async function getPortalUser(): Promise<PortalUser | null> {
  const jar = await cookies();
  const id = jar.get(PORTAL_COOKIE)?.value;
  if (!id) return null;
  return getUserById(id);
}

export async function requirePortalRole(roles: PortalRole[]): Promise<PortalUser> {
  const user = await getPortalUser();
  if (!user || !roles.includes(user.role)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function portalUsersForSwitcher() {
  const users = await listUsers();
  return users.sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name));
}
