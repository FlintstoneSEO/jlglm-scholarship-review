import assert from "node:assert/strict";
import test from "node:test";
import {
  BusinessGrantReviewAdapter,
  ScholarshipReviewAdapter,
  type Assignment,
  type ScholarshipReview,
} from "./review-adapters.ts";
import { capabilityProjection, combinedReadState, type ReadSource } from "./review-domain.ts";

const src = <T>(
  data: T | null,
  state: ReadSource<T>["state"] = data === null ? "empty" : "ready",
): ReadSource<T> => ({ data, state, loadedAt: "2026-09-26T12:00:00Z" });
const applicant = {
  id: "a1",
  application_id: "pa1",
  first_name: "Ada",
  last_name: "Lovelace",
  email: null,
  review_status: "not_started",
  preliminary_screening_status: "eligible_for_review",
  total_score: 0,
  essay_url: "https://example.test/essay",
  transcript_url: null,
};
const scholarship = (
  reviews: Array<{
    id: string;
    reviewer_id: string;
    is_complete: boolean;
    writing_score: number | null;
    rhetoric_score: number | null;
  }>,
  assignments = Array.from({ length: 5 }, (_, i) => ({
    id: `as${i}`,
    application_id: "pa1",
    reviewer_id: `r${i}`,
  })),
  status = "not_started",
) =>
  ScholarshipReviewAdapter({
    applicant: src({ ...applicant, review_status: status }),
    reviews: src(reviews.map((r) => ({ applicant_id: "a1", ...r }))),
    assignments: src(assignments),
    linkedApplication: src({
      id: "pa1",
      review_status:
        status === "reviewed"
          ? "completed"
          : status === "not_started"
            ? "not_started"
            : "in_progress",
    }),
  });

test("Scholarship no review, draft and completed statuses retain legacy values", () => {
  assert.equal(scholarship([]).progress.completedReviews, 0);
  assert.equal(
    scholarship(
      [{ id: "d", reviewer_id: "r0", is_complete: false, writing_score: 4, rhetoric_score: 5 }],
      undefined,
      "in_progress",
    ).status.value,
    "in_progress",
  );
  const result = scholarship(
    [{ id: "c", reviewer_id: "r0", is_complete: true, writing_score: 8, rhetoric_score: 7 }],
    undefined,
    "in_progress",
  );
  assert.equal(result.progress.completedReviews, 1);
  assert.equal(result.score.applicationAggregate, 15);
  assert.equal(result.score.applicationMaximum, 90);
  assert.equal(result.score.reviewerMaximum, 18);
});

test("Scholarship five completed reviews, duplicate identity, assignment mismatch and status disagreement are reported", () => {
  const five = Array.from({ length: 5 }, (_, i) => ({
    id: `r${i}`,
    reviewer_id: `reviewer${i}`,
    is_complete: true,
    writing_score: 9,
    rhetoric_score: 9,
  }));
  const good = scholarship(five, undefined, "reviewed");
  assert.equal(good.score.applicationAggregate, 90);
  assert.equal(good.status.value, "submitted");
  const bad = scholarship([...five, { ...five[0], id: "duplicate" }], [], "not_started");
  assert.ok(bad.anomalies.some((x) => x.startsWith("duplicate_scholarship_review:")));
  assert.ok(bad.anomalies.includes("scholarship_assignment_count_mismatch:0:expected:5"));
  assert.ok(
    bad.anomalies.some((x) => x.startsWith("scholarship_completed_reviews_exceed_expected:")),
  );
  assert.ok(
    bad.anomalies.some((x) => x.startsWith("scholarship_application_status_disagreement:")),
  );
});

const grantInput = (overrides: Partial<Parameters<typeof BusinessGrantReviewAdapter>[0]> = {}) => {
  const assignments = [{ id: "as1", application_id: "g1", reviewer_id: "u1" }];
  const reviews = [
    {
      id: "rv1",
      application_id: "g1",
      reviewer_id: "u1",
      assignment_id: "as1",
      status: "completed",
      total_score: 8,
      submitted_at: null,
    },
  ];
  return {
    application: src({
      id: "g1",
      program_id: "p1",
      applicant_name: "Ada",
      applicant_email: null,
      review_status: "completed",
      completed_review_count: 1,
      average_score: 7,
    }),
    details: src({ business_name: "Analytical Engines" }),
    assignments: src(assignments),
    criteria: src([
      { id: "c1", name: "Impact", description: null, maximum_points: 10 },
      { id: "c2", name: "Plan", description: "Plan quality", maximum_points: 5 },
    ]),
    reviews: src(reviews),
    scores: src([{ id: "s1", review_id: "rv1", criterion_id: "c1", points: 7 }]),
    documents: src([
      {
        id: "doc1",
        label: "Statement",
        document_type: "finance",
        external_url: "https://drive.test/doc",
        storage_path: null,
      },
      {
        id: "doc2",
        label: "Private",
        document_type: "other",
        external_url: null,
        storage_path: "bucket/file",
      },
    ]),
    reviewerId: "u1",
    ...overrides,
  };
};

