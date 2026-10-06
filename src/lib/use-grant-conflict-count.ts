import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useGrantConflictCount(programId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["grant-conflict-count", programId],
    enabled: enabled && !!programId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const applications = await supabase
        .from("portal_applications")
        .select("id")
        .eq("program_id", programId!)
        .eq("is_test", false)
        .is("practice_session_id", null);
      if (applications.error) throw applications.error;
      if (!applications.data.length) return 0;
      const reports = await supabase
        .from("grant_conflict_reports")
        .select("id", { count: "exact", head: true })
        .eq("program_id", programId!)
        .is("resolved_at", null)
        .in(
          "application_id",
          applications.data.map((a) => a.id),
        );
      if (reports.error) throw reports.error;
      return reports.count ?? 0;
    },
  });
}
