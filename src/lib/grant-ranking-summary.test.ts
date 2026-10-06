import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGrantRankingSummary,
  type RankingApplication,
  type RankingAssignment,
  type RankingReview,
  type RankingCriterion,
  type RankingScore,
  type RankingEligibility,
  type RankingOverride,
  type RankingCertification,
} from "./grant-ranking-summary.ts";

test("an extreme completed and certified test review never affects ranks or award guidance", () => {
  const f = fixture();
  f.application("real-a");
  f.application("real-b");
  const a = f.review("real-a", "1", 40);
  const b = f.review("real-b", "1", 60);
  f.certifications.push(
    { program_review_id: a, review_version: 1 },
    { program_review_id: b, review_version: 1 },
  );
  const baseline = f.build();
  f.application("test-c");
  f.applications.at(-1)!.is_test = true;
  const c = f.review("test-c", "1", 100);
  f.certifications.push({ program_review_id: c, review_version: 1 });
  assert.deepEqual(f.build(), baseline);
});

function fixture() {
  const applications: RankingApplication[] = [];
  const assignments: RankingAssignment[] = [];
  const reviews: RankingReview[] = [];
  const criteria: RankingCriterion[] = [
    { id: "criterion-v1", rubric_version_id: "v1", maximum_points: 100, active: true },
  ];
  const scores: RankingScore[] = [];
  const eligibility: RankingEligibility[] = [];
  const overrides: RankingOverride[] = [];
  const certifications: RankingCertification[] = [];
  function application(id: string, status = "eligible") {
    applications.push({ id, applicant_name: `Applicant ${id}`, business_name: `Business ${id}` });
    eligibility.push({ id: `eligibility-${id}`, application_id: id, status });
  }
  function review(
    applicationId: string,
    suffix: string,
    points: number | null,
    status = "completed",
    lifecycle = "active",
    version = "v1",
  ) {
    const id = `${applicationId}-${suffix}`;
    assignments.push({ id, application_id: applicationId, lifecycle });
    reviews.push({ id, assignment_id: id, status, rubric_version_id: version, version: 1 });
    if (points !== null)
      scores.push({
        review_id: id,
        criterion_id: version === "v1" ? "criterion-v1" : `criterion-${version}`,
        points,
      });
    return id;
  }
  const build = () =>
    buildGrantRankingSummary({
      applications,
      assignments,
      reviews,
      criteria,
      scores,
      eligibility,
      overrides,
      certifications,
    });
  return {
    applications,
    assignments,
    reviews,
    criteria,
    scores,
    eligibility,
    overrides,
    certifications,
    application,
    review,
    build,
  };
}

test("drafts and reopened reviews do not affect averages or ranks; active assignments remain outstanding", () => {
  const f = fixture();
  f.application("a");
  f.review("a", "one", 90);
  f.review("a", "two", 100, "in_progress");
  const row = f.build()[0];
  assert.equal(row.averageScore, 90);
  assert.deepEqual(row.completedScores, [90]);
  assert.equal(row.completedReviewCount, 1);
  assert.equal(row.outstandingReviewCount, 1);
  assert.equal(row.reviewComplete, false);
  assert.equal(row.rank, null);
  assert.equal(row.averageScoreTier, null);
  assert.equal(row.state, "pending_reviews");
  f.reviews[1].status = "completed";
  const done = f.build()[0];
  assert.equal(done.averageScore, 95);
  assert.equal(done.minimumScore, 90);
  assert.equal(done.maximumScore, 100);
  assert.equal(done.scoreRange, 10);
  assert.equal(done.rank, 1);
  assert.equal(done.reviewComplete, true);
  assert.equal(done.averageScoreTier?.tier, "Exceptional");
});

test("zero is a scored review, while no completed review has no average", () => {
  const f = fixture();
  f.application("a");
  f.application("b");
  f.review("a", "one", 0);
  f.review("b", "one", null, "in_progress");
  const rows = f.build();
  assert.equal(rows[0].averageScore, 0);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].averageScoreTier?.tier, "Weak");
  assert.equal(rows[1].averageScore, null);
  assert.equal(rows[1].minimumScore, null);
});

