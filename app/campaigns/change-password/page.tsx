import { getPortalUser } from "@/lib/campaigns/auth";
import { ChangePasswordForm } from "@/components/campaigns/change-password-form";
import { portalHome } from "@/lib/campaigns/portal-paths";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const user = await getPortalUser();
  if (!user) redirect("/campaigns/login");
  if (!user.mustChangePassword) redirect(portalHome(user.role));

  const who = user.role === "club" ? "club" : user.role === "athlete" ? "athlete" : "Next Point Coffee";

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <p className="text-xs font-semibold uppercase tracking-widest-plus text-gold">Next Point Coffee Co.</p>
      <h1 className="mt-2 text-4xl font-black text-np-cream">Choose your password</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        This {who} login ({user.email}) is still using a temporary password. Set your own before the portal opens.
        You will use this password the next time you sign in.
      </p>
      <ChangePasswordForm />
    </div>
  );
}
