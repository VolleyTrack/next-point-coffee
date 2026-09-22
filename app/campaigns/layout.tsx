import { PortalNav } from "@/components/campaigns/portal-nav";
import { CampaignsComingSoon } from "@/components/campaigns/campaigns-coming-soon";
import { CampaignsPreviewBanner } from "@/components/campaigns/preview-banner";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { canAccessCampaigns } from "@/lib/campaigns/preview-access";
import { campaignsLive } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const allowed = await canAccessCampaigns();

  if (!allowed) {
    return <CampaignsComingSoon />;
  }

  const [user, users] = await Promise.all([getPortalUser(), portalUsersForSwitcher()]);
  return (
    <div>
      {!campaignsLive && <CampaignsPreviewBanner />}
      <PortalNav user={user} users={users} />
      {children}
    </div>
  );
}
