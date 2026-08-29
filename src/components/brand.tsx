import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export function BrandRule({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("h-1 w-28 bg-[linear-gradient(90deg,var(--jl-red)_0_33%,var(--jl-yellow)_33%_66%,var(--jl-green)_66%)]", className)} />;
}

export function SectionEyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-gold", className)}>
      <span aria-hidden="true" className="h-[3px] w-7 bg-brand-red" />
      {children}
    </p>
  );
}

export function PageHeader({ eyebrow, title, description, children }: { eyebrow: ReactNode; title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div>
        <SectionEyebrow>{eyebrow}</SectionEyebrow>
        <h1 className="mt-2 text-3xl font-black uppercase leading-none tracking-[-0.035em] text-foreground md:text-4xl">{title}</h1>
        <BrandRule className="mt-4" />
        {description && <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="shrink-0">{children}</div>}
    </header>
  );
}

const statusStyles = {
  not_started: "border-border bg-muted text-muted-foreground",
  in_progress: "border-gold/50 bg-gold/15 text-gold-foreground",
  completed: "border-success/35 bg-success/10 text-success",
  error: "border-destructive/35 bg-destructive/10 text-destructive",
} as const;

export function StatusBadge({ status, className }: { status: keyof typeof statusStyles | "needs_attention"; className?: string }) {
  const normalized = status === "needs_attention" ? "error" : status;
  return <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-xs font-bold capitalize", statusStyles[normalized], className)}>{status.replaceAll("_", " ")}</span>;
}

export function ProgramBadge({ program, className }: { program: string; className?: string }) {
  return <span className={cn("inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-primary", className)}>{program.replaceAll("_", " ")}</span>;
}

export function MetricCard({ label, value, detail, accent = "primary", icon }: { label: string; value: ReactNode; detail?: ReactNode; accent?: "primary" | "gold" | "red" | "neutral"; icon?: ReactNode }) {
  const accentClass = { primary: "border-l-primary", gold: "border-l-gold", red: "border-l-destructive", neutral: "border-l-border" }[accent];
  return <Card className={cn("border-l-4 p-5 shadow-[var(--shadow-card)]", accentClass)}>
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      {icon && <span className="text-primary">{icon}</span>}
    </div>
    <p className="mt-3 text-3xl font-black leading-none tracking-[-0.035em] text-foreground">{value}</p>
    {detail && <p className="mt-2 text-xs text-muted-foreground">{detail}</p>}
  </Card>;
}
