import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/grant-rankings")({ component: GrantRankings });

function GrantRankings() {
  const { selectedProgram } = useAuth();
  const admin =
    selectedProgram?.slug === "business_growth_grant" && selectedProgram.accessRole === "admin";
  const { data = [], isLoading } = useQuery({
    queryKey: ["grant-rankings", selectedProgram?.programId],
    enabled: admin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_rankings")
        .select("*")
        .eq("program_id", selectedProgram!.programId)
        .order("rank");
      if (error) throw error;
      return data ?? [];
    },
  });
  if (!admin)
    return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          Decision support only
        </p>
        <h1 className="font-display text-3xl mt-1">Business Growth Grant rankings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scores organize committee discussion. This view never selects recipients.
        </p>
      </div>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Rank</th>
                <th className="text-left px-4 py-3">Business</th>
                <th className="text-left px-4 py-3">Applicant</th>
                <th className="text-right px-4 py-3">Completed Reviews</th>
                <th className="text-right px-4 py-3">Average Score</th>
                <th className="text-left px-4 py-3">Review Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center">
                    Loading…
                  </td>
                </tr>
              )}
              {data.map((row) => (
                <tr key={row.application_id}>
                  <td className="px-4 py-3 font-display text-xl">#{row.rank}</td>
                  <td className="px-4 py-3 font-medium">
                    <Link
                      to="/grants/$id"
                      params={{ id: row.application_id! }}
                      className="hover:text-primary"
                    >
                      {row.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.applicant_name}</td>
                  <td className="px-4 py-3 text-right">{row.completed_review_count}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {Number(row.average_score ?? 0).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">
                      {row.review_status?.replaceAll("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
