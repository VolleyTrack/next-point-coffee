import Link from "next/link";
import { requirePortalPage } from "@/lib/campaigns/auth";
import { portalHome } from "@/lib/campaigns/portal-paths";

export const dynamic = "force-dynamic";

const copy = {
  admin: {
    title: "Next Point Coffee Admin",
    body: "Create campaigns, publish share links, and run biweekly payouts.",
  },
  club: {
    title: "Club dashboard",
    body: "Every athlete campaign under your organization, plus sales and amounts owed.",
  },
  athlete: {
    title: "Athlete dashboard",
    body: "Your assigned campaigns, progress, and share link. Sales stay with the club.",
  },
} as const;

export default async function PortalPage() {
  const user = await requirePortalPage(["admin", "club", "athlete"]);
  const home = portalHome(user.role);
  const card = copy[user.role];

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Partner portal</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Welcome, {user.name}</h1>
      <p className="mt-4 text-muted-foreground">Signed in as {user.email}.</p>

      <Link href={home} className="mt-8 block rounded-lg border border-gold/20 bg-card p-6 hover:border-gold/50">
        <h2 className="text-xl font-black text-np-cream">{card.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{card.body}</p>
      </Link>

      {user.role === "admin" && (
        <p className="mt-6 text-sm text-muted-foreground">
          Accounting:{" "}
          <a href="/admin/books" className="text-gold hover:underline">
            Next Point Coffee Books
          </a>
        </p>
      )}
    </div>
  );
}
