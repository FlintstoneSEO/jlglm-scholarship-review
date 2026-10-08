import assert from "node:assert/strict";
import test from "node:test";
import { grantReviewActionState, grantReviewSummary } from "./grant-application-rubric.ts";
import { grantReadinessDisplay } from "./grant-review-readiness.ts";

const criteria = [15, 15, 15, 20, 15, 10, 10].map((maximum_points, index) => ({
  id: String(index),
  name: `Criterion ${index + 1}`,
  maximum_points,
}));
const full = Object.fromEntries(criteria.map(({ id }) => [id, 0]));

function display({
  scores = full,
  scoringAllowed = true,
  exception = false,
  assigned = true,
  submitted = false,
  hasRubricVersion = true,
  certified = true,
}: {
  scores?: Record<string, number | null>;
  scoringAllowed?: boolean;
  exception?: boolean;
  assigned?: boolean;
  submitted?: boolean;
  hasRubricVersion?: boolean;
  certified?: boolean;
} = {}) {
  const summary = grantReviewSummary(criteria, scores);
  const { canSubmit } = grantReviewActionState({
    assigned,
    scoringAllowed,
    submitted,
    hasRubricVersion,
    summary,
  });
  return grantReadinessDisplay({
    summary,
    scoringAllowed,
    exception,
    assigned,
    submitted,
    hasRubricVersion,
    canSubmit,
    certified,
  });
}

test("ready review uses concise satisfied labels", () => {
  assert.deepEqual(display(), {
    rows: [
      { satisfied: true, label: "Eligibility cleared" },
      { satisfied: true, label: "7 of 7 criteria scored" },
      { satisfied: true, label: "Scores valid" },
      { satisfied: true, label: "Active assignment" },
      { satisfied: true, label: "Recommendation calculated" },
      { satisfied: true, label: "Reviewer certified" },
    ],
    message: "Ready to submit.",
  });
});

test("certification is the last submit requirement and zero remains a valid score", () => {
  const result = display({ certified: false });
  assert.deepEqual(result.rows[5], { satisfied: false, label: "Reviewer certification required" });
  assert.equal(result.message, "Complete reviewer certification before submitting.");
  assert.equal(display({ certified: true }).message, "Ready to submit.");
});

test("incomplete review shows its scored count and next step", () => {
  const result = display({ scores: { ...full, "5": null, "6": null } });
  assert.deepEqual(result.rows[1], { satisfied: false, label: "5 of 7 criteria scored" });
  assert.deepEqual(result.rows[4], { satisfied: false, label: "Recommendation pending" });
  assert.equal(result.message, "Complete the remaining criteria before submitting.");
});

test("eligibility lock and administrator exception have distinct labels", () => {
  const locked = display({ scoringAllowed: false });
  assert.deepEqual(locked.rows[0], { satisfied: false, label: "Eligibility not cleared" });
  assert.equal(locked.message, "Competitive scoring is locked.");
  const excepted = display({ exception: true });
  assert.deepEqual(excepted.rows[0], {
    satisfied: true,
    label: "Administrator exception active",
  });
  assert.equal(excepted.message, "Ready to submit.");
});

test("invalid score and missing assignment give specific guidance", () => {
  const invalid = display({ scores: { ...full, "0": 16 } });
  assert.deepEqual(invalid.rows[1], { satisfied: true, label: "7 of 7 criteria scored" });
  assert.deepEqual(invalid.rows[2], { satisfied: false, label: "Scores need correction" });
  assert.equal(invalid.message, "Correct the scores before submitting.");
  const unassigned = display({ assigned: false });
  assert.deepEqual(unassigned.rows[3], {
    satisfied: false,
    label: "Active assignment required",
  });
  assert.equal(unassigned.message, "An active reviewer assignment is required.");
});