test("Grant assignment/no review and no assignment preserve assignment-relative denominator", () => {
  let input = grantInput({ reviews: src([]), scores: src([]) });
  let result = BusinessGrantReviewAdapter(input);
  assert.equal(result.progress.completedReviews, 0);
  assert.equal(result.progress.remainingReviews, 1);
  assert.equal(result.score.aggregation, "completed_average");
  input = grantInput({ assignments: src([]), reviews: src([]), scores: src([]) });
  result = BusinessGrantReviewAdapter(input);
  assert.equal(result.progress.denominator.value, 0);
  assert.ok(result.anomalies.includes("grant_zero_assigned_reviewers"));
});

test("Grant draft review remains in progress and excluded from completed average", () => {
  const input = grantInput({
    application: src({
      id: "g1",
      program_id: "p1",
      applicant_name: "Ada",
      applicant_email: null,
      review_status: "in_progress",
      completed_review_count: 0,
      average_score: 0,
    }),
    reviews: src([
      {
        id: "draft",
        application_id: "g1",
        reviewer_id: "u1",
        assignment_id: "as1",
        status: "in_progress",
        total_score: 3,
        submitted_at: null,
      },
    ]),
    scores: src([{ id: "draft-score", review_id: "draft", criterion_id: "c1", points: 3 }]),
  });
  const result = BusinessGrantReviewAdapter(input);
  assert.equal(result.progress.startedReviews, 1);
  assert.equal(result.progress.completedReviews, 0);
  assert.equal(result.score.applicationAggregate, 0);
  assert.equal(result.status.value, "in_progress");
});

test("Grant dynamic criteria, draft/completed rows, total, average and document provenance", () => {
  const result = BusinessGrantReviewAdapter(grantInput());
  assert.equal(result.score.criteria.length, 2);
  assert.equal(result.score.reviewerMaximum, 15);
  assert.equal(result.score.reviewerTotal, 8);
  assert.equal(result.score.applicationAggregate, 8);
  assert.equal(result.documents[0].source, "external");
  assert.equal(result.documents[1].source, "private_storage");
  assert.ok(result.anomalies.includes("grant_review_score_total_disagreement:rv1"));
});

test("failed grant secondary reads remain partial errors, never empty data", () => {
  const result = BusinessGrantReviewAdapter(
    grantInput({ documents: { data: null, state: "error", error: "read failed" } }),
  );
  assert.equal(result.state, "partial_error");
  assert.equal(result.sources.find((x) => x.name === "documents")?.state, "error");
  assert.equal(result.documents.length, 0);
});

test("shared normalized status, capability pending state and unavailable state", () => {
  const unavailable = ScholarshipReviewAdapter({
    applicant: { data: null, state: "unavailable" },
    reviews: src<ScholarshipReview[]>(null, "unavailable"),
    assignments: src<Assignment[]>(null, "unavailable"),
  });
  assert.equal(unavailable.state, "unavailable");
  assert.equal(unavailable.capabilities.canEditSubmittedReview.state, "unknown");
  assert.equal(capabilityProjection(true).canSubmitReview.state, "unknown");
  assert.equal(combinedReadState([src([1]), { data: null, state: "error" }]), "partial_error");
  assert.equal(
    combinedReadState([
      { data: null, state: "error" },
      { data: null, state: "error" },
    ]),
    "error",
  );
});

test("Scholarship missing portal link and secondary read failure are visible", () => {
  const result = ScholarshipReviewAdapter({
    applicant: src({ ...applicant, application_id: null }),
    reviews: { data: null, state: "error", error: "failed" },
    assignments: src([]),
    discussionDocuments: { data: null, state: "partial_error", error: "failed" },
  });
  assert.ok(result.anomalies.includes("scholarship_applicant_missing_portal_application_link"));
  assert.equal(result.state, "partial_error");
  assert.equal(result.progress.completedReviews, null);
  assert.ok(result.documents[0].source === "scholarship_original");
});