test("suspended assignments do not remain outstanding or contribute historical scores", () => {
  const f = fixture();
  f.application("a");
  f.review("a", "one", 80);
  f.review("a", "old", 100, "completed", "suspended");
  const row = f.build()[0];
  assert.equal(row.assignedReviewCount, 1);
  assert.equal(row.completedReviewCount, 1);
  assert.equal(row.averageScore, 80);
  assert.equal(row.rank, 1);
});

test("unrounded averages determine order; exact ties use competition ranks without a score tie breaker", () => {
  const f = fixture();
  for (const id of ["a", "b", "c", "d"]) f.application(id);
  f.review("a", "one", 90);
  f.review("a", "two", 90.02);
  f.review("b", "one", 90);
  f.review("b", "two", 90.01);
  f.review("c", "one", 90.01);
  f.review("c", "two", 90);
  f.review("d", "one", 80);
  const rows = f.build();
  assert.deepEqual(
    rows.map((row) => [row.applicationId, row.rank]),
    [
      ["a", 1],
      ["b", 2],
      ["c", 2],
      ["d", 4],
    ],
  );
  assert.equal(rows[0].averageScore?.toFixed(1), rows[1].averageScore?.toFixed(1));
});

test("historical version criteria and scores determine the total; non-100 rubrics are flagged", () => {
  const f = fixture();
  f.application("a");
  f.application("b");
  f.criteria.push({
    id: "criterion-v2",
    rubric_version_id: "v2",
    maximum_points: 100,
    active: true,
  });
  f.criteria.push({
    id: "criterion-v3",
    rubric_version_id: "v3",
    maximum_points: 90,
    active: true,
  });
  f.review("a", "old", 85, "completed", "active", "v2");
  f.review("b", "old", 80, "completed", "active", "v3");
  const rows = f.build();
  assert.equal(rows[0].applicationId, "a");
  assert.equal(rows[0].averageScore, 85);
  assert.equal(rows[0].rank, 1);
  const bad = rows[1];
  assert.equal(bad.state, "score_unavailable");
  assert.equal(bad.averageScore, null);
  assert.equal(bad.invalidReviewCount, 1);
  assert.equal(bad.rank, null);
});

test("missing or extra submitted scores make the aggregate unavailable", () => {
  const f = fixture();
  f.application("a");
  const id = f.review("a", "one", null);
  assert.equal(f.build()[0].state, "score_unavailable");
  f.scores.push({ review_id: id, criterion_id: "criterion-v1", points: 70 });
  f.scores.push({ review_id: id, criterion_id: "unrelated", points: 5 });
  assert.equal(f.build()[0].state, "score_unavailable");
});

test("eligibility blocks ranking unless the latest exception allows scoring", () => {
  const f = fixture();
  f.application("a", "ineligible");
  f.review("a", "one", 90);
  assert.equal(f.build()[0].state, "eligibility_unresolved");
  assert.equal(f.build()[0].rank, null);
  f.overrides.push({
    eligibility_review_id: "eligibility-a",
    event_number: 1,
    scoring_allowed: true,
  });
  assert.equal(f.build()[0].eligibilityException, true);
  assert.equal(f.build()[0].rank, 1);
  f.overrides.push({
    eligibility_review_id: "eligibility-a",
    event_number: 2,
    scoring_allowed: false,
  });
  assert.equal(f.build()[0].rank, null);
});

test("only a certification for the current submitted version is counted", () => {
  const f = fixture();
  f.application("a");
  const id = f.review("a", "one", 88);
  f.certifications.push({ program_review_id: id, review_version: 0 });
  assert.equal(f.build()[0].uncertifiedReviewCount, 1);
  f.certifications.push({ program_review_id: id, review_version: 1 });
  assert.equal(f.build()[0].certifiedReviewCount, 1);
  assert.equal(f.build()[0].uncertifiedReviewCount, 0);
});

test("no active assignments never produce a numeric rank", () => {
  const f = fixture();
  f.application("a");
  const row = f.build()[0];
  assert.equal(row.state, "no_assignments");
  assert.equal(row.reviewComplete, false);
  assert.equal(row.rank, null);
  assert.equal(row.averageScore, null);
});
