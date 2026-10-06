import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { practiceApplicationName, practiceProgress } from "./testing-workflow";
export function useTestingApplications(programId: string | undefined, slug: string | undefined) {
  return useQuery({
    queryKey: ["test-applications", programId, slug],
    enabled: !!programId,
    refetchInterval: 10000,
    queryFn: async () => {
      const apps = await supabase
        .from("portal_applications")
        .select("*")
        .eq("program_id", programId!)
        .eq("is_test", true)
        .order("created_at", { ascending: false });
      if (apps.error) throw apps.error;
      const ids = (apps.data ?? []).map((a) => a.id);
      const [assignments, legacy, details, access] = await Promise.all([
        ids.length
          ? supabase
              .from("reviewer_assignments")
              .select("id,application_id,reviewer_id,lifecycle")
              .in("application_id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length && slug === "scholarship"
          ? supabase.from("applicants").select("id,application_id").in("application_id", ids)
          : Promise.resolve({ data: [], error: null }),
        ids.length && slug === "business_growth_grant"
          ? supabase
              .from("business_grant_application_details")
              .select("application_id,business_name")
              .in("application_id", ids)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("user_program_access")
          .select("user_id")
          .eq("program_id", programId!)
          .in("access_role", ["reviewer", "admin"]),
      ]);
      for (const r of [assignments, legacy, details, access]) if (r.error) throw r.error;
      const legacyIds = (legacy.data ?? []).map((a) => a.id);
      const assignmentIds = (assignments.data ?? []).map((a) => a.id);
      const [reviews, profiles] = await Promise.all([
        slug === "scholarship"
          ? legacyIds.length
            ? supabase
                .from("reviews")
                .select(
                  "id,applicant_id,reviewer_id,is_complete,writing_score,rhetoric_score,total_score",
                )
                .in("applicant_id", legacyIds)
            : Promise.resolve({ data: [], error: null })
          : assignmentIds.length
            ? supabase
                .from("program_reviews")
                .select("id,assignment_id,reviewer_id,status,total_score")
                .in("assignment_id", assignmentIds)
            : Promise.resolve({ data: [], error: null }),
        access.data?.length
          ? supabase
              .from("profiles")
              .select("id,full_name,email")
              .in(
                "id",
                access.data.map((a) => a.user_id),
              )
          : Promise.resolve({ data: [], error: null }),
      ]);
      for (const r of [reviews, profiles]) if (r.error) throw r.error;
      return {
        profiles: profiles.data ?? [],
        apps: (apps.data ?? []).map((a) => {
          const applicantId = legacy.data?.find((l) => l.application_id === a.id)?.id ?? null;
          return {
            ...a,
            applicantId,
            displayName: practiceApplicationName(
              a.applicant_name,
              slug!,
              details.data?.find((d) => d.application_id === a.id)?.business_name,
            ),
            progress: practiceProgress(
              slug!,
              a.id,
              applicantId,
              assignments.data ?? [],
              reviews.data ?? [],
            ),
          };
        }),
      };
    },
  });
}
export type TestingApplication = NonNullable<
  ReturnType<typeof useTestingApplications>["data"]
>["apps"][number];
