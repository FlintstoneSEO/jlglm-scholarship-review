export const GRANT_REVIEWER_CERTIFICATION_VERSION = "grant_reviewer_certification_v1";

export const grantCertificationExpectations = [
  "I reviewed the application using the same criteria applied to other applicants.",
  "I did not score based on personal familiarity with or opinions about the applicant.",
  "I considered the applicant's business stage and circumstances.",
  "I evaluated the proposed use of funds rather than simply the applicant's financial need.",
  "My score reflects the information contained in the application and supporting documents.",
  "I disclosed any potential conflict of interest according to program policy.",
] as const;

export function grantDisplayRubricVersion(
  review: { status: string; rubric_version_id: string | null } | undefined,
  activeVersion: string | null,
): string | null {
  return review?.status === "completed" ? review.rubric_version_id : activeVersion;
}
