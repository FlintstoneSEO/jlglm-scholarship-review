import type { ApplicationScope } from "./application-scope";
import { supabase } from "@/integrations/supabase/client";

export async function loadGrantQueue(
  programId: string,
  scope: ApplicationScope = "real",
  reviewerId?: string,
) {
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
  const [
    detailsResult,
    assignmentsResult,
    reviewsResult,
    eligibilityResult,
    conflictsResult,
    declarationsResult,
    rubricResult,
    criteriaResult,
  ] = await Promise.all([
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
          .select("id, application_id, status")
          .in("application_id", ids)
      : Promise.resolve({ data: [], error: null }),
    reviewerId
      ? supabase
          .from("grant_conflict_reports")
          .select("assignment_id")
          .eq("program_id", programId)
          .eq("reviewer_id", reviewerId)
          .is("resolved_at", null)
      : Promise.resolve({ data: [], error: null }),
    reviewerId
      ? supabase
          .from("grant_conflict_declarations")
          .select("assignment_id")
          .eq("reviewer_id", reviewerId)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("rubric_versions")
      .select("id")
      .eq("program_id", programId)
      .eq("active", true)
      .maybeSingle(),
    supabase
      .from("rubric_criteria")
      .select("id, rubric_version_id")
      .eq("program_id", programId)
      .eq("active", true),
  ]);
  const eligibilityIds = (eligibilityResult.data ?? []).map((e) => e.id);
  const overridesResult = eligibilityIds.length
    ? await supabase
        .from("eligibility_scoring_overrides")
        .select("eligibility_review_id, scoring_allowed, created_at, event_number")
        .in("eligibility_review_id", eligibilityIds)
    : { data: [], error: null };
  return {
    rubricReady:
      !!rubricResult.data &&
      (criteriaResult.data ?? []).some((c) => c.rubric_version_id === rubricResult.data?.id),
    rubricError: !!rubricResult.error || !!criteriaResult.error,
    conflicts: conflictsResult.data ?? [],
    conflictError: !!conflictsResult.error,
    declarations: declarationsResult.data ?? [],
    declarationError: !!declarationsResult.error,
    overrides: (overridesResult.data ?? []).map((o) => ({
      ...o,
      application_id:
        eligibilityResult.data?.find((e) => e.id === o.eligibility_review_id)?.application_id ?? "",
    })),
    overrideError: !!overridesResult.error,
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
