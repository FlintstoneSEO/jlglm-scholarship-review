import type { QueueAssignment, QueueReview } from "./review-queue-projections";

export type PersonalWorkSource = {
  assignments: QueueAssignment[];
  reviews: QueueReview[];
  conflicts: { assignment_id: string }[];
  declarations: { assignment_id: string }[];
  eligibility: { application_id: string; status: string }[];
  overrides: {
    application_id: string;
    scoring_allowed: boolean;
    created_at: string;
    event_number: number;
  }[];
  rubricReady: boolean;
  rubricError: boolean;
  assignmentError: boolean;
  reviewError: boolean;
  conflictError: boolean;
  declarationError: boolean;
  eligibilityError: boolean;
  overrideError: boolean;
};
export function personalGrantWork(
  source: PersonalWorkSource,
  applicationId: string,
  reviewerId: string,
) {
  const assignment = source.assignments.find(
    (a) =>
      a.application_id === applicationId &&
      a.reviewer_id === reviewerId &&
      a.lifecycle === "active",
  );
  if (
    source.rubricError ||
    source.assignmentError ||
    source.reviewError ||
    source.conflictError ||
    source.declarationError ||
    source.eligibilityError ||
    source.overrideError
  )
    return {
      label: "Your review status unavailable",
      status: "unavailable",
      ready: false,
      active: !!assignment,
    };
  if (!assignment)
    return {
      label: "No active personal assignment",
      status: "unassigned",
      ready: false,
      active: false,
    };
  if (source.conflicts.some((c) => c.assignment_id === assignment.id))
    return {
      label: "On hold — conflict reported",
      status: "unavailable",
      ready: false,
      active: true,
    };
  const review = source.reviews.find(
    (r) => r.assignment_id === assignment.id && r.reviewer_id === reviewerId,
  );
  if (review?.status === "completed")
    return { label: "Your review: submitted", status: "completed", ready: false, active: true };
  if (!source.rubricReady)
    return {
      label: "Your review: awaiting active rubric",
      status: review?.status ?? "not_started",
      ready: false,
      active: true,
    };
  const override = source.overrides
    .filter((o) => o.application_id === applicationId)
    .sort((a, b) => b.event_number - a.event_number)[0];
  if (
    !source.eligibility.some(
      (e) => e.application_id === applicationId && e.status === "eligible",
    ) &&
    !override?.scoring_allowed
  )
    return {
      label: "Your review: awaiting eligibility",
      status: review?.status ?? "not_started",
      ready: false,
      active: true,
    };
  if (!source.declarations.some((d) => d.assignment_id === assignment.id))
    return {
      label: "Your review: conflict decision needed",
      status: review?.status ?? "not_started",
      ready: false,
      active: true,
    };
  return {
    label: review ? "Your review: in progress" : "Your review: ready to begin",
    status: review?.status ?? "not_started",
    ready: true,
    active: true,
  };
}
