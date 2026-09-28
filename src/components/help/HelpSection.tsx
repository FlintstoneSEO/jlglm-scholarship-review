import type { ComponentType, ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function HelpSection({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 rounded-xl border-border/60 p-4 sm:p-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </div>
        <h2 className="min-w-0 break-words font-display text-xl">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 break-words text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </Card>
  );
}
