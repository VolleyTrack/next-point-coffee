import { PortalNav } from "@/components/campaigns/portal-nav";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";

export const dynamic = "force-dynamic";

export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const [user, users] = await Promise.all([getPortalUser(), portalUsersForSwitcher()]);
  return (
    <div>
      <PortalNav user={user} users={users} />
      {children}
    </div>
  );
}
