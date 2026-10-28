import { z } from "zod";
import type { ReviewProgress } from "./review-domain.ts";

export const grantAssignmentSummarySchema = z.object({
  application_id: z.string(),
  assignments: z.array(
    z.object({
      assignment_id: z.string(),
      reviewer_id: z.string(),
      reviewer_name: z.string(),
      assigned_at: z.string(),
      status: z.enum(["not_started", "draft", "submitted", "on_hold"]),
      replaces: z.string().nullable(),
    }),
  ),
  history: z.array(
    z.object({
      id: z.string(),
      kind: z.enum([
        "assigned",
        "conflict_reported",
        "cleared",
        "replaced",
        "deactivated",
        "marked_duplicate",
      ]),
      occurred_at: z.string(),
      reviewer_name: z.string(),
      replacement_name: z.string().nullable().optional(),
      reason: z.string().optional(),
      actor_name: z.string().optional(),
    }),
  ),
});
export type GrantAssignmentSummary = z.infer<typeof grantAssignmentSummarySchema>;

/** Never hydrate a personal review from an excluded or deactivated assignment. */
export function activePersonalGrantReview<
  A extends { id: string; reviewer_id: string; lifecycle: string },
  R extends { assignment_id: string; reviewer_id: string },
>(assignments: A[], reviews: R[], reviewerId: string | undefined) {
  const assignment = assignments.find(
    (a) => a.reviewer_id === reviewerId && a.lifecycle === "active",
  );
  const review =
    assignment &&
    reviews.find((r) => r.assignment_id === assignment.id && r.reviewer_id === reviewerId);
  return { assignment, review };
}

export function grantAssignmentProgress(
  summary: GrantAssignmentSummary | null,
  failed = false,
): ReviewProgress {
  if (!summary)
    return {
      scope: "application",
      state: failed ? "error" : "pending",
      assignedReviewers: null,
      startedReviews: null,
      completedReviews: null,
      remainingReviews: null,
      denominator: { kind: "unknown", value: null },
      anomalies: [],
    };
  const completed = summary.assignments.filter((a) => a.status === "submitted").length;
  return {
    scope: "application",
    state: "known",
    assignedReviewers: summary.assignments.length,
    startedReviews: summary.assignments.filter(
      (a) => a.status === "draft" || a.status === "submitted",
    ).length,
    completedReviews: completed,
    remainingReviews: summary.assignments.length - completed,
    denominator: { kind: "assigned", value: summary.assignments.length },
    anomalies: [],
  };
}

export function assignmentHistoryText(event: GrantAssignmentSummary["history"][number]) {
  switch (event.kind) {
    case "assigned":
      return `Assigned to ${event.reviewer_name}`;
    case "conflict_reported":
      return `Conflict reported by ${event.reviewer_name}`;
    case "cleared":
      return `Conflict cleared for ${event.reviewer_name}`;
    case "replaced":
      return `${event.replacement_name || "Replacement unavailable"} replaced ${event.reviewer_name}`;
    case "marked_duplicate":
      return "Application marked as duplicate; all reviews preserved as excluded history";
    case "deactivated":
      return `Assignment deactivated for ${event.reviewer_name}`;
  }
}
