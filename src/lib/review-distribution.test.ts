import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  groupReadiness,
  distributionTab,
  matchesDistributionProgress,
  groupUnavailableForSlot,
} from "./review-distribution.ts";
import { parseAssignmentSearch } from "./testing-workflow.ts";
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const groups = [0, 1, 2].map((i) => ({
  id: `g${i}`,
  name: `Group ${i}`,
  members: [`r${i * 2}`, `r${i * 2 + 1}`],
}));
const eligible = groups.flatMap((g) => g.members);
test("readiness requires three distinct complete eligible pairs", () => {
  assert.equal(groupReadiness(groups, eligible).ready, true);
  assert.equal(groupReadiness(groups, eligible.slice(1)).ready, false);
  assert.equal(groupReadiness(groups.slice(1), eligible).ready, false);
  assert.equal(
    groupReadiness([...groups.slice(0, 2), { ...groups[2], members: groups[0].members }], eligible)
      .ready,
    false,
  );
});
test("URL tab and attention state are normalized without accepting private data", () => {
  assert.equal(distributionTab("conflicts"), "conflicts");
  assert.equal(parseAssignmentSearch({ tab: "progress", attention: "true" }).tab, "progress");
  assert.equal(parseAssignmentSearch({ tab: "allocation" }).tab, "allocation");
  assert.equal(
    parseAssignmentSearch({ conflict: "private reason", reason: "sensitive" }).conflict,
    undefined,
  );
});
test("real Grant manual form is conditional; normal client and Testing remain shared", () => {
  const route = read("../routes/_app.assignments.tsx");
  assert.match(route, /const distribution = isGrant && scope === "real"/);
  assert.match(route, /!distribution && selectedApplication && !isError/);
  assert.match(route, /Assignment History &amp; Administration/);
  assert.match(route, /assignReviewer\(/);
  assert.match(read("../components/review/GuidedTesting.tsx"), /assignReviewer\(/);
  assert.match(read("../routes/_app.testing.tsx"), /GuidedTesting/);
  assert.match(read("../components/review/GuidedTesting.tsx"), /Testing Checklist/);
  const allocation = read("../components/review/GrantCommitteeAllocation.tsx");
  for (const label of ["Reviewer Groups", "Random Allocation", "Review Progress"])
    assert.ok(allocation.includes(label));
  assert.match(allocation, /preview_grant_group_allocation/);
  assert.match(allocation, /apply_grant_pair_allocation/);
  assert.match(allocation, /groupStale/);
  assert.match(allocation, /value="conflicts"/);
});

test("conflict attention stays in the portal without an email delivery layer", () => {
  const allocation = read("../components/review/GrantCommitteeAllocation.tsx");
  assert.match(allocation, /conflict requires/);
  assert.match(allocation, /Unresolved conflicts/);
  assert.match(allocation, /<GrantConflictResolution/);
  const indicator = read("./use-grant-conflict-count.ts");
  assert.match(indicator, /grant_conflict_reports/);
  assert.match(indicator, /is\("resolved_at", null\)/);
  const migration = read("../../supabase/migrations/20261006162317_grant_review_distribution.sql");
  assert.doesNotMatch(
    migration,
    /create table public\.notification_|enqueue_conflict_notification|claim_conflict_notifications|finish_conflict_notification/,
  );
  assert.doesNotMatch(read("../../supabase/config.toml"), /functions\.conflict-notifications/);
});

test("group choices prevent duplicate groups, shared reviewers and unavailable access", () => {
  assert.equal(
    groupUnavailableForSlot(groups[0], 1, [groups[0], undefined, undefined], eligible),
    true,
  );
  assert.equal(
    groupUnavailableForSlot(groups[0], 0, [groups[0], undefined, undefined], eligible),
    false,
  );
  assert.equal(
    groupUnavailableForSlot({ ...groups[1], members: ["r0", "r3"] }, 1, [groups[0]], eligible),
    true,
  );
  assert.equal(groupUnavailableForSlot(groups[1], 1, [groups[0]], eligible), false);
  assert.equal(groupUnavailableForSlot(groups[1], 1, [], []), true);
});

test("progress filters include not-started reviews, conflicts and replacement reviewers", () => {
  const row = {
    text: "Example business Replacement reviewer",
    completed: 0,
    expected: 2,
    issue: false,
    groupId: "g1",
    reviewerIds: ["replacement", "r2"],
  };
  const filter = { search: "", status: "outstanding", group: "", reviewer: "" };
  assert.equal(matchesDistributionProgress(row, filter), true);
  assert.equal(matchesDistributionProgress({ ...row, completed: 1 }, filter), true);
  assert.equal(matchesDistributionProgress({ ...row, completed: 2 }, filter), false);
  assert.equal(matchesDistributionProgress({ ...row, completed: 2, issue: true }, filter), true);
  assert.equal(
    matchesDistributionProgress(row, {
      ...filter,
      search: "EXAMPLE",
      reviewer: "replacement",
      group: "g1",
    }),
    true,
  );
  assert.equal(matchesDistributionProgress(row, { ...filter, reviewer: "original" }), false);
  assert.equal(matchesDistributionProgress(row, { ...filter, group: "g2" }), false);
  assert.equal(
    matchesDistributionProgress(
      { ...row, completed: 2, issue: true },
      { ...filter, status: "completed" },
    ),
    false,
  );
  assert.equal(
    matchesDistributionProgress({ ...row, issue: true }, { ...filter, status: "attention" }),
    true,
  );
});
