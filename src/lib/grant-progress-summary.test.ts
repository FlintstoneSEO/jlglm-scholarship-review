import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGrantProgress, type ProgressAllocation } from "./grant-progress-summary.ts";
import { projectGrantAllocationProgress } from "./grant-allocation-progress.ts";

function allocation(
  id: string,
  applicationId: string,
  groupId = "group",
  reviewers = ["a", "b"],
): ProgressAllocation {
  return {
    id,
    applied_at: id === "new" ? "2026-10-20" : "2026-10-10",
    pool: [{ id: applicationId, name: applicationId }],
    sourceGroups: [{ id: groupId, name: id, members: reviewers, revision: id === "new" ? 2 : 1 }],
    entries: projectGrantAllocationProgress(
      [{ applicationId, pair: 1, reviewers }],
      reviewers.map((reviewer_id) => ({
        id: `${applicationId}:${reviewer_id}`,
        application_id: applicationId,
        reviewer_id,
        lifecycle: "active",
      })),
      [
        {
          id: `r:${applicationId}`,
          assignment_id: `${applicationId}:${reviewers[0]}`,
          status: "completed",
        },
      ],
      [],
      [],
    ),
  };
}

test("group IDs combine batches and revisions, preserve original memberships, and reconcile totals", () => {
  const old = allocation("old", "app1");
  const latest = allocation("new", "app2", "group", ["c", "d"]);
  const result = summarizeGrantProgress([old, latest]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].name, "new");
  assert.equal(result.groups[0].entries.length, 2);
  assert.equal(result.completed, 2);
  assert.equal(result.expected, 4);
  assert.equal(result.groups[0].remaining, 2);
  assert.deepEqual(
    new Set(result.groups[0].slots.map((s) => s.originalReviewerId)),
    new Set(["a", "b", "c", "d"]),
  );
  assert.equal(old.entries.length, 1);
});

test("legacy groups use reviewer identity, never local pair number or displayed name", () => {
  const first = allocation("old", "app1");
  const same = allocation("new", "app2", "ignored", ["b", "a"]);
  const unrelated = allocation("third", "app3", "ignored", ["c", "d"]);
  for (const item of [first, same, unrelated]) item.sourceGroups = [];
  const result = summarizeGrantProgress([first, same, unrelated]);
  assert.equal(result.groups.length, 2);
  assert.deepEqual(
    result.groups.map((g) => g.entries.length),
    [2, 1],
  );
  assert.equal(result.expected, 6);
});

test("same name and pair position with different source IDs remain distinct", () => {
  assert.equal(
    summarizeGrantProgress([allocation("old", "app1", "one"), allocation("old", "app2", "two")])
      .groups.length,
    2,
  );
});

test("duplicate applications are flagged without silently changing baseline denominator", () => {
  const result = summarizeGrantProgress([allocation("old", "app"), allocation("new", "app")]);
  assert.deepEqual(result.duplicateApplications, ["app"]);
  assert.equal(result.expected, 4);
});

test("holds, replacements, missing assignments and empty workload preserve completion rules", () => {
  const item = allocation("old", "app");
  item.entries = projectGrantAllocationProgress(
    [{ applicationId: "app", pair: 1, reviewers: ["a", "b"] }],
    [
      { id: "a", application_id: "app", reviewer_id: "a", lifecycle: "suspended" },
      { id: "c", application_id: "app", reviewer_id: "c", lifecycle: "active" },
    ],
    [
      { id: "old-review", assignment_id: "a", status: "completed" },
      { id: "current", assignment_id: "c", status: "completed" },
    ],
    [
      { id: "replacement", assignment_id: "a", resolved_at: "2026-10-10" },
      { id: "hold", assignment_id: "c", resolved_at: null },
    ],
    [{ report_id: "replacement", decision: "replaced", replacement_assignment_id: "c" }],
  );
  const result = summarizeGrantProgress([item]);
  assert.equal(result.expected, 2);
  assert.equal(result.completed, 0);
  assert.equal(result.groups[0].held, 1);
  assert.equal(result.groups[0].unavailable, 1);
  assert.equal(result.groups[0].slots[0].reviewerId, "c");
  assert.equal(summarizeGrantProgress([]).expected, 0);
});

test("cross-group replacements finish the source group's work without joining its roster or getting personal credit there", () => {
  const source = allocation("old", "app1", "one");
  const other = allocation("new", "app2", "two", ["c", "d"]);
  source.entries = projectGrantAllocationProgress(
    [{ applicationId: "app1", pair: 1, reviewers: ["a", "b"] }],
    [
      { id: "original", application_id: "app1", reviewer_id: "a", lifecycle: "suspended" },
      { id: "replacement", application_id: "app1", reviewer_id: "c", lifecycle: "active" },
      { id: "partner", application_id: "app1", reviewer_id: "b", lifecycle: "active" },
    ],
    [{ id: "replacement-review", assignment_id: "replacement", status: "completed" }],
    [{ id: "conflict", assignment_id: "original", resolved_at: "2026-10-10" }],
    [{ report_id: "conflict", decision: "replaced", replacement_assignment_id: "replacement" }],
  );
  const result = summarizeGrantProgress([source, other]);
  const group = result.groups.find((g) => g.id === "group:one")!;
  assert.deepEqual(
    group.reviewers.map((reviewer) => reviewer.id),
    ["a", "b"],
  );
  assert.deepEqual(group.reviewers[0], {
    id: "a",
    completed: 0,
    outstanding: 0,
    reassignedCompleted: 1,
    reassignedOutstanding: 0,
  });
  assert.equal(group.completed, 1);
  assert.equal(group.remaining, 1);
  assert.equal(result.groups.find((g) => g.id === "group:two")!.completed, 1);
  assert.equal(result.completed, 2);
  assert.equal(result.expected, 4);
});
