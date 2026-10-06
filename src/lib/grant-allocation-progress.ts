import type { AllocationEntry } from "./grant-committee.ts";
import { projectAssignmentProgress } from "./review-queue-projections.ts";

type Assignment = { id: string; application_id: string; reviewer_id: string; lifecycle: string };
type Review = { id: string; assignment_id: string; status: string };
type Conflict = { id: string; assignment_id: string };
type Resolution = { report_id: string; decision: string; replacement_assignment_id: string | null };

export function projectGrantAllocationProgress(
  entries: AllocationEntry[],
  assignments: Assignment[],
  reviews: Review[],
  conflicts: Conflict[],
  resolutions: Resolution[],
) {
  return entries.map((entry) => ({
    ...entry,
    slots: entry.reviewers.map((originalReviewerId) => {
      let assignment = assignments.find(
        (a) => a.application_id === entry.applicationId && a.reviewer_id === originalReviewerId,
      );
      const seen = new Set<string>();
      while (assignment?.lifecycle === "suspended" && !seen.has(assignment.id)) {
        seen.add(assignment.id);
        const reportIds = new Set(
          conflicts.filter((r) => r.assignment_id === assignment!.id).map((r) => r.id),
        );
        const resolution = resolutions.find(
          (r) => reportIds.has(r.report_id) && r.decision === "replaced",
        );
        const next = assignments.find(
          (a) =>
            a.id === resolution?.replacement_assignment_id &&
            a.application_id === entry.applicationId,
        );
        if (!next) break;
        assignment = next;
      }
      const reviewerId = assignment?.reviewer_id ?? originalReviewerId;
      const review = assignment && reviews.find((r) => r.assignment_id === assignment.id);
      const progress = assignment
        ? projectAssignmentProgress(
            "business_growth_grant",
            assignment,
            review
              ? [{ ...review, application_id: entry.applicationId, reviewer_id: reviewerId }]
              : [],
            [],
          )
        : null;
      const completed = assignment?.lifecycle === "active" && progress?.completedReviews === 1;
      return { originalReviewerId, reviewerId, assignment, progress, completed };
    }),
  }));
}
