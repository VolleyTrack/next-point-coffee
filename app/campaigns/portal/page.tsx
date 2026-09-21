import Link from "next/link";
import { getPortalUser, portalUsersForSwitcher } from "@/lib/campaigns/auth";
import { RoleSwitcher } from "@/components/campaigns/role-switcher";

export const dynamic = "force-dynamic";

const cards = [
  {
    role: "admin",
    href: "/campaigns/admin",
    title: "Next Point Coffee Admin",
    body: "Create org + athlete + campaign in one flow, publish share links + QR, track every sale, and run biweekly payouts.",
  },
  {
    role: "club",
    href: "/campaigns/club",
    title: "Club dashboard",
    body: "See every athlete campaign under your organization, sales, and amounts owed vs paid.",
  },
  {
    role: "athlete",
    href: "/campaigns/athlete",
    title: "Athlete dashboard",
    body: "See only your assigned campaigns, progress toward goal, and your share link + QR. No sales ledger.",
  },
] as const;

export default async function PortalPage() {
  const [user, users] = await Promise.all([getPortalUser(), portalUsersForSwitcher()]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Prototype portal</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Campaigns workspace</h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">
        This repo does not have end-user auth yet (admin pages use an access key). The campaigns portal uses a labeled
        demo role switcher so you can click through admin, club, and athlete views.
      </p>

      <div className="mt-8 rounded-lg border border-gold/30 bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Signed in as{" "}
          <span className="font-semibold text-np-cream">{user ? `${user.name} (${user.role})` : "nobody yet"}</span>
        </p>
        <div className="mt-4">
          <RoleSwitcher users={users} currentUserId={user?.id} />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.role}
            href={card.href}
            className="rounded-lg border border-gold/20 bg-card p-6 hover:border-gold/50"
          >
            <p className="text-xs uppercase tracking-widest-plus text-gold">{card.role}</p>
            <h2 className="mt-2 text-xl font-black text-np-cream">{card.title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
