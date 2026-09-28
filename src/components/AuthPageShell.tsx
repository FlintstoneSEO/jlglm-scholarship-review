import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { BrandRule, SectionEyebrow } from "@/components/brand";
import logo from "@/assets/jlgl-logo.png";

export function AuthPageShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen grid md:grid-cols-2 bg-background">
      <section className="hidden md:flex bg-sidebar text-sidebar-foreground p-12 flex-col justify-between border-r border-border">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-white p-2 shadow-md">
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
        <div className="space-y-4">
          <SectionEyebrow className="text-gold">Committee workspace</SectionEyebrow>
          <h1 className="font-display text-4xl font-black uppercase leading-[.95] text-white">
            Justice League Review Portal
          </h1>
          <BrandRule />
          <p className="text-white/80 max-w-md">Secure access for invited committee members.</p>
        </div>
        <p className="text-xs text-white">
          © Justice League of Greater Lansing · Repairing the Breach
        </p>
      </section>
      <section className="flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md p-8 shadow-[var(--shadow-elevated)] border-border/60">
          <div className="md:hidden flex items-center gap-2 mb-6">
            <img src={logo} alt="Justice League of Greater Lansing" className="h-10 w-auto" />
            <span className="font-display text-sm font-black uppercase text-primary">
              Review Portal
            </span>
          </div>
          <h2 className="font-display text-2xl">{title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
          {children}
          <p className="mt-6 text-center text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Return to sign in
            </Link>
          </p>
        </Card>
      </section>
    </main>
  );
}
