import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/my-group-rankings")({ component: MyGroupRankings });

function MyGroupRankings() {
  const { user, selectedProgram } = useAuth();
  const programId =
    selectedProgram?.slug === "business_growth_grant" ? selectedProgram.programId : null;
  const query = useQuery({
    queryKey: ["my-group-rankings", programId, user?.id],
    enabled: !!user && !!programId,
    refetchInterval: 60000,
    queryFn: async () => {
      if (!programId) throw new Error("Select Business Growth Grant.");
      const { data, error } = await supabase.rpc("my_grant_group_rankings", {
        p_program: programId,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
  const rows = query.data ?? [];
  const groups = new Map(rows.map((row) => [row.group_id, row.group_name]));
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-display text-3xl">My Group Rankings</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Standings use submitted reviews. A provisional average can change as teammates finish
          scoring. Equal averages share a rank.
        </p>
      </header>
      {!programId ? (
        <p>Select Business Growth Grant to see your rankings.</p>
      ) : query.isError ? (
        <Card className="p-5" role="alert">
          Group rankings could not load.
          <Button variant="outline" className="ml-3" onClick={() => query.refetch()}>
            Try again
          </Button>
        </Card>
      ) : query.isPending ? (
        <p role="status">Loading group rankings…</p>
      ) : !rows.length ? (
        <Card className="p-5">You have no current group applications to display.</Card>
      ) : (
        Array.from(groups, ([id, name]) => (
          <section key={id}>
            <h2 className="mb-2 text-xl font-semibold">{name}</h2>
            <Card className="divide-y">
              {rows
                .filter((row) => row.group_id === id)
                .map((row) => (
                  <div
                    key={row.application_id}
                    className="grid gap-2 p-4 sm:grid-cols-[5rem_1fr_auto] sm:items-center"
                  >
                    <span className="font-semibold text-primary">
                      {row.standing === null ? "Unranked" : "#" + row.standing}
                    </span>
                    <div className="min-w-0 break-words">
                      <h3 className="font-semibold">{row.business_name || row.applicant_name}</h3>
                      {row.business_name && (
                        <p className="text-sm text-muted-foreground">{row.applicant_name}</p>
                      )}
                      <p className="text-sm">
                        {row.submitted} of {row.assigned} reviews submitted
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {row.average_score !== null && (
                        <strong>{row.average_score.toFixed(1)} / 100</strong>
                      )}
                      <Badge variant="outline">{row.state}</Badge>
                    </div>
                  </div>
                ))}
            </Card>
          </section>
        ))
      )}
    </div>
  );
}
