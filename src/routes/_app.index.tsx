import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, CheckCircle2, AlertCircle, FileWarning, Star, Award, Gauge, Trophy, ArrowRight } from "lucide-react";
import { fullName, missingItems, statusLabel } from "@/lib/applicant-utils";
import type { Applicant } from "@/lib/applicant-utils";

export const Route = createFileRoute("/_app/")({
  component: Dashboard,
});

function Dashboard() {
  const applicantsQ = useQuery({
    queryKey: ["applicants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("applicants").select("*").order("submission_date", { ascending: false });
      if (error) throw error;
      return data as Applicant[];
    },
  });

  const reviewsQ = useQuery({
    queryKey: ["reviews-count"],
    queryFn: async () => {
      const { count } = await supabase.from("reviews").select("*", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  const apps = applicantsQ.data ?? [];
  const total = apps.length;
  const complete = apps.filter((a) => missingItems(a).length === 0).length;
  const needsReview = apps.filter((a) => a.review_status === "not_started" || a.review_status === "in_progress").length;
  const missing = apps.filter((a) => missingItems(a).length > 0).length;
  const finalists = apps.filter((a) => a.is_finalist).length;
  const selected = apps.filter((a) => a.is_selected).length;
  const scored = apps.filter((a) => Number(a.total_score) > 0);
  const avgScore = scored.length ? scored.reduce((s, a) => s + Number(a.total_score), 0) / scored.length : 0;
  const ranked = [...apps].sort((a, b) => Number(b.total_score) - Number(a.total_score));
  const top10 = ranked.slice(0, 10);
  const reviewedPct = total ? Math.round(((total - needsReview) / total) * 100) : 0;
  const incomplete = apps.filter((a) => missingItems(a).length > 0).slice(0, 6);
  const recent = [...apps].slice(0, 6);

  const kpis = [
    { label: "Total Applicants", value: total, icon: Users, tone: "primary" },
    { label: "Complete Applications", value: complete, icon: CheckCircle2, tone: "success" },
    { label: "Needs Review", value: needsReview, icon: AlertCircle, tone: "warning" },
    { label: "Missing Documents", value: missing, icon: FileWarning, tone: "destructive" },
    { label: "Finalists", value: finalists, icon: Star, tone: "gold" },
    { label: "Selected Recipients", value: selected, icon: Award, tone: "primary" },
    { label: "Average Score", value: avgScore.toFixed(1), icon: Gauge, tone: "success" },
    { label: "Current Top 10", value: Math.min(10, ranked.filter((a) => Number(a.total_score) > 0).length), icon: Trophy, tone: "gold" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">2026 Reparations Scholarship</p>
          <h1 className="font-display text-3xl md:text-4xl mt-1">Committee Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">A snapshot of where every applicant stands today.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/applicants" className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90">
            View applicants <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5 shadow-[var(--shadow-card)] border-border/60 rounded-xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{k.label}</div>
                <div className="font-display text-3xl mt-2">{k.value}</div>
              </div>
              <div className={`h-9 w-9 rounded-lg grid place-items-center ${
                k.tone === "gold" ? "bg-gold/15 text-gold"
                : k.tone === "success" ? "bg-success/15 text-success"
                : k.tone === "warning" ? "bg-warning/20 text-warning"
                : k.tone === "destructive" ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
              }`}>
                <k.icon className="h-4 w-4" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-1 rounded-xl border-border/60">
          <h3 className="font-display text-lg">Review Progress</h3>
          <p className="text-xs text-muted-foreground">Across all submissions</p>
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1.5"><span>Reviewed</span><span className="font-semibold">{reviewedPct}%</span></div>
              <Progress value={reviewedPct} className="h-2" />
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Total reviews</div>
                <div className="font-display text-2xl">{reviewsQ.data ?? 0}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="font-display text-2xl">{needsReview}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2 rounded-xl border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg">Top Applicants by Score</h3>
              <p className="text-xs text-muted-foreground">Rankings update as scores are entered</p>
            </div>
            <Link to="/top" className="text-xs text-primary font-medium hover:underline">View all →</Link>
          </div>
          <div className="mt-4 divide-y divide-border">
            {top10.length === 0 && <p className="text-sm text-muted-foreground py-6 text-center">No scores yet. Begin reviewing applicants to see rankings.</p>}
            {top10.map((a, i) => (
              <Link key={a.id} to="/applicants/$id" params={{ id: a.id }} className="flex items-center gap-4 py-3 hover:bg-muted/40 -mx-2 px-2 rounded">
                <div className={`h-8 w-8 rounded-full grid place-items-center text-xs font-bold ${i < 3 ? "bg-[var(--gradient-gold)] text-gold-foreground" : "bg-secondary text-secondary-foreground"}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{fullName(a)}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.college_attending || "—"}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg">{Number(a.total_score).toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">/ 100</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card className="p-6 rounded-xl border-border/60">
          <h3 className="font-display text-lg">Incomplete Applications</h3>
          <p className="text-xs text-muted-foreground">Awaiting required materials</p>
          <div className="mt-4 space-y-3">
            {incomplete.length === 0 && <p className="text-sm text-muted-foreground py-4">All applications are complete. 🎉</p>}
            {incomplete.map((a) => (
              <Link key={a.id} to="/applicants/$id" params={{ id: a.id }} className="block rounded-lg border border-border p-3 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium truncate">{fullName(a)}</div>
                  <Badge variant="outline" className="text-warning border-warning/40 bg-warning/10">{statusLabel(a.application_status)}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1">Missing: {missingItems(a).join(", ")}</div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6 rounded-xl border-border/60">
          <h3 className="font-display text-lg">Recently Submitted</h3>
          <p className="text-xs text-muted-foreground">Newest applications first</p>
          <div className="mt-4 space-y-3">
            {recent.length === 0 && <p className="text-sm text-muted-foreground py-4">No applications yet. Use Import Data to get started.</p>}
            {recent.map((a) => (
              <Link key={a.id} to="/applicants/$id" params={{ id: a.id }} className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted/40">
                <div className="min-w-0">
                  <div className="font-medium truncate">{fullName(a)}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.email || "—"}</div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {a.submission_date ? new Date(a.submission_date).toLocaleDateString() : "—"}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
