import { PortalNav } from "@/components/campaigns/portal-nav";
import { CampaignsPreviewBanner } from "@/components/campaigns/preview-banner";
import { getPortalUser } from "@/lib/campaigns/auth";
import { campaignsLive } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Only reached when campaigns are live or Ryan's preview cookie is valid
 * (see middleware.ts). Public visitors are rewritten to /campaigns-coming-soon.
 * Partner pages redirect to /campaigns/login when there is no session.
 */
export default async function CampaignsLayout({ children }: { children: React.ReactNode }) {
  const user = await getPortalUser();
  return (
    <div>
      {!campaignsLive && <CampaignsPreviewBanner />}
      <PortalNav user={user} />
      {children}
    </div>
  );
}
