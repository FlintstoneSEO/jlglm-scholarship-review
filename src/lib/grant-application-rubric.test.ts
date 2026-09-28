import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  canScoreAssignedGrant,
  criterionForGrantSection,
  grantApplicationRubric,
  grantScoreDraft,
  grantScoreEntries,
  grantReviewActionState,
  grantReviewSummary,
  validGrantScore,
} from "./grant-application-rubric.ts";
import { grantRubricGuidance } from "./grant-rubric-guidance.ts";

const route = readFileSync(new URL("../routes/_app.grants.$id.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260927235959_grant_unscored_draft_scores.sql",
    import.meta.url,
  ),
  "utf8",
);

test("assigned Grant admins and reviewers may score; inactive or viewer access cannot", () => {
  assert.equal(canScoreAssignedGrant("active", "admin"), true);
  assert.equal(canScoreAssignedGrant("active", "reviewer"), true);
  assert.equal(canScoreAssignedGrant("active", "viewer"), false);
  assert.equal(canScoreAssignedGrant("revoked", "admin"), false);
  assert.equal(canScoreAssignedGrant(undefined, "admin"), false);
  assert.match(
    route,
    /canScoreAssignedGrant\(myAssignment\?\.lifecycle, selectedProgram\?\.accessRole\)/,
  );
});

test("all seven approved criteria map to their application section by name", () => {
  const criteria = grantRubricGuidance.map((criterion) => ({ name: criterion.name }));
  assert.equal(Object.keys(grantApplicationRubric).length, 7);
  for (const [section, name] of Object.entries(grantApplicationRubric))
    assert.equal(criterionForGrantSection(section, criteria)?.name, name);
  assert.deepEqual(
    new Set(Object.values(grantApplicationRubric)),
    new Set(grantRubricGuidance.map((criterion) => criterion.name)),
  );
  assert.equal(criterionForGrantSection("Complete imported response", criteria), undefined);
});

test("summary distinguishes unscored, zero, points, and criterion progress", () => {
  const criteria = [
    { id: "a", name: "Narrative", maximum_points: 15 },
    { id: "b", name: "Growth", maximum_points: 20 },
    { id: "c", name: "Capacity", maximum_points: 10 },
  ];
  assert.deepEqual(grantReviewSummary(criteria, {}), {
    completedCriteria: 0,
    totalCriteria: 3,
    unscoredCriteria: 3,
    unscoredNames: ["Narrative", "Growth", "Capacity"],
    currentScore: 0,
    maximumScore: 45,
    completionPercent: 0,
    scoresValid: true,
    complete: false,
  });
  const partial = grantReviewSummary(criteria, { a: 0, b: 12, c: null });
  assert.equal(partial.completedCriteria, 2);
  assert.equal(partial.currentScore, 12);
  assert.equal(partial.completionPercent, 67);
  assert.deepEqual(partial.unscoredNames, ["Capacity"]);
  assert.equal(partial.complete, false);
  const full = grantReviewSummary(criteria, { a: 0, b: 12, c: 8 });
  assert.equal(full.completedCriteria, 3);
  assert.equal(full.currentScore, 20);
  assert.equal(full.completionPercent, 100);
  assert.equal(full.complete, true);
  assert.equal(grantReviewSummary(criteria, { a: 16, b: 12, c: 8 }).scoresValid, false);
});

test("seven active criteria require seven supplied scores for completion", () => {
  const criteria = [15, 15, 15, 20, 15, 10, 10].map((maximum_points, index) => ({
    id: String(index),
    name: `Criterion ${index + 1}`,
    maximum_points,
  }));
  const full = Object.fromEntries(criteria.map((criterion) => [criterion.id, 0]));
  assert.equal(grantReviewSummary(criteria, full).maximumScore, 100);
  assert.equal(grantReviewSummary(criteria, full).completedCriteria, 7);
  assert.equal(grantReviewSummary(criteria, full).complete, true);
  const partial = { ...full, "6": null };
  assert.deepEqual(grantReviewSummary(criteria, partial).unscoredNames, ["Criterion 7"]);
  assert.equal(grantReviewSummary(criteria, partial).complete, false);
});

