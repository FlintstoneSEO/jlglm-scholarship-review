import assert from "node:assert/strict";
import test from "node:test";
import {
  duplicateImpactCounts,
  duplicateImpactSchema,
  duplicateCandidatesSchema,
  validDuplicateReason,
} from "./application-duplicates.ts";
import { normalizeReviewSubmissionError } from "./review-submission.ts";
import { parseGrantQueueSearch } from "./grant-screening.ts";
import {
  activeAllocationEntries,
  projectGrantAllocationProgress,
} from "./grant-allocation-progress.ts";
import { summarizeGrantProgress } from "./grant-progress-summary.ts";

test("impact counts preserve completed and draft history separately from not started", () => {
  const impact = duplicateImpactSchema.parse({
    application_id: "synthetic",
    assignments: [
      {
        id: "1",
        reviewer_name: "Fictional A",
        lifecycle: "active",
        review_status: "completed",
        review_version: 1,
      },
      {
        id: "2",
        reviewer_name: "Fictional B",
        lifecycle: "active",
        review_status: "in_progress",
        review_version: 2,
      },
      {
        id: "3",
        reviewer_name: "Fictional C",
        lifecycle: "suspended",
        review_status: "not_started",
        review_version: null,
      },
    ],
  });
  assert.deepEqual(duplicateImpactCounts(impact), {
    assignments: 3,
    completed: 1,
    drafts: 1,
    notStarted: 1,
  });
  assert.deepEqual(duplicateImpactCounts({ application_id: "empty", assignments: [] }), {
    assignments: 0,
    completed: 0,
    drafts: 0,
    notStarted: 0,
  });
});
test("reason is required and bounded after trimming", () => {
  assert.equal(validDuplicateReason("  "), false);
  assert.equal(validDuplicateReason("short"), false);
  assert.equal(validDuplicateReason(" Valid synthetic reason "), true);
  assert.equal(validDuplicateReason("x".repeat(4001)), false);
});
test("invalid impact/candidate responses fail closed", () => {
  assert.equal(duplicateImpactSchema.safeParse({ assignments: [] }).success, false);
  assert.equal(
    duplicateCandidatesSchema.safeParse([{ id: "a", business_name: "Missing applicant" }]).success,
    false,
  );
});
test("excluded filter is explicit and stale review errors retain their explanation", () => {
  assert.deepEqual(parseGrantQueueSearch({ duplicates: "excluded" }), { duplicates: "excluded" });
  assert.deepEqual(parseGrantQueueSearch({ duplicates: "anything" }), {});
  const error = normalizeReviewSubmissionError({
    message: "review_submission:duplicate_application:This application is excluded as a duplicate.",
  });
  assert.equal(error.code, "duplicate_application");
  assert.match(error.message, /excluded as a duplicate/);
});

test("excluded application leaves active group denominators without altering frozen history", () => {
  const frozen = [
    { applicationId: "excluded", pair: 1, reviewers: ["a", "b"] },
    { applicationId: "retained", pair: 1, reviewers: ["c", "d"] },
  ];
  const before = structuredClone(frozen);
  const projected = projectGrantAllocationProgress(
    activeAllocationEntries(frozen, new Set(["retained"])),
    [
      { id: "c1", application_id: "retained", reviewer_id: "c", lifecycle: "active" },
      { id: "d1", application_id: "retained", reviewer_id: "d", lifecycle: "active" },
    ],
    [{ id: "r1", assignment_id: "c1", status: "completed" }],
    [],
    [],
  );
  const summary = summarizeGrantProgress([
    { id: "batch", applied_at: "2026-10-27", sourceGroups: [], entries: projected, pool: [] },
  ]);
  assert.equal(summary.expected, 2);
  assert.equal(summary.completed, 1);
  assert.equal(summary.groups[0].remaining, 1);
  assert.deepEqual(frozen, before);
});
