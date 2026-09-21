import Link from "next/link";
import { getPortalUser } from "@/lib/campaigns/auth";
import { CampaignRequestForm } from "@/components/campaigns/request-form";

export const dynamic = "force-dynamic";

export default async function CampaignsIndexPage() {
  const user = await getPortalUser();
  const isAdmin = user?.role === "admin";

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Start a campaign</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream sm:text-5xl">Ask NPC to set you up.</h1>
      <p className="mt-4 text-muted-foreground">
        Campaigns are not an open catalog. Live share links and QR codes still work for buyers — NPC publishes those
        after setup. Send your club or nonprofit details and we will notify the admin.
      </p>
      {isAdmin && (
        <p className="mt-4 rounded-md border border-gold/30 bg-card px-4 py-3 text-sm text-np-cream">
          You are signed in as NPC Admin. Incoming requests and create live on the{" "}
          <Link href="/campaigns/admin" className="text-gold hover:underline">
            admin dashboard
          </Link>
          — this page stays a request form for everyone else.
        </p>
      )}
      <div className="mt-8">
        <CampaignRequestForm />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Already a partner? Open the{" "}
        <Link href="/campaigns/portal" className="text-gold hover:underline">
          partner portal
        </Link>
        .
      </p>
    </div>
  );
}
