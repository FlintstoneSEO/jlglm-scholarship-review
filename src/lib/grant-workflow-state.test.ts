import test from "node:test";
import assert from "node:assert/strict";
import { hasPendingGrantWork, shouldHydrateGrantReview } from "./grant-workflow-state.ts";

test("each unsaved or saving workflow protects interrupted navigation and refresh", () => {
  const clean = {
    eligibilityDirty: false,
    reviewDirty: false,
    eligibilitySaving: false,
    reviewSaving: false,
  };
  assert.equal(hasPendingGrantWork(clean), false);
  for (const field of Object.keys(clean))
    assert.equal(hasPendingGrantWork({ ...clean, [field]: true }), true);
});
test("background refetch preserves dirty scores and their original save version", () => {
  assert.equal(shouldHydrateGrantReview("a:r:1:v", "a:r:2:v", true), false);
  assert.equal(shouldHydrateGrantReview("a:new:0:v", "a:r:1:v", true), false);
  assert.equal(shouldHydrateGrantReview("a:r:1:v", "a:r:2:v", false), true);
  assert.equal(shouldHydrateGrantReview("a:r:1:v", "b:r:1:v", true), true);
  assert.equal(shouldHydrateGrantReview("", "a:r:1:v", false), true);
  assert.equal(shouldHydrateGrantReview("a:r:1:v", "a:r:1:v", false), false);
});
