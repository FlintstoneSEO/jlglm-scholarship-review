import assert from "node:assert/strict";
import test from "node:test";
import {
  activePersonalGrantReview,
  assignmentHistoryText,
  grantAssignmentProgress,
  grantAssignmentSummarySchema,
} from "./grant-assignment-summary.ts";

const assignments = [
  { id: "excluded", reviewer_id: "me", lifecycle: "suspended" },
  { id: "active", reviewer_id: "me", lifecycle: "active" },
];
const reviews = [
  { assignment_id: "excluded", reviewer_id: "me", status: "completed" },
  { assignment_id: "active", reviewer_id: "me", status: "in_progress" },
];
test("personal review follows the active assignment rather than retained submitted history", () => {
  assert.equal(activePersonalGrantReview(assignments, reviews, "me").review?.status, "in_progress");
  assert.equal(activePersonalGrantReview(assignments.slice(0, 1), reviews, "me").review, undefined);
  assert.equal(
    activePersonalGrantReview(assignments, reviews, "someone-else").assignment,
    undefined,
  );
  assert.equal(activePersonalGrantReview(assignments, reviews.slice(0, 1), "me").review, undefined);
});
test("summary progress counts current statuses and never treats missing data as zero", () => {
  const summary = grantAssignmentSummarySchema.parse({
    application_id: "a",
    history: [],
    assignments: [
      {
        assignment_id: "1",
        reviewer_id: "me",
        reviewer_name: "Reviewer",
        assigned_at: "2026-10-27",
        status: "on_hold",
        replaces: null,
      },
      {
        assignment_id: "2",
        reviewer_id: "peer",
        reviewer_name: "Peer",
        assigned_at: "2026-10-27",
        status: "submitted",
        replaces: "Original",
      },
    ],
  });
  assert.equal(grantAssignmentProgress(summary).completedReviews, 1);
  assert.equal(grantAssignmentProgress(summary).remainingReviews, 1);
  assert.equal(grantAssignmentProgress(null, true).assignedReviewers, null);
  assert.equal(grantAssignmentProgress(null, true).state, "error");
  assert.equal(grantAssignmentProgress(null).state, "pending");
  assert.equal(grantAssignmentProgress({ ...summary, assignments: [] }).assignedReviewers, 0);
});
test("invalid summary data fails rather than silently showing no reviewers", () => {
  assert.equal(grantAssignmentSummarySchema.safeParse({}).success, false);
});
test("history distinguishes cleared conflicts, replacements and deactivation", () => {
  const base = { id: "e", occurred_at: "2026-10-27", reviewer_name: "Original" };
  assert.equal(
    assignmentHistoryText({ ...base, kind: "replaced", replacement_name: "Replacement" }),
    "Replacement replaced Original",
  );
  assert.equal(
    assignmentHistoryText({ ...base, kind: "cleared" }),
    "Conflict cleared for Original",
  );
  assert.equal(
    assignmentHistoryText({ ...base, kind: "deactivated" }),
    "Assignment deactivated for Original",
  );
});
