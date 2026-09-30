import assert from "node:assert/strict";
import test from "node:test";
import {
  matchesGrantEligibilityFilter,
  parseGrantEligibilityFilter,
} from "./grant-eligibility-filter.ts";

test("Grant eligibility filter accepts only stored decision states", () => {
  assert.equal(parseGrantEligibilityFilter("needs_clarification"), "needs_clarification");
  assert.equal(parseGrantEligibilityFilter("eligible"), "eligible");
  assert.equal(parseGrantEligibilityFilter("unknown"), "all");
  assert.equal(parseGrantEligibilityFilter(null), "all");
});

test("an absent eligibility decision is not reviewed, never eligible", () => {
  assert.equal(matchesGrantEligibilityFilter(undefined, "not_reviewed"), true);
  assert.equal(matchesGrantEligibilityFilter(undefined, "eligible"), false);
  assert.equal(matchesGrantEligibilityFilter(undefined, "needs_clarification"), false);
  assert.equal(matchesGrantEligibilityFilter(undefined, "all"), true);
});

test("clarification and ineligible decisions stay distinct from not reviewed", () => {
  assert.equal(matchesGrantEligibilityFilter("needs_clarification", "not_reviewed"), false);
  assert.equal(matchesGrantEligibilityFilter("needs_clarification", "needs_clarification"), true);
  assert.equal(matchesGrantEligibilityFilter("ineligible", "needs_clarification"), false);
});