test("draft and final action readiness honor completeness, gate, assignment, and submitted state", () => {
  const criteria = [{ id: "a", name: "Narrative", maximum_points: 15 }];
  const partial = grantReviewSummary(criteria, { a: null });
  const complete = grantReviewSummary(criteria, { a: 0 });
  const base = { assigned: true, scoringAllowed: true, submitted: false, hasRubricVersion: true };
  assert.deepEqual(grantReviewActionState({ ...base, summary: partial }), {
    canSave: true,
    canSubmit: false,
  });
  assert.deepEqual(grantReviewActionState({ ...base, summary: complete }), {
    canSave: true,
    canSubmit: true,
  });
  for (const blocked of [
    { ...base, scoringAllowed: false },
    { ...base, assigned: false },
    { ...base, submitted: true },
    { ...base, hasRubricVersion: false },
  ]) {
    assert.deepEqual(grantReviewActionState({ ...blocked, summary: complete }), {
      canSave: false,
      canSubmit: false,
    });
  }
  assert.deepEqual(grantReviewActionState({ ...base, summary: grantReviewSummary([], {}) }), {
    canSave: false,
    canSubmit: false,
  });
  // An administrator exception is already represented by the canonical scoringAllowed gate.
  assert.equal(
    grantReviewActionState({ ...base, scoringAllowed: true, summary: complete }).canSubmit,
    true,
  );
});

test("draft retains unscored, explicit zero, and partial values", () => {
  const criteria = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const draft = grantScoreDraft(criteria, [
    { criterion_id: "b", points: 0 },
    { criterion_id: "c", points: 7.25 },
  ]);
  assert.deepEqual(draft, { a: null, b: 0, c: 7.25 });
  assert.deepEqual(grantScoreEntries(criteria, draft), [
    { criterionId: "b", value: 0 },
    { criterionId: "c", value: 7.25 },
  ]);
});

test("dynamic maxima accept partial scores and reject invalid values", () => {
  assert.equal(validGrantScore(null, 15), true);
  assert.equal(validGrantScore(0, 15), true);
  assert.equal(validGrantScore(7.25, 15), true);
  assert.equal(validGrantScore(-1, 15), false);
  assert.equal(validGrantScore(15.01, 15), false);
  assert.equal(validGrantScore(11, 10), false);
  assert.equal(validGrantScore(Number.NaN, 15), false);
});

test("both views use one draft and the canonical gated save path", () => {
  assert.equal((route.match(/useState<GrantScoreDraft>/g) ?? []).length, 1);
  assert.match(route, /<ApplicationSections[\s\S]*?points=\{points\}/);
  assert.match(route, /<ReviewPanel[\s\S]*?points=\{points\}/);
  assert.match(route, /onScoreChange=\{changeScore\}/);
  assert.match(route, /criteria: grantScoreEntries\(criteria, points\)/);
  assert.match(route, /createReviewWriteAdapter\(supabase, "business_growth_grant"\)/);
  assert.match(route, /disabled=\{!canReview \|\| !scoringAllowed\}/);
  assert.match(route, /disabled=\{!canReview \|\| !scoringAllowed \|\| submitted\}/);
  assert.match(route, /submitDisabled=\{!canSubmit\}/);
  assert.match(route, /disabled=\{!canSave\}/);
  assert.match(route, /dirty=\{scoresDirty \|\| commentsDirty\}/);
  assert.match(route, /comments=\{comments\}/);
  assert.match(
    migration,
    /delete from public\.review_scores rs where rs\.review_id=review\.id and not \(rs\.criterion_id=any\(supplied_ids\)\)/,
  );
  assert.match(migration, /private\.claim_review_idempotency/);
  assert.match(migration, /Final submission requires every active criterion exactly once/);
});
