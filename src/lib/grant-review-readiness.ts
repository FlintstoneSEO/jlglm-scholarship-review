import type { grantReviewSummary } from "./grant-application-rubric";
import { grantFundingRecommendationState } from "./grant-funding-recommendation.ts";

type Summary = ReturnType<typeof grantReviewSummary>;

export function grantReadinessDisplay({
  summary,
  scoringAllowed,
  exception,
  assigned,
  submitted,
  hasRubricVersion,
  canSubmit,
  certified,
}: {
  summary: Summary;
  scoringAllowed: boolean;
  exception: boolean;
  assigned: boolean;
  submitted: boolean;
  hasRubricVersion: boolean;
  canSubmit: boolean;
  certified: boolean;
}) {
  const fundingStatus = grantFundingRecommendationState(summary).status;
  const rows = [
    {
      satisfied: scoringAllowed,
      label: scoringAllowed
        ? exception
          ? "Administrator exception active"
          : "Eligibility cleared"
        : "Eligibility not cleared",
    },
    {
      satisfied: summary.totalCriteria > 0 && summary.completedCriteria === summary.totalCriteria,
      label: `${summary.completedCriteria} of ${summary.totalCriteria} criteria scored`,
    },
    {
      satisfied: summary.scoresValid,
      label: summary.scoresValid ? "Scores valid" : "Scores need correction",
    },
    {
      satisfied: assigned,
      label: assigned ? "Active assignment" : "Active assignment required",
    },
    {
      satisfied: fundingStatus === "available",
      label:
        fundingStatus === "available"
          ? "Recommendation calculated"
          : fundingStatus === "unavailable"
            ? "Recommendation unavailable: rubric must total 100 points"
            : "Recommendation pending",
    },
    {
      satisfied: certified,
      label: certified ? "Reviewer certified" : "Reviewer certification required",
    },
  ];

  const message = submitted
    ? "Review submitted."
    : !hasRubricVersion || summary.totalCriteria === 0
      ? "An active, populated rubric is required before submitting."
      : !scoringAllowed
        ? "Competitive scoring is locked."
        : !assigned
          ? "An active reviewer assignment is required."
          : !summary.scoresValid
            ? "Correct the scores before submitting."
            : fundingStatus !== "available"
              ? fundingStatus === "unavailable"
                ? "A 100-point rubric is required before submitting."
                : "Complete the remaining criteria before submitting."
              : !certified
                ? "Complete reviewer certification before submitting."
                : canSubmit
                  ? "Ready to submit."
                  : "Complete the remaining criteria before submitting.";

  return { rows, message };
}
