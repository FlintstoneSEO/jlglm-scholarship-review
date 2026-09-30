import { getGrantFundingRecommendation } from "./grant-funding-recommendation.ts";

export type RankingApplication = {
  id: string;
  applicant_name: string;
  business_name: string | null;
};
export type RankingAssignment = { id: string; application_id: string; lifecycle: string };
export type RankingReview = {
  id: string;
  assignment_id: string;
  status: string;
  rubric_version_id: string | null;
  version: number;
};
export type RankingCriterion = {
  id: string;
  rubric_version_id: string;
  maximum_points: number;
  active: boolean;
};
export type RankingScore = { review_id: string; criterion_id: string; points: number };
export type RankingEligibility = { application_id: string; id: string; status: string };
export type RankingOverride = {
  eligibility_review_id: string;
  event_number: number;
  scoring_allowed: boolean;
};
export type RankingCertification = { program_review_id: string; review_version: number };

export type GrantRankingRow = {
  applicationId: string;
  businessName: string;
  applicantName: string;
  assignedReviewCount: number;
  completedReviewCount: number;
  outstandingReviewCount: number;
  completedScores: number[];
  averageScore: number | null;
  minimumScore: number | null;
  maximumScore: number | null;
  scoreRange: number | null;
  reviewComplete: boolean;
  eligibilityStatus: string;
  eligibilityException: boolean;
  averageScoreTier: ReturnType<typeof getGrantFundingRecommendation>;
  rank: number | null;
  state:
    | "ranked"
    | "pending_reviews"
    | "eligibility_unresolved"
    | "score_unavailable"
    | "no_assignments";
  invalidReviewCount: number;
  scoreIssue: string | null;
  certifiedReviewCount: number;
  uncertifiedReviewCount: number;
};

