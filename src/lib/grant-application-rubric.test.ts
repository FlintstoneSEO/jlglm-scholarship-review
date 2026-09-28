import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  criterionForGrantSection,
  grantApplicationRubric,
  grantScoreDraft,
  grantScoreEntries,
  validGrantScore,
} from "./grant-application-rubric.ts";
import { grantRubricGuidance } from "./grant-rubric-guidance.ts";

const route = readFileSync(new URL("../routes/_app.grants.$id.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260927232500_grant_unscored_draft_scores.sql",
    import.meta.url,
  ),
  "utf8",
);

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
  assert.match(
    route,
    /disabled=\{!canReview \|\| !scoringAllowed \|\| review\?\.status === "completed"\}/,
  );
  assert.match(
    migration,
    /delete from public\.review_scores rs where rs\.review_id=review\.id and not \(rs\.criterion_id=any\(supplied_ids\)\)/,
  );
  assert.match(migration, /private\.claim_review_idempotency/);
  assert.match(migration, /Final submission requires every active criterion exactly once/);
});
