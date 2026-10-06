import test from "node:test";
import assert from "node:assert/strict";
import { projectGrantAllocationProgress } from "./grant-allocation-progress.ts";

test("group progress follows replacement chains and excludes suspended completed reviews", () => {
  const [entry] = projectGrantAllocationProgress(
    [{ applicationId: "app", pair: 1, reviewers: ["original", "other"] }],
    [
      { id: "a", application_id: "app", reviewer_id: "original", lifecycle: "suspended" },
      { id: "b", application_id: "app", reviewer_id: "replacement", lifecycle: "suspended" },
      { id: "c", application_id: "app", reviewer_id: "final", lifecycle: "active" },
      { id: "d", application_id: "app", reviewer_id: "other", lifecycle: "active" },
    ],
    [
      { id: "old", assignment_id: "a", status: "completed" },
      { id: "current", assignment_id: "c", status: "completed" },
      { id: "draft", assignment_id: "d", status: "in_progress" },
    ],
    [
      { id: "cleared", assignment_id: "a" },
      { id: "r1", assignment_id: "a" },
      { id: "r2", assignment_id: "b" },
    ],
    [
      { report_id: "cleared", decision: "cleared", replacement_assignment_id: null },
      { report_id: "r1", decision: "replaced", replacement_assignment_id: "b" },
      { report_id: "r2", decision: "replaced", replacement_assignment_id: "c" },
    ],
  );
  assert.equal(entry.slots[0].originalReviewerId, "original");
  assert.equal(entry.slots[0].reviewerId, "final");
  assert.equal(entry.slots[0].progress?.completedReviews, 1);
  assert.equal(entry.slots[0].completed, true);
  assert.equal(entry.slots[1].progress?.completedReviews, 0);
});

test("missing, deactivated and unallocated slots do not become completed workload", () => {
  const entries = projectGrantAllocationProgress(
    [
      { applicationId: "app", pair: 1, reviewers: ["inactive", "missing"] },
      { applicationId: "unallocated", pair: null, reviewers: [] },
    ],
    [{ id: "a", application_id: "app", reviewer_id: "inactive", lifecycle: "suspended" }],
    [{ id: "historical", assignment_id: "a", status: "completed" }],
    [],
    [],
  );
  assert.equal(entries[0].slots[0].completed, false);
  assert.equal(entries[0].slots[1].completed, false);
  assert.equal(entries[0].slots[1].assignment, undefined);
  assert.equal(entries[0].slots[1].progress, null);
  assert.deepEqual(entries[1].slots, []);
});
