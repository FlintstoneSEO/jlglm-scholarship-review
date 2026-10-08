import type { ApplicationScope } from "./application-scope";
import { supabase } from "@/integrations/supabase/client";

export async function loadGrantQueue(programId: string, scope: ApplicationScope = "real") {
  let request = supabase
    .from("portal_applications")
    .select("*")
    .eq("program_id", programId)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: true });
  if (scope !== "all") request = request.eq("is_test", scope === "test");
  const applicationsResult = await request;
  if (applicationsResult.error) throw applicationsResult.error;
  const ids = (applicationsResult.data ?? []).map((item) => item.id);
  const [detailsResult, assignmentsResult, reviewsResult, eligibilityResult] = await Promise.all([
    ids.length
      ? supabase
          .from("business_grant_application_details")
          .select(
            "application_id, business_name, business_operating_model, business_age_range, lara_status",
          )
          .in("application_id", ids)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("reviewer_assignments")
      .select("id, application_id, reviewer_id, lifecycle")
      .eq("program_id", programId),
    supabase
      .from("program_reviews")
      .select("id, application_id, reviewer_id, assignment_id, status")
      .eq("program_id", programId),
    ids.length
      ? supabase
          .from("application_eligibility_reviews")
          .select("application_id, status")
          .in("application_id", ids)
      : Promise.resolve({ data: [], error: null }),
  ]);
  return {
    applications: applicationsResult.data ?? [],
    details: detailsResult.data ?? [],
    detailError: !!detailsResult.error,
    assignments: assignmentsResult.data ?? [],
    assignmentError: !!assignmentsResult.error,
    reviews: reviewsResult.data ?? [],
    reviewError: !!reviewsResult.error,
    eligibility: eligibilityResult.data ?? [],
    eligibilityError: !!eligibilityResult.error,
  };
}
