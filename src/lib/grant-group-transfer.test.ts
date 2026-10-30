import test from "node:test";
import assert from "node:assert/strict";
import {
  latestTransfer,
  validTransferReason,
  type TransferOwnership,
} from "./grant-group-transfer.ts";
import {
  projectGrantAllocationProgress,
  projectGrantCurrentAllocations,
} from "./grant-allocation-progress.ts";
import { summarizeGrantProgress } from "./grant-progress-summary.ts";
import { activePersonalGrantReview } from "./grant-assignment-summary.ts";

const transfer: TransferOwnership = {
  id: "t",
  application_id: "app",
  occurred_at: "2026-10-28T12:00:00Z",
  group_snapshot: {
    id: "destination",
    name: "Destination group",
    revision: 1,
    members: ["c", "d"],
  },
};
test("reason validation trims and counts database characters, including non-BMP text", () => {
  assert.equal(validTransferReason("   short   "), false);
  assert.equal(validTransferReason("  valid reason  "), true);
  assert.equal(validTransferReason("😀".repeat(4000)), true);
  assert.equal(validTransferReason("x".repeat(4001)), false);
});
test("current group owns two fresh slots; frozen allocation stays unchanged and old scores do not count", () => {
  const frozen = [{ applicationId: "app", pair: 1, reviewers: ["a", "b"] }];
  const before = structuredClone(frozen);
  const assignments = [
    { id: "old-a", application_id: "app", reviewer_id: "a", lifecycle: "suspended" },
    { id: "old-b", application_id: "app", reviewer_id: "b", lifecycle: "suspended" },
    { id: "new-c", application_id: "app", reviewer_id: "c", lifecycle: "active" },
    { id: "new-d", application_id: "app", reviewer_id: "d", lifecycle: "active" },
  ];
  const reviews = [{ id: "old-review", assignment_id: "old-a", status: "completed" }];
  const entries = projectGrantAllocationProgress(frozen, assignments, reviews, [], [], [transfer]);
  assert.deepEqual(frozen, before);
  const summary = summarizeGrantProgress([
    {
      id: "allocation",
      applied_at: "2026-10-01",
      sourceGroups: [{ id: "original", name: "Original", revision: 1, members: ["a", "b"] }],
      entries,
      pool: [],
    },
  ]);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].name, "Destination group");
  assert.equal(summary.expected, 2);
  assert.equal(summary.completed, 0);
  assert.deepEqual(
    summary.groups[0].reviewers.map((r) => r.id),
    ["c", "d"],
  );
  assert.equal(activePersonalGrantReview(assignments, [], "a").assignment, undefined);
});
test("subsequent conflict chains and later transfers use current destination exactly once", () => {
  const newer = {
    ...transfer,
    id: "newer",
    occurred_at: "2026-10-29",
    group_snapshot: {
      ...transfer.group_snapshot,
      id: "next",
      name: "Next group",
      members: ["e", "f"],
    },
  };
  assert.equal(latestTransfer([newer, transfer], "app")?.id, "newer");
  const [entry] = projectGrantAllocationProgress(
    [{ applicationId: "app", pair: 1, reviewers: ["a", "b"] }],
    [
      { id: "c", application_id: "app", reviewer_id: "c", lifecycle: "suspended" },
      { id: "d", application_id: "app", reviewer_id: "d", lifecycle: "active" },
      { id: "replacement", application_id: "app", reviewer_id: "replacement", lifecycle: "active" },
    ],
    [{ id: "r", assignment_id: "replacement", status: "completed" }],
    [{ id: "report", assignment_id: "c", resolved_at: "2026-10-29" }],
    [{ report_id: "report", decision: "replaced", replacement_assignment_id: "replacement" }],
    [transfer],
  );
  assert.equal(entry.currentGroup?.id, "destination");
  assert.equal(entry.slots[0].reviewerId, "replacement");
  assert.equal(entry.slots[0].completed, true);
  assert.equal(entry.slots.length, 2);
});

test("transferred work is counted once under its current group even with overlapping historical snapshots", () => {
  const entries = projectGrantAllocationProgress(
    [{ applicationId: "app", pair: 1, reviewers: ["a", "b"] }],
    [],
    [],
    [],
    [],
    [transfer],
  );
  const allocation = { id: "old", applied_at: "2026-10-01", sourceGroups: [], entries, pool: [] };
  const result = summarizeGrantProgress([
    allocation,
    { ...allocation, id: "new", applied_at: "2026-10-02" },
  ]);
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].id, "group:destination");
  assert.equal(result.entries.length, 1);
  assert.equal(result.expected, 2);
});

test("manual transfers enter current progress once and outside-scope applications are omitted", () => {
  const older = { ...transfer, id: "older", occurred_at: "2026-10-01" };
  const input = {
    allocations: [],
    activeApplicationIds: new Set(["app"]),
    assignments: [],
    reviews: [],
    conflicts: [],
    resolutions: [],
    transfers: [older, transfer, { ...transfer, id: "test", application_id: "outside" }],
    applicationName: () => "Synthetic application",
  };
  const allocations = projectGrantCurrentAllocations(input);
  assert.equal(allocations.length, 1);
  assert.equal(allocations[0].id, "transfer:t");
  const summary = summarizeGrantProgress(allocations);
  assert.equal(summary.entries.length, 1);
  assert.equal(summary.expected, 2);
  assert.equal(summary.groups[0].id, "group:destination");
  assert.equal(summary.entries[0].applicationName, "Synthetic application");
});
