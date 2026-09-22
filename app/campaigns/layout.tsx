import { PortalNav } from "@/components/campaigns/portal-nav";
import { CampaignsPreviewBanner } from "@/components/campaigns/preview-banner";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { campaignsLive } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Only reached when campaigns are live or Ryan's preview cookie is valid
 * (see middleware.ts). Public visitors are rewritten to /campaigns-coming-soon.
 */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const [user, users] = await Promise.all([getPortalUser(), portalUsersForSwitcher()]);
  return (
    <div>
      {!campaignsLive && <CampaignsPreviewBanner />}
      <PortalNav user={user} users={users} />
      {children}
    </div>
  );
}
