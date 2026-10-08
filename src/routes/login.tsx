import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/jlgl-logo.png";
import { BrandRule, SectionEyebrow } from "@/components/brand";
import { accountSetupDestination, isPublicAuthRoute, safeLoginNext } from "@/lib/auth-lifecycle";
import { readAccountSetupCompleted } from "@/lib/account-setup";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: safeLoginNext(s.next) ?? undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const setup = await readAccountSetupCompleted(data.session.user.id);
      if (accountSetupDestination(true, setup) === "/accept-invite")
        throw redirect({ to: "/accept-invite" });
      const next = safeLoginNext(search.next);
      throw next && !isPublicAuthRoute(new URL(next, "https://portal.invalid").pathname)
        ? redirect({ href: next })
        : redirect({ to: "/" });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const setup = await readAccountSetupCompleted(data.user.id);
      if (accountSetupDestination(true, setup) === "/accept-invite") {
        await nav({ to: "/accept-invite" });
      } else {
        const target = safeLoginNext(next);
        if (target && !isPublicAuthRoute(new URL(target, "https://portal.invalid").pathname))
          await nav({ href: target, replace: true });
        else await nav({ to: "/" });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex relative bg-sidebar text-sidebar-foreground p-12 flex-col justify-between overflow-hidden border-r border-border">
        <div className="absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
        <div className="absolute -top-32 -left-20 h-72 w-72 rounded-full bg-brand-red/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="rounded-lg bg-white p-2 shadow-md border border-border">
            <img src={logo} alt="Justice League of Greater Lansing" className="h-14 w-auto" />
          </div>
          <div>
            <div className="font-display text-xl font-black uppercase text-white">
              Justice League
            </div>
            <div className="text-xs uppercase tracking-widest text-white/70 font-semibold">
              of Greater Lansing, MI
            </div>
          </div>
        </div>
        <div className="relative space-y-4">
          <SectionEyebrow className="text-gold">Committee workspace</SectionEyebrow>
          <p className="font-display text-4xl font-black uppercase leading-[.95] text-white">
            Justice League Review Portal
          </p>
          <BrandRule />
          <p className="text-white/80 max-w-md">
            A trusted workspace for the JLGL committee to review scholarship and Business Growth
            Grant applications with care and integrity.
          </p>
        </div>
        <p className="relative text-xs text-white">
          © Justice League of Greater Lansing · Repairing the Breach
        </p>
      </div>

      <div className="flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)] border-border/60">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <img src={logo} alt="JLGL" className="h-10 w-auto" />
            <span className="font-display text-sm font-black uppercase text-primary">
              Review Portal
            </span>
          </div>
          <h1 className="font-display text-2xl">Sign In</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Access to this portal is by invitation only. Contact a Justice League administrator if
            you need access.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="em">Email</Label>
              <Input
                id="em"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="pw">Password</Label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