export function buildGrantRankingSummary(input: {
  applications: readonly RankingApplication[];
  assignments: readonly RankingAssignment[];
  reviews: readonly RankingReview[];
  criteria: readonly RankingCriterion[];
  scores: readonly RankingScore[];
  eligibility: readonly RankingEligibility[];
  overrides: readonly RankingOverride[];
  certifications: readonly RankingCertification[];
}): GrantRankingRow[] {
  const reviews = new Map(input.reviews.map((review) => [review.assignment_id, review]));
  const eligibility = new Map(input.eligibility.map((row) => [row.application_id, row]));
  const criteria = new Map<string, RankingCriterion[]>();
  for (const criterion of input.criteria) {
    if (!criterion.active) continue;
    const group = criteria.get(criterion.rubric_version_id) ?? [];
    group.push(criterion);
    criteria.set(criterion.rubric_version_id, group);
  }
  const scores = new Map<string, RankingScore[]>();
  for (const score of input.scores) {
    const group = scores.get(score.review_id) ?? [];
    group.push(score);
    scores.set(score.review_id, group);
  }
  const latestOverride = new Map<string, RankingOverride>();
  for (const override of input.overrides) {
    const current = latestOverride.get(override.eligibility_review_id);
    if (!current || override.event_number > current.event_number)
      latestOverride.set(override.eligibility_review_id, override);
  }
  const certified = new Set(
    input.certifications.map((row) => `${row.program_review_id}:${row.review_version}`),
  );
  const assignments = new Map<string, RankingAssignment[]>();
  for (const assignment of input.assignments) {
    if (assignment.lifecycle !== "active") continue;
    const group = assignments.get(assignment.application_id) ?? [];
    group.push(assignment);
    assignments.set(assignment.application_id, group);
  }

  const rows: GrantRankingRow[] = input.applications.map((application) => {
    const active = assignments.get(application.id) ?? [];
    const completed = active
      .map((assignment) => reviews.get(assignment.id))
      .filter((review): review is RankingReview => !!review && review.status === "completed");
    const completedScores: number[] = [];
    let invalidReviewCount = 0;
    let scoreIssue: string | null = null;
    let certifiedReviewCount = 0;
    for (const review of completed) {
      if (certified.has(`${review.id}:${review.version}`)) certifiedReviewCount++;
      const versionCriteria = review.rubric_version_id
        ? (criteria.get(review.rubric_version_id) ?? [])
        : [];
      const maximum = versionCriteria.reduce((sum, criterion) => sum + criterion.maximum_points, 0);
      const reviewScores = scores.get(review.id) ?? [];
      const byCriterion = new Map(reviewScores.map((score) => [score.criterion_id, score.points]));
      const valid =
        versionCriteria.length > 0 &&
        Math.abs(maximum - 100) < 0.000001 &&
        reviewScores.length === versionCriteria.length &&
        byCriterion.size === versionCriteria.length &&
        versionCriteria.every((criterion) => {
          const points = byCriterion.get(criterion.id);
          return (
            points !== undefined &&
            Number.isFinite(points) &&
            points >= 0 &&
            points <= criterion.maximum_points
          );
        });
      // Persisted scores have two decimal places. Sum integer cents so ties do not
      // depend on criterion row order or floating-point addition order.
      if (valid)
        completedScores.push(
          versionCriteria.reduce(
            (sum, criterion) => sum + Math.round(byCriterion.get(criterion.id)! * 100),
            0,
          ) / 100,
        );
      else {
        invalidReviewCount++;
        const issue =
          Math.abs(maximum - 100) >= 0.000001 && versionCriteria.length
            ? "Historical review used a non-100-point rubric."
            : "Completed review has missing or invalid rubric scores.";
        if (!scoreIssue || issue.startsWith("Historical")) scoreIssue = issue;
      }
    }
    const eligibilityRow = eligibility.get(application.id);
    const eligibilityStatus = eligibilityRow?.status ?? "not_reviewed";
    const eligibilityException =
      eligibilityStatus !== "eligible" &&
      !!(eligibilityRow && latestOverride.get(eligibilityRow.id)?.scoring_allowed);
    const reviewComplete = active.length > 0 && completed.length === active.length;
    // A bad submitted review makes the displayed average unavailable rather than silently averaging a subset.
    const averageScore =
      invalidReviewCount || !completedScores.length
        ? null
        : completedScores.reduce((sum, score) => sum + Math.round(score * 100), 0) /
          (100 * completedScores.length);
    const minimumScore = averageScore === null ? null : Math.min(...completedScores);
    const maximumScore = averageScore === null ? null : Math.max(...completedScores);
    const state =
      active.length === 0
        ? "no_assignments"
        : invalidReviewCount
          ? "score_unavailable"
          : !reviewComplete
            ? "pending_reviews"
            : eligibilityStatus !== "eligible" && !eligibilityException
              ? "eligibility_unresolved"
              : "ranked";
    return {
      applicationId: application.id,
      businessName: application.business_name?.trim() || application.applicant_name,
      applicantName: application.applicant_name,
      assignedReviewCount: active.length,
      completedReviewCount: completed.length,
      outstandingReviewCount: active.length - completed.length,
      completedScores,
      averageScore,
      minimumScore,
      maximumScore,
      scoreRange:
        minimumScore === null || maximumScore === null ? null : maximumScore - minimumScore,
      reviewComplete,
      eligibilityStatus,
      eligibilityException,
      averageScoreTier:
        state === "ranked" && averageScore !== null
          ? getGrantFundingRecommendation(averageScore)
          : null,
      rank: null,
      state,
      invalidReviewCount,
      scoreIssue,
      certifiedReviewCount,
      uncertifiedReviewCount: completed.length - certifiedReviewCount,
    };
  });
  const group = (row: GrantRankingRow) =>
    row.state === "ranked" ? 0 : row.state === "pending_reviews" ? 1 : 2;
  rows.sort(
    (a, b) =>
      group(a) - group(b) ||
      (group(a) === 0 ? b.averageScore! - a.averageScore! : 0) ||
      (group(a) === 1
        ? b.completedReviewCount / b.assignedReviewCount -
          a.completedReviewCount / a.assignedReviewCount
        : 0) ||
      a.businessName.localeCompare(b.businessName) ||
      a.applicationId.localeCompare(b.applicationId),
  );
  let previousAverage: number | null = null;
  rows.forEach((row, index) => {
    if (row.state !== "ranked") return;
    if (previousAverage === null || row.averageScore !== previousAverage) row.rank = index + 1;
    else row.rank = rows[index - 1].rank;
    previousAverage = row.averageScore;
  });
  return rows;
}
