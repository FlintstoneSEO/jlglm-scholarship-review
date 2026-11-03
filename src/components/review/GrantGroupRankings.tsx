import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { grantGroupStandings } from "@/lib/grant-group-standings";
import type { GrantRankingRow } from "@/lib/grant-ranking-summary";

export function GrantGroupRankings({
  programId,
  rows,
}: {
  programId: string;
  rows: GrantRankingRow[];
}) {
  const membership = useQuery({
    queryKey: ["grant-ranking-groups", programId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("grant_ranking_groups", { p_program: programId });
      if (error) throw error;
      return data ?? [];
    },
  });
  if (membership.isError)
    return (
      <Card className="p-5" role="alert">
        Group assignments could not be loaded.{" "}
        <Button variant="outline" onClick={() => membership.refetch()}>
          Retry
        </Button>
      </Card>
    );
  if (membership.isPending) return <p role="status">Loading group assignments…</p>;
  const { groups, unassigned } = grantGroupStandings(rows, membership.data);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Each group starts at #1. Applications appear once all active reviews are complete, scores
        are valid, and eligibility is confirmed or a scoring exception applies.
      </p>
      {groups.size === 0 && <p>No saved reviewer groups.</p>}
      {Array.from(groups, ([id, group]) => (
        <section key={id}>
          <h2 className="mb-2 font-display text-xl">{group.name}</h2>
          <Card className="divide-y">
            {!group.entries.length && (
              <p className="p-4 text-sm">No applications currently eligible for ranking.</p>
            )}
            {group.entries.map(({ row, rank }) => (
              <div
                key={row.applicationId}
                className="grid gap-2 p-4 sm:grid-cols-[4rem_1fr_auto] sm:items-center"
              >
                <strong aria-label={`Group rank ${rank}`}>#{rank}</strong>
                <div>
                  <Link
                    className="font-semibold text-primary underline"
                    to="/grants/$id"
                    params={{ id: row.applicationId }}
                  >
                    {row.businessName}
                  </Link>
                  <p className="text-sm">{row.applicantName}</p>
                </div>
                <div>
                  <strong>{row.averageScore?.toFixed(1)} / 100</strong>
                  <p className="text-sm text-muted-foreground">
                    Overall #{row.rank} · {row.completedReviewCount} of {row.assignedReviewCount}{" "}
                    reviews
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ))}
      {unassigned.length > 0 && (
        <section>
          <h2 className="font-display text-xl">No saved group assignment</h2>
          <p className="mb-2 text-sm">These applications have an overall rank only.</p>
          <ul>
            {unassigned.map((row) => (
              <li key={row.applicationId}>
                Overall #{row.rank} ·{" "}
                <Link
                  className="text-primary underline"
                  to="/grants/$id"
                  params={{ id: row.applicationId }}
                >
                  {row.businessName}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
