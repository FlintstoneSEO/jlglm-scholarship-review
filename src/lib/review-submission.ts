export type ReviewProgram = "scholarship" | "business_growth_grant";
export type ReviewSubmissionIntent = "save_draft" | "submit";
export type ScholarshipRecommendation =
  | "strongly_recommend"
  | "recommend"
  | "consider"
  | "needs_discussion"
  | "do_not_recommend";

export type CriterionSubmission = {
  criterionId: string;
  value: number;
};

export type ReviewSubmissionInput = {
  intent: ReviewSubmissionIntent;
  program: ReviewProgram;
  applicationId: string;
  assignmentId: string;
  reviewId?: string;
  currentVersion?: number;
  rubricVersion?: string;
  criteria: CriterionSubmission[];
  comments?: string;
  recommendation?: ScholarshipRecommendation;
  certificationVersion?: string;
  certified?: boolean;
  idempotencyKey: string;
};

export type ReviewSubmissionResult = {
  reviewId: string;
  status: "in_progress" | "submitted";
  savedAt: string;
  submittedAt: string | null;
  version: number;
  replayed: boolean;
};

export type ReviewSubmissionErrorCode =
  | "validation"
  | "authorization"
  | "conflict"
  | "stale_version"
  | "stale_rubric"
  | "already_submitted"
  | "unavailable"
  | "eligibility_locked"
  | "conflict_declaration_required"
  | "conflict_hold"
  | "practice_ended"
  | "certification_required"
  | "transaction_failure";

export class ReviewSubmissionError extends Error {
  readonly code: ReviewSubmissionErrorCode;
  readonly fieldErrors?: Record<string, string>;
  readonly currentVersion?: number;

  constructor(
    code: ReviewSubmissionErrorCode,
    message: string,
    options: { fieldErrors?: Record<string, string>; currentVersion?: number } = {},
  ) {
    super(message);
    this.name = "ReviewSubmissionError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.currentVersion = options.currentVersion;
  }
}

export interface ReviewWriteAdapter {
  saveDraft(input: ReviewSubmissionInput): Promise<ReviewSubmissionResult>;
  submit(input: ReviewSubmissionInput): Promise<ReviewSubmissionResult>;
}

export function createIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const knownCodes: ReviewSubmissionErrorCode[] = [
  "validation",
  "authorization",
  "conflict",
  "stale_version",
  "stale_rubric",
  "already_submitted",
  "unavailable",
  "eligibility_locked",
  "conflict_declaration_required",
  "conflict_hold",
  "practice_ended",
  "certification_required",
  "transaction_failure",
];

/** Database functions prefix stable machine codes as `review_submission:<code>:`. */
export function normalizeReviewSubmissionError(error: unknown): ReviewSubmissionError {
  if (error instanceof ReviewSubmissionError) return error;
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
  const code = knownCodes.find((candidate) => message.includes(`review_submission:${candidate}:`));
  return new ReviewSubmissionError(code ?? "transaction_failure", message);
}

export function parseReviewSubmissionResult(value: unknown): ReviewSubmissionResult {
  if (!value || typeof value !== "object")
    throw new ReviewSubmissionError("transaction_failure", "The submission returned no result.");
  const row = value as Record<string, unknown>;
  const reviewId = row.reviewId ?? row.review_id;
  const savedAt = row.savedAt ?? row.saved_at;
  const submittedAt = row.submittedAt ?? row.submitted_at;
  if (
    typeof reviewId !== "string" ||
    typeof savedAt !== "string" ||
    typeof row.version !== "number"
  )
    throw new ReviewSubmissionError(
      "transaction_failure",
      "The submission returned an invalid result.",
    );
  return {
    reviewId,
    status: row.status === "submitted" ? "submitted" : "in_progress",
    savedAt,
    submittedAt: typeof submittedAt === "string" ? submittedAt : null,
    version: row.version,
    replayed: row.replayed === true,
  };
}
