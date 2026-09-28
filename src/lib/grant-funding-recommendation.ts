import type { grantReviewSummary } from "./grant-application-rubric";

export const grantFundingBands = [
  {
    minimumScore: 90,
    rangeLabel: "90–100",
    tier: "Exceptional",
    recommendation: "Strongly Recommend",
    guidance: null,
  },
  {
    minimumScore: 80,
    rangeLabel: "80–89",
    tier: "Very Strong",
    recommendation: "Recommend",
    guidance: null,
  },
  {
    minimumScore: 70,
    rangeLabel: "70–79",
    tier: "Competitive",
    recommendation: "Consider",
    guidance: null,
  },
  {
    minimumScore: 60,
    rangeLabel: "60–69",
    tier: "Marginal",
    recommendation: "Consider",
    guidance: "Consider only if funding remains available.",
  },
  {
    minimumScore: 0,
    rangeLabel: "Below 60",
    tier: "Weak",
    recommendation: "Do Not Recommend",
    guidance: null,
  },
] as const;

export function getGrantFundingRecommendation(score: number) {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return grantFundingBands.find((band) => score >= band.minimumScore) ?? null;
}

export function grantFundingRecommendationState(summary: ReturnType<typeof grantReviewSummary>) {
  if (summary.maximumScore !== 100) return { status: "unavailable" as const, recommendation: null };
  if (!summary.complete || !summary.scoresValid)
    return { status: "pending" as const, recommendation: null };
  const recommendation = getGrantFundingRecommendation(summary.currentScore);
  return recommendation
    ? { status: "available" as const, recommendation }
    : { status: "unavailable" as const, recommendation: null };
}
