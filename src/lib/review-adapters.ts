import {
  capabilityProjection,
  combinedReadState,
  type ReadSource,
  type ReviewDocument,
  type ReviewProgress,
  type ReviewScoreDisplay,
  type ReviewStatus,
  type ReviewWorkspaceData,
} from "./review-domain.ts";

export type ScholarshipApplicant = {
  id: string;
  application_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  review_status: string;
  preliminary_screening_status: string;
  total_score: number | null;
  essay_url: string | null;
  transcript_url: string | null;
  updated_at?: string;
  is_finalist?: boolean | null;
  is_selected?: boolean | null;
};
export type ScholarshipReview = {
  id: string;
  applicant_id: string;
  reviewer_id: string;
  writing_score: number | null;
  rhetoric_score: number | null;
  is_complete: boolean;
  created_at?: string;
  updated_at?: string;
};
export type Assignment = { id: string; application_id: string; reviewer_id: string };
export type DiscussionDocument = {
  id: string;
  file_name: string;
  storage_path: string;
  created_at?: string;
};
export type GrantApplication = {
  id: string;
  program_id: string;
  applicant_name: string;
  applicant_email: string | null;
  review_status: string;
  completed_review_count: number;
  average_score: number;
  updated_at?: string;
};
export type GrantDetail = Record<string, unknown> & {
  business_name: string;
  raw_response?: unknown;
  updated_at?: string;
};
export type GrantCriterion = {
  id: string;
  name: string;
  description: string | null;
  maximum_points: number;
  display_order?: number;
};
export type GrantReview = {
  id: string;
  application_id: string;
  reviewer_id: string;
  assignment_id: string;
  status: string;
  total_score: number;
  submitted_at?: string | null;
  updated_at?: string;
};
export type GrantScore = { id: string; review_id: string; criterion_id: string; points: number };
export type GrantDocument = {
  id: string;
  label: string;
  document_type: string | null;
  external_url: string | null;
  storage_path: string | null;
  content_type?: string | null;
};

const stateOf = (value: string | null | undefined): ReviewStatus => {
  if (value === "not_started") return { value: "not_started", nativeValue: value };
  if (value === "in_progress") return { value: "in_progress", nativeValue: value };
  if (value === "completed" || value === "reviewed")
    return { value: "submitted", nativeValue: value };
  return {
    value: "unavailable",
    nativeValue: value ?? null,
    reason: "Native status is missing or unrecognized.",
  };
};
const sourceState = <T>(name: string, source: ReadSource<T>) => ({
  name,
  loadedAt: source.loadedAt ?? null,
  state: source.state,
});
const missingData = <T>(source: ReadSource<T>) => source.data === null;

