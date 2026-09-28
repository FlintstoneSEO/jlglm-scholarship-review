import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/jlgl-logo.png";
import { BrandRule, SectionEyebrow } from "@/components/brand";

function safeNext(next: unknown): string | null {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>): { next?: string } => ({
    next: safeNext(s.next) ?? undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const next = safeNext(search.next);
      throw next ? redirect({ href: next }) : redirect({ to: "/" });
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

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) return;
      const target = safeNext(next);
      if (target) window.location.href = target;
      else nav({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav, next]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${safeNext(next) ?? "/"}`,
      },
    });

    if (error) toast.error(error.message || "Google sign-in failed");
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
          <h1 className="font-display text-4xl font-black uppercase leading-[.95] text-white">
            Justice League Review Portal
          </h1>
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
          <h2 className="font-display text-2xl">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1">Committee members only.</p>

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
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Portal access is invitation-only and is provided by a Justice League administrator.
          </p>
        </Card>
      </div>
    </div>
  );
}
