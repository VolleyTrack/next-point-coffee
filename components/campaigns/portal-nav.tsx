import Link from "next/link";
import { PortalLogoutButton } from "./portal-logout";
import type { PublicPortalUser } from "@/lib/campaigns/types";
import { cn } from "@/lib/utils";

function roleLabel(role: PublicPortalUser["role"]): string {
  if (role === "admin") return "Next Point Coffee";
  if (role === "club") return "Club";
  return "Athlete";
}

export function PortalNav({ user }: { user: PublicPortalUser | null }) {
  const links = [
    { href: "/campaigns", label: "Start a campaign" },
    user
      ? { href: "/campaigns/portal", label: "Portal" }
      : { href: "/campaigns/login", label: "Partner login" },
    ...(user?.role === "admin" ? [{ href: "/campaigns/admin", label: "Admin" }] : []),
    ...(user?.role === "club" ? [{ href: "/campaigns/club", label: "Club" }] : []),
    ...(user?.role === "athlete" ? [{ href: "/campaigns/athlete", label: "Athlete" }] : []),
  ];
  const linkClass = "text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-gold";

  return (
    <div className="border-b border-gold/20 bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Campaigns</span>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={cn(linkClass)}>
              {link.label}
            </Link>
          ))}
          {user?.role === "admin" && (
            <a href="/admin/books" className={linkClass}>
              Books
            </a>
          )}
        </div>
        {user ? (
          <div className="flex items-center gap-4">
            <p className="text-sm text-muted-foreground">
              <span className="text-np-cream">{user.name}</span>
              <span className="mx-2 text-gold/50">·</span>
              {roleLabel(user.role)}
            </p>
            <PortalLogoutButton />
          </div>
        ) : null}
      </div>
    </div>
  );
}