export type ScholarshipReadInput = {
  applicant: ReadSource<ScholarshipApplicant>;
  reviews: ReadSource<ScholarshipReview[]>;
  assignments: ReadSource<Assignment[]>;
  linkedApplication?: ReadSource<{ id: string; review_status: string; updated_at?: string }>;
  discussionDocuments?: ReadSource<DiscussionDocument[]>;
  now?: string;
};
export function ScholarshipReviewAdapter(
  input: ScholarshipReadInput,
): ReviewWorkspaceData<ScholarshipApplicant | null> {
  const a = input.applicant.data;
  const reviews = input.reviews.data ?? [];
  const assignments = input.assignments.data ?? [];
  const anomalies: string[] = [];
  if (a && !a.application_id)
    anomalies.push("scholarship_applicant_missing_portal_application_link");
  const pairs = new Map<string, number>();
  for (const review of reviews)
    pairs.set(review.reviewer_id, (pairs.get(review.reviewer_id) ?? 0) + 1);
  for (const [reviewerId, count] of pairs)
    if (count > 1) anomalies.push(`duplicate_scholarship_review:${reviewerId}:${count}`);
  const completed = reviews.filter((review) => review.is_complete);
  const assignedIds = new Set(assignments.map((assignment) => assignment.reviewer_id));
  if (assignments.length !== 5)
    anomalies.push(`scholarship_assignment_count_mismatch:${assignments.length}:expected:5`);
  if (completed.length > 5)
    anomalies.push(`scholarship_completed_reviews_exceed_expected:${completed.length}:expected:5`);
  for (const review of reviews)
    if (!assignedIds.has(review.reviewer_id))
      anomalies.push(`scholarship_review_without_assignment:${review.reviewer_id}`);
  const nativeStatus = a?.review_status ?? null;
  if (a && completed.length >= 5 && nativeStatus !== "reviewed")
    anomalies.push(`scholarship_application_status_disagreement:${nativeStatus}:expected:reviewed`);
  if (a && completed.length < 5 && nativeStatus === "reviewed")
    anomalies.push(
      "scholarship_application_status_disagreement:reviewed:completed_reviews_below_five",
    );
  const latest = input.linkedApplication?.data?.review_status;
  if (latest && a && (nativeStatus === "reviewed") !== (latest === "completed"))
    anomalies.push(`scholarship_portal_status_disagreement:${latest}:${nativeStatus}`);
  const assignedCount = assignments.length;
  const startedCount = reviews.filter((review) => !review.is_complete).length + completed.length;
  const progress: ReviewProgress = {
    state: [input.reviews, input.assignments].some(
      (s) => s.state === "error" || s.state === "partial_error",
    )
      ? "partial"
      : a
        ? "known"
        : "pending",
    assignedReviewers: input.assignments.data ? assignedCount : null,
    startedReviews: input.reviews.data ? startedCount : null,
    completedReviews: input.reviews.data ? completed.length : null,
    remainingReviews: input.reviews.data ? Math.max(0, 5 - completed.length) : null,
    denominator: { kind: "fixed", value: 5 },
    anomalies,
  };
  const score: ReviewScoreDisplay = {
    criteria: [
      { id: "writing", name: "Writing", description: null, maximum: 9, score: null },
      { id: "rhetoric", name: "Rhetoric", description: null, maximum: 9, score: null },
    ],
    reviewerTotal: null,
    reviewerMaximum: 18,
    applicationAggregate: completed.reduce(
      (sum, review) => sum + (review.writing_score ?? 0) + (review.rhetoric_score ?? 0),
      0,
    ),
    applicationMaximum: 90,
    aggregation: "completed_sum",
    state: input.reviews.data ? "ready" : input.reviews.state === "error" ? "pending" : "partial",
  };
  const documents: ReviewDocument[] = [];
  if (a?.essay_url)
    documents.push({
      id: "essay",
      label: "Essay",
      kind: "essay",
      source: "scholarship_original",
      url: a.essay_url,
      storagePath: null,
    });
  if (a?.transcript_url)
    documents.push({
      id: "transcript",
      label: "Transcript",
      kind: "transcript",
      source: "scholarship_original",
      url: a.transcript_url,
      storagePath: null,
    });
  for (const doc of input.discussionDocuments?.data ?? [])
    documents.push({
      id: doc.id,
      label: doc.file_name,
      kind: "discussion",
      source: "discussion_copy",
      url: null,
      storagePath: doc.storage_path,
    });
  const sources = [
    sourceState("applicant", input.applicant),
    sourceState("legacy_reviews", input.reviews),
    sourceState("reviewer_assignments", input.assignments),
  ];
  if (input.linkedApplication)
    sources.push(sourceState("portal_application", input.linkedApplication));
  if (input.discussionDocuments)
    sources.push(sourceState("discussion_documents", input.discussionDocuments));
  if (missingData(input.applicant) && input.applicant.state !== "loading")
    anomalies.push("scholarship_application_record_unavailable");
  return {
    program: "scholarship",
    applicationId: a?.application_id ?? a?.id ?? "",
    application: a,
    details: a
      ? {
          screening: a.preliminary_screening_status,
          isFinalist: a.is_finalist ?? null,
          isSelected: a.is_selected ?? null,
        }
      : null,
    status: stateOf(nativeStatus),
    progress,
    score,
    documents,
    capabilities: capabilityProjection(true),
    navigation: {
      queuePath: "/applicants",
      applicationPath: `/applicants/${a?.id ?? ""}`,
      sections: ["application", "documents", "rubric", "notes", "contact", "discussion"],
      returnTo: "/applicants",
    },
    state: combinedReadState([
      input.applicant,
      input.reviews,
      input.assignments,
      ...(input.linkedApplication ? [input.linkedApplication] : []),
      ...(input.discussionDocuments ? [input.discussionDocuments] : []),
    ]),
    sources: sources.map((s) => ({ ...s, loadedAt: s.loadedAt ?? input.now ?? null })),
    anomalies,
  };
}

