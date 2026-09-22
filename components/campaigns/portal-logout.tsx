/**
 * Native form POST, not a client router transition. The logout route
 * clears npc_portal_session and answers 303 to /campaigns/login.
 */
export function PortalLogoutButton() {
  return (
    <form action="/api/campaigns/logout" method="POST" className="inline-flex">
      <button
        type="submit"
        className="text-sm font-semibold uppercase tracking-wide text-muted-foreground hover:text-gold"
      >
        Log out
      </button>
    </form>
  );
}
