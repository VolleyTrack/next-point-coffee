import { CampaignsComingSoon } from "@/components/campaigns/campaigns-coming-soon";

export const dynamic = "force-dynamic";

/** Standalone coming-soon surface. Middleware rewrites locked /campaigns* here. */
export default function CampaignsComingSoonPage() {
  return <CampaignsComingSoon />;
}