export type GrantReadInput = {
  application: ReadSource<GrantApplication>;
  details: ReadSource<GrantDetail>;
  assignments: ReadSource<Assignment[]>;
  criteria: ReadSource<GrantCriterion[]>;
  reviews: ReadSource<GrantReview[]>;
  scores: ReadSource<GrantScore[]>;
  documents: ReadSource<GrantDocument[]>;
  reviewerId?: string;
  now?: string;
};
export function BusinessGrantReviewAdapter(
  input: GrantReadInput,
): ReviewWorkspaceData<GrantApplication | null, GrantDetail | null> {
  const app = input.application.data;
  const details = input.details.data;
  const assignments = input.assignments.data ?? [];
  const reviews = input.reviews.data ?? [];
  const criteria = input.criteria.data ?? [];
  const scores = input.scores.data ?? [];
  const anomalies: string[] = [];
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const reviewIds = new Set(reviews.map((review) => review.id));
  for (const review of reviews)
    if (!assignmentIds.has(review.assignment_id))
      anomalies.push(`grant_review_without_assignment:${review.id}`);
  for (const score of scores) {
    if (!reviewIds.has(score.review_id)) anomalies.push(`grant_score_without_review:${score.id}`);
    if (!criteria.some((criterion) => criterion.id === score.criterion_id))
      anomalies.push(`grant_score_without_criterion:${score.id}`);
  }
  if (assignments.length === 0) anomalies.push("grant_zero_assigned_reviewers");
  const done = reviews.filter((review) => review.status === "completed");
  const total = (reviewId: string) =>
    scores
      .filter((score) => score.review_id === reviewId)
      .reduce((sum, score) => sum + score.points, 0);
  for (const review of reviews)
    if (input.scores.data && Math.abs(total(review.id) - review.total_score) > 0.01)
      anomalies.push(`grant_review_score_total_disagreement:${review.id}`);
  const criterionMaximum = criteria.reduce((sum, criterion) => sum + criterion.maximum_points, 0);
  const progress: ReviewProgress = {
    state:
      input.reviews.data && input.assignments.data
        ? "known"
        : [input.reviews, input.assignments].some(
              (s) => s.state === "error" || s.state === "partial_error",
            )
          ? "partial"
          : "pending",
    assignedReviewers: input.assignments.data ? assignments.length : null,
    startedReviews: input.reviews.data
      ? reviews.filter((review) => review.status !== "not_started").length
      : null,
    completedReviews: input.reviews.data ? done.length : null,
    remainingReviews:
      input.reviews.data && input.assignments.data
        ? Math.max(0, assignments.length - done.length)
        : null,
    denominator: { kind: "assigned", value: input.assignments.data ? assignments.length : null },
    anomalies,
  };
  const mine = input.reviewerId
    ? reviews.find((review) => review.reviewer_id === input.reviewerId)
    : undefined;
  const ownScores = mine ? scores.filter((score) => score.review_id === mine.id) : [];
  const score: ReviewScoreDisplay = {
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      description: criterion.description,
      maximum: criterion.maximum_points,
      score: mine ? (ownScores.find((s) => s.criterion_id === criterion.id)?.points ?? null) : null,
    })),
    reviewerTotal: mine ? mine.total_score : null,
    reviewerMaximum: criterionMaximum,
    applicationAggregate: done.length
      ? done.reduce((sum, review) => sum + review.total_score, 0) / done.length
      : 0,
    applicationMaximum: criterionMaximum,
    aggregation: "completed_average",
    state: input.criteria.data && input.reviews.data && input.scores.data ? "ready" : "partial",
  };
  const documents: ReviewDocument[] = (input.documents.data ?? []).map((doc) => ({
    id: doc.id,
    label: doc.label,
    kind: doc.document_type ?? "supporting_document",
    source: doc.storage_path ? "private_storage" : "external",
    url: doc.external_url,
    storagePath: doc.storage_path,
    contentType: doc.content_type,
  }));
  const sources = [
    sourceState("application", input.application),
    sourceState("details", input.details),
    sourceState("assignments", input.assignments),
    sourceState("criteria", input.criteria),
    sourceState("reviews", input.reviews),
    sourceState("scores", input.scores),
    sourceState("documents", input.documents),
  ];
  const secondary = [
    input.assignments,
    input.criteria,
    input.reviews,
    input.scores,
    input.documents,
  ];
  return {
    program: "business_growth_grant",
    applicationId: app?.id ?? "",
    application: app,
    details,
    status: stateOf(app?.review_status),
    progress,
    score,
    documents,
    capabilities: capabilityProjection(true),
    navigation: {
      queuePath: "/grants",
      applicationPath: `/grants/${app?.id ?? ""}`,
      sections: ["application", "documents", "rubric", "comments"],
      returnTo: "/grants",
    },
    state: combinedReadState([input.application, input.details, ...secondary]),
    sources: sources.map((s) => ({ ...s, loadedAt: s.loadedAt ?? input.now ?? null })),
    anomalies,
  };
}
