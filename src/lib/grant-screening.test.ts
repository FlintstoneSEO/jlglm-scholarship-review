import assert from "node:assert/strict";
import test from "node:test";
import {
  grantScreeningCounts,
  matchesGrantQueueSearch,
  nextScreeningApplication,
  parseGrantQueueSearch,
} from "./grant-screening.ts";
import { projectGrantQueue } from "./review-queue-projections.ts";

function item(id: string) {
  return projectGrantQueue({
    applications: {
      state: "ready",
      data: [
        {
          id,
          applicant_name: "Ada Smith",
          applicant_email: "ada@example.invalid",
          review_status: "not_started",
          completed_review_count: 0,
          average_score: 0,
        },
      ],
    },
    details: {
      state: "ready",
      data: [
        {
          application_id: id,
          business_name: "Compiler Co",
          business_age_range: "1-2",
          lara_status: "Active",
          business_operating_model: "Online",
        },
      ],
    },
    assignments: { state: "ready", data: [] },
    reviews: { state: "ready", data: [] },
  }).items[0];
}
test("screening counts include missing and reconfirmation states but exclude unrelated records", () => {
  assert.deepEqual(
    grantScreeningCounts(
      ["new", "changed", "followup", "passed", "failed"],
      [
        { application_id: "changed", status: "not_reviewed" },
        { application_id: "followup", status: "needs_clarification" },
        { application_id: "passed", status: "eligible" },
        { application_id: "failed", status: "ineligible" },
        { application_id: "practice-or-other-program", status: "eligible" },
      ],
    ),
    { not_reviewed: 2, needs_clarification: 1, eligible: 1, ineligible: 1, all: 5 },
  );
});
test("search parsing preserves all return-path filters and rejects invalid states", () => {
  const filters = {
    scope: "test",
    section: "documents",
    eligibility: "not_reviewed",
    q: "Compiler",
    scoring: "not_started",
    lara: "Active",
    model: "Online",
    age: "1-2",
  };
  assert.deepEqual(parseGrantQueueSearch(filters), filters);
  assert.deepEqual(
    parseGrantQueueSearch({
      eligibility: "auto_eligible",
      scoring: "fake",
      q: [],
      lara: "all",
      model: null,
    }),
    {},
  );
});
test("screening navigation uses the same search, scoring and business filters as the queue", () => {
  const candidate = item("a");
  const search = parseGrantQueueSearch({
    eligibility: "not_reviewed",
    q: "COMPILER",
    scoring: "not_started",
    lara: "Active",
    model: "Online",
    age: "1-2",
  });
  assert.equal(matchesGrantQueueSearch(candidate, search, undefined, true), true);
  assert.equal(matchesGrantQueueSearch(candidate, search, "eligible", true), false);
  assert.equal(matchesGrantQueueSearch(candidate, search, "eligible", false), true);
  for (const change of [
    { q: "Unrelated" },
    { scoring: "completed" as const },
    { lara: "Inactive" },
    { model: "Retail" },
    { age: "3-4" },
  ]) {
    assert.equal(
      matchesGrantQueueSearch(candidate, { ...search, ...change }, undefined, true),
      false,
    );
  }
});
test("next applicant skips saved/filtered records, wraps once, and handles exhaustion", () => {
  assert.equal(nextScreeningApplication(["a", "b", "c", "d"], ["d"], "b"), "d");
  assert.equal(nextScreeningApplication(["a", "b", "c"], ["a"], "c"), "a");
  assert.equal(nextScreeningApplication(["a", "b"], ["a"], "a"), null);
  assert.equal(nextScreeningApplication(["a", "b"], [], "a"), null);
  assert.equal(nextScreeningApplication(["a", "b"], ["b"], "deleted"), "b");
});
test("a confirmed applicant leaves the Needs screening view before next selection", () => {
  const ids = ["a", "b", "c"];
  const decisions = new Map([
    ["a", "eligible" as const],
    ["b", "needs_clarification" as const],
  ]);
  const remaining = ids.filter((id) =>
    matchesGrantQueueSearch(item(id), { eligibility: "not_reviewed" }, decisions.get(id), true),
  );
  assert.deepEqual(remaining, ["c"]);
  assert.equal(nextScreeningApplication(ids, remaining, "a"), "c");
});
