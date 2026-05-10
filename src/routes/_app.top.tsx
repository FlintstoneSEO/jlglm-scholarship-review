import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Star, Award } from "lucide-react";
import { fullName, missingItems, recommendationLabel } from "@/lib/applicant-utils";
import type { Applicant, Review } from "@/lib/applicant-utils";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/_app/top")({
  component: TopApplicants,
});

function TopApplicants() {
  const { data: apps = [] } = useQuery({
    queryKey: ["applicants"],
    queryFn: async () => {
      const { data } = await supabase
        .from("applicants")
        .select("*")
        .order("total_score", { ascending: false });
      return (data ?? []) as Applicant[];
    },
  });

  const { data: reviews = [] } = useQuery({
    queryKey: ["all-reviews"],
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("*");
      return (data ?? []) as Review[];
    },
  });

  const ranked = useMemo(
    () => [...apps].sort((a, b) => Number(b.total_score) - Number(a.total_score)),
    [apps],
  );
  const finalists = apps.filter((a) => a.is_finalist);
  const selected = apps.filter((a) => a.is_selected);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          Decision Support
        </p>
        <h1 className="font-display text-3xl mt-1">Scoring Summary</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Finalist Selection Pending. This page supports discussion only and is not a final Top 10
          list.
        </p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            <Trophy className="h-4 w-4 mr-1.5" /> Finalist Selection Pending
          </TabsTrigger>
          <TabsTrigger value="finalists">
            <Star className="h-4 w-4 mr-1.5" /> Finalists ({finalists.length})
          </TabsTrigger>
          <TabsTrigger value="selected">
            <Award className="h-4 w-4 mr-1.5" /> Selected ({selected.length})
          </TabsTrigger>
          <TabsTrigger value="compare">Compare</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <Card className="p-8 text-center text-muted-foreground rounded-xl border-border/60">
            N/A until selected.
          </Card>
        </TabsContent>
        <TabsContent value="finalists">
          <RankList list={finalists} reviews={reviews} />
        </TabsContent>
        <TabsContent value="selected">
          <RankList list={selected} reviews={reviews} />
        </TabsContent>
        <TabsContent value="compare">
          <CompareTable list={ranked.slice(0, 10)} reviews={reviews} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RankList({ list, reviews }: { list: Applicant[]; reviews: Review[] }) {
  if (list.length === 0)
    return (
      <Card className="p-8 text-center text-muted-foreground rounded-xl border-border/60">
        No applicants in this group yet.
      </Card>
    );
  return (
    <div className="space-y-3">
      {list.map((a, i) => {
        const rs = reviews.filter((r) => r.applicant_id === a.id);
        const recCounts = rs.reduce<Record<string, number>>((acc, r) => {
          if (r.recommendation) acc[r.recommendation] = (acc[r.recommendation] ?? 0) + 1;
          return acc;
        }, {});
        const topRec = Object.entries(recCounts).sort((x, y) => y[1] - x[1])[0]?.[0];
        const miss = missingItems(a);
        return (
          <Link key={a.id} to="/applicants/$id" params={{ id: a.id }}>
            <Card className="p-5 rounded-xl border-border/60 hover:shadow-[var(--shadow-card)] transition-shadow">
              <div className="flex items-center gap-4">
                <div
                  className={`h-12 w-12 rounded-full grid place-items-center font-display text-lg ${i < 3 ? "bg-[var(--gradient-gold)] text-gold-foreground" : "bg-secondary text-secondary-foreground"}`}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg">{fullName(a)}</span>
                    {a.is_finalist && (
                      <Badge className="bg-gold/20 text-gold-foreground border-gold/40">
                        Finalist
                      </Badge>
                    )}
                    {a.is_selected && (
                      <Badge className="bg-success/20 text-success border-success/40">
                        Selected
                      </Badge>
                    )}
                    {miss.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-warning border-warning/40 bg-warning/10"
                      >
                        Missing: {miss.join(", ")}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {a.college_attending || "—"} · {rs.length} review(s)
                    {topRec ? ` · ${recommendationLabel(topRec)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-display text-3xl">{Number(a.total_score).toFixed(0)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    / 90
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

function CompareTable({ list, reviews }: { list: Applicant[]; reviews: Review[] }) {
  const [picked, setPicked] = useState<Set<string>>(new Set(list.slice(0, 4).map((a) => a.id)));
  const toggle = (id: string) => {
    const n = new Set(picked);
    n.has(id) ? n.delete(id) : n.add(id);
    setPicked(n);
  };
  const sel = list.filter((a) => picked.has(a.id));
  return (
    <div className="space-y-4">
      <Card className="p-4 rounded-xl border-border/60">
        <div className="text-sm font-medium mb-2">Pick applicants to compare</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
          {list.map((a) => (
            <label
              key={a.id}
              className="flex items-center gap-2 text-sm rounded-md border border-border p-2 hover:bg-muted/40"
            >
              <Checkbox checked={picked.has(a.id)} onCheckedChange={() => toggle(a.id)} />
              <span className="truncate">{fullName(a)}</span>
            </label>
          ))}
        </div>
      </Card>

      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Criterion</th>
                {sel.map((a) => (
                  <th key={a.id} className="text-left px-4 py-3 min-w-[160px]">
                    {fullName(a)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              <Row
                label="Total Score"
                cells={sel.map((a) => (
                  <span className="font-semibold">{Number(a.total_score).toFixed(1)}</span>
                ))}
              />
              <Row
                label="College / Vocational"
                cells={sel.map((a) => a.college_attending || "—")}
              />
              <Row label="High School" cells={sel.map((a) => a.graduation_high_school || "—")} />
              <Row
                label="Status"
                cells={sel.map((a) => (
                  <Badge variant="outline">{a.application_status}</Badge>
                ))}
              />
              <Row
                label="Reviews"
                cells={sel.map((a) => reviews.filter((r) => r.applicant_id === a.id).length)}
              />
              <Row
                label="Top Recommendation"
                cells={sel.map((a) => {
                  const rs = reviews.filter((r) => r.applicant_id === a.id);
                  const counts = rs.reduce<Record<string, number>>((acc, r) => {
                    if (r.recommendation) acc[r.recommendation] = (acc[r.recommendation] ?? 0) + 1;
                    return acc;
                  }, {});
                  const top = Object.entries(counts).sort((x, y) => y[1] - x[1])[0]?.[0];
                  return top ? recommendationLabel(top) : "—";
                })}
              />
              <Row
                label="Missing Documents"
                cells={sel.map((a) => {
                  const m = missingItems(a);
                  return m.length === 0 ? (
                    <Badge
                      variant="outline"
                      className="text-success border-success/40 bg-success/10"
                    >
                      Complete
                    </Badge>
                  ) : (
                    <span className="text-warning">{m.join(", ")}</span>
                  );
                })}
              />
              <Row label="Finalist" cells={sel.map((a) => (a.is_finalist ? "★" : "—"))} />
              <Row label="Selected" cells={sel.map((a) => (a.is_selected ? "✓" : "—"))} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, cells }: { label: string; cells: React.ReactNode[] }) {
  return (
    <tr>
      <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted-foreground bg-muted/30 font-medium">
        {label}
      </td>
      {cells.map((c, i) => (
        <td key={i} className="px-4 py-3 align-top">
          {c}
        </td>
      ))}
    </tr>
  );
}
