import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { readAccountSetupCompleted } from "@/lib/account-setup";
import { accountSetupDestination } from "@/lib/auth-lifecycle";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login", search: { next: location.href } });
    const setup = await readAccountSetupCompleted(data.session.user.id);
    if (accountSetupDestination(true, setup) === "/accept-invite")
      throw redirect({ to: "/accept-invite" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, user, accountSetupCompleted } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>
    );
  if (!user || accountSetupCompleted !== true) return null;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
