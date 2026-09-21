import Link from "next/link";
import { RoleSwitcher } from "./role-switcher";
import type { PortalUser } from "@/lib/campaigns/types";
import { cn } from "@/lib/utils";

export function PortalNav({
  user,
  users,
}: {
  user: PortalUser | null;
  users: PortalUser[];
}) {
  const links = [
    { href: "/campaigns", label: "Live campaigns" },
    { href: "/campaigns/portal", label: "Portal" },
    ...(user?.role === "admin" ? [{ href: "/campaigns/admin", label: "Admin" }] : []),
    ...(user?.role === "club" ? [{ href: "/campaigns/club", label: "Club" }] : []),
    ...(user?.role === "athlete" ? [{ href: "/campaigns/athlete", label: "Athlete" }] : []),
  ];

  return (
    <div className="border-b border-gold/20 bg-card">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-widest-plus text-gold">
            Campaigns portal
          </span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn("text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-gold")}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <RoleSwitcher users={users} currentUserId={user?.id} />
      </div>
    </div>
  );
}
