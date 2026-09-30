import assert from "node:assert/strict";
import test from "node:test";
import { grantRubricGuidance, guidanceForGrantCriterion } from "./grant-rubric-guidance.ts";

test("committee-approved Grant criteria are ordered, unique, and total 100 points", () => {
  assert.equal(grantRubricGuidance.length, 7);
  assert.equal(new Set(grantRubricGuidance.map((criterion) => criterion.name)).size, 7);
  assert.deepEqual(
    grantRubricGuidance.map((criterion) => criterion.maximum),
    [15, 15, 15, 20, 15, 10, 10],
  );
  assert.equal(
    grantRubricGuidance.reduce((total, criterion) => total + criterion.maximum, 0),
    100,
  );
});

test("each approved criterion has its own five score bands", () => {
  for (const criterion of grantRubricGuidance) {
    assert.equal(criterion.bands.length, 5, criterion.name);
    assert.equal(criterion.bands.at(-1)?.range, "0", criterion.name);
    assert.ok(
      criterion.bands.every((band) => band.guidance.length > 0),
      criterion.name,
    );
    assert.equal(guidanceForGrantCriterion(criterion.name, criterion.maximum), criterion);
    assert.equal(guidanceForGrantCriterion(criterion.name, criterion.maximum + 1), undefined);
  }
});
