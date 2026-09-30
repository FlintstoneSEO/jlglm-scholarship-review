/** Read-only, program-neutral review contracts. Database/RLS access remains authoritative. */
export type ProgramSlug = "scholarship" | "business_growth_grant";
export type ReadState = "loading" | "ready" | "empty" | "partial_error" | "error" | "unavailable";
export type ReviewStatus = {
  value:
    | "unassigned"
    | "assigned"
    | "not_started"
    | "in_progress"
    | "submitted"
    | "reopened"
    | "unavailable";
  nativeValue: string | null;
  reason?: string;
};
export type ReviewProgress = {
  state: "pending" | "known" | "partial" | "error";
  assignedReviewers: number | null;
  startedReviews: number | null;
  completedReviews: number | null;
  remainingReviews: number | null;
  denominator: { kind: "fixed" | "assigned" | "unknown"; value: number | null };
  anomalies: string[];
};
export type ReviewScoreDisplay = {
  criteria: Array<{
    id: string;
    name: string;
    description: string | null;
    maximum: number;
    score: number | null;
  }>;
  reviewerTotal: number | null;
  reviewerMaximum: number;
  applicationAggregate: number | null;
  applicationMaximum: number | null;
  aggregation: "completed_sum" | "completed_average";
  state: "pending" | "partial" | "ready";
};
export type ReviewDocument = {
  id: string;
  label: string;
  kind: string;
  source: "external" | "private_storage" | "scholarship_original" | "discussion_copy";
  url: string | null;
  storagePath: string | null;
  contentType?: string | null;
};
export type ReviewQueueItem<TMetadata = Record<string, unknown>> = {
  program: ProgramSlug;
  applicationId: string;
  applicantName: string;
  applicantEmail: string | null;
  status: ReviewStatus;
  progress: ReviewProgress;
  destination: string;
  metadata: TMetadata;
  capabilities: ReviewCapabilities;
};
export type Capability = {
  state: "allowed" | "denied" | "unknown";
  reason: string;
  source: string;
};
export type ReviewCapabilities = Record<
  | "canViewApplication"
  | "canReviewApplication"
  | "canSaveDraft"
  | "canSubmitReview"
  | "canEditSubmittedReview"
  | "canViewPeerReviews"
  | "canManageAssignments"
  | "canConfigureRubric"
  | "canViewRankings",
  Capability
>;
export type ReviewNavigation = {
  queuePath: string;
  applicationPath: string;
  sections: string[];
  returnTo: string | null;
};
export type ReviewWorkspaceData<TApplication = unknown, TDetails = unknown> = {
  program: ProgramSlug;
  applicationId: string;
  application: TApplication;
  details: TDetails;
  status: ReviewStatus;
  progress: ReviewProgress;
  score: ReviewScoreDisplay;
  documents: ReviewDocument[];
  capabilities: ReviewCapabilities;
  navigation: ReviewNavigation;
  state: ReadState;
  sources: Array<{ name: string; loadedAt: string | null; state: ReadState }>;
  anomalies: string[];
};

export type ReadSource<T> = {
  data: T | null;
  state: ReadState;
  loadedAt?: string | null;
  error?: string;
};
export function capabilityProjection(pending = true): ReviewCapabilities {
  const state = pending ? "unknown" : "denied";
  const reason = pending
    ? "Authorization inputs are not resolved."
    : "No authorization grant was established by this read projection.";
  const source = "presentation_only_rls_authoritative";
  return Object.fromEntries(
    [
      "canViewApplication",
      "canReviewApplication",
      "canSaveDraft",
      "canSubmitReview",
      "canEditSubmittedReview",
      "canViewPeerReviews",
      "canManageAssignments",
      "canConfigureRubric",
      "canViewRankings",
    ].map((key) => [key, { state, reason, source }]),
  ) as ReviewCapabilities;
}
export function capabilityAllows(capability: Capability): boolean {
  return capability.state === "allowed";
}
export function combinedReadState(sources: ReadSource<unknown>[]): ReadState {
  if (sources.some((source) => source.state === "unavailable")) return "unavailable";
  if (sources.some((source) => source.state === "loading")) return "loading";
  const failures = sources.filter(
    (source) => source.state === "error" || source.state === "partial_error",
  );
  if (failures.length === sources.length && failures.length) return "error";
  if (failures.length) return "partial_error";
  if (sources.some((source) => source.state === "empty")) return "empty";
  return "ready";
}
