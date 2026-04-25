import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return null;
  return <AppShell><Outlet /></AppShell>;
}
