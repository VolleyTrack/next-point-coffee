import Link from "next/link";
import { getPortalUser } from "@/lib/campaigns/auth";
import { LoginForm } from "@/components/campaigns/login-form";
import { portalHome, sanitizePortalNext } from "@/lib/campaigns/portal-paths";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const user = await getPortalUser();
  const next = sanitizePortalNext(params.next, user?.role);
  if (user) redirect(next ?? portalHome(user.role));

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Next Point Coffee Co.</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Partner sign in</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Clubs and athletes use the email and password Next Point Coffee shared when the campaign was created.
      </p>
      <LoginForm nextPath={sanitizePortalNext(params.next) ?? undefined} />
      <p className="mt-6 text-sm text-muted-foreground">
        Need a campaign?{" "}
        <Link href="/campaigns" className="text-gold hover:underline">
          Send a request
        </Link>
        . Supporters buying from a share link do not need to sign in.
      </p>
    </div>
  );
}
