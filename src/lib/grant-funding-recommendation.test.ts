import assert from "node:assert/strict";
import test from "node:test";
import { grantReviewSummary } from "./grant-application-rubric.ts";
import {
  getGrantFundingRecommendation,
  grantFundingRecommendationState,
} from "./grant-funding-recommendation.ts";

const criteria = [15, 15, 15, 20, 15, 10, 10].map((maximum_points, index) => ({
  id: String(index),
  name: `Criterion ${index + 1}`,
  maximum_points,
}));

function summary(score: number, rubric = criteria) {
  return grantReviewSummary(rubric, {
    "0": Math.min(score, rubric[0].maximum_points),
    "1": Math.min(Math.max(score - 15, 0), rubric[1].maximum_points),
    "2": Math.min(Math.max(score - 30, 0), rubric[2].maximum_points),
    "3": Math.min(Math.max(score - 45, 0), rubric[3].maximum_points),
    "4": Math.min(Math.max(score - 65, 0), rubric[4].maximum_points),
    "5": Math.min(Math.max(score - 80, 0), rubric[5].maximum_points),
    "6": Math.min(Math.max(score - 90, 0), rubric[6].maximum_points),
  });
}

test("approved numeric boundaries and decimals retain five tiers and four recommendation labels", () => {
  const cases = [
    [0, "Weak", "Do Not Recommend"],
    [1, "Weak", "Do Not Recommend"],
    [59, "Weak", "Do Not Recommend"],
    [59.5, "Weak", "Do Not Recommend"],
    [60, "Marginal", "Consider"],
    [69, "Marginal", "Consider"],
    [69.5, "Marginal", "Consider"],
    [70, "Competitive", "Consider"],
    [79, "Competitive", "Consider"],
    [79.5, "Competitive", "Consider"],
    [80, "Very Strong", "Recommend"],
    [89, "Very Strong", "Recommend"],
    [89.5, "Very Strong", "Recommend"],
    [90, "Exceptional", "Strongly Recommend"],
    [99, "Exceptional", "Strongly Recommend"],
    [100, "Exceptional", "Strongly Recommend"],
  ] as const;
  for (const [score, tier, recommendation] of cases) {
    assert.equal(getGrantFundingRecommendation(score)?.tier, tier);
    assert.equal(getGrantFundingRecommendation(score)?.recommendation, recommendation);
  }
  assert.equal(
    getGrantFundingRecommendation(64)?.guidance,
    "Consider only if funding remains available.",
  );
  assert.notEqual(getGrantFundingRecommendation(64)?.tier, getGrantFundingRecommendation(74)?.tier);
});

test("invalid totals have no recommendation", () => {
  for (const value of [-1, 100.01, Number.NaN, Infinity, -Infinity])
    assert.equal(getGrantFundingRecommendation(value), null);
});

test("incomplete, invalid, and non-100-point reviews never show a recommendation", () => {
  const partial = grantReviewSummary(criteria, { "0": 15 });
  assert.deepEqual(grantFundingRecommendationState(partial), {
    status: "pending",
    recommendation: null,
  });
  const invalid = grantReviewSummary(
    criteria,
    Object.fromEntries(criteria.map(({ id }) => [id, 0])),
  );
  const invalidScores = grantReviewSummary(criteria, {
    ...Object.fromEntries(criteria.map(({ id }) => [id, 0])),
    "0": 16,
  });
  assert.equal(grantFundingRecommendationState(invalidScores).status, "pending");
  assert.equal(grantFundingRecommendationState(invalid).status, "available");
  assert.equal(grantFundingRecommendationState(invalid).recommendation?.tier, "Weak");
  const misconfigured = criteria.map((item) => ({
    ...item,
    maximum_points: item.maximum_points + (item.id === "0" ? 1 : 0),
  }));
  assert.deepEqual(grantFundingRecommendationState(summary(100, misconfigured)), {
    status: "unavailable",
    recommendation: null,
  });
  assert.equal(grantFundingRecommendationState(summary(100)).recommendation?.tier, "Exceptional");
});

test("submitted scores derive the same read-only recommendation as a complete draft", () => {
  const completedScore = summary(94);
  const draft = grantFundingRecommendationState(completedScore);
  const submitted = grantFundingRecommendationState(completedScore);
  assert.deepEqual(submitted, draft);
  assert.equal(submitted.recommendation?.recommendation, "Strongly Recommend");
});
