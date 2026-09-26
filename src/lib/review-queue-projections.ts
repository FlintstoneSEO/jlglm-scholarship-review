import {
  capabilityProjection,
  combinedReadState,
  type ReadSource,
  type ReadState,
  type ReviewProgress,
  type ReviewQueueItem,
  type ReviewStatus,
} from "./review-domain.ts";

const normalizedStatus = (native: string | null | undefined): ReviewStatus => {
  if (native === "completed" || native === "reviewed")
    return { value: "submitted", nativeValue: native };
  if (native === "in_progress") return { value: "in_progress", nativeValue: native };
  if (native === "not_started") return { value: "not_started", nativeValue: native };
  if (native === "assigned") return { value: "assigned", nativeValue: native };
  return { value: "unavailable", nativeValue: native ?? null, reason: "Status unavailable." };
};

export type ScholarshipQueueApplicant = {
  id: string;
  application_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  graduation_high_school: string | null;
  college_attending: string | null;
  preliminary_screening_status: string;
  review_status: string;
  total_score: number | null;
  has_essay: boolean;
  has_transcript: boolean;
  applicant_signature_status: boolean;
  application_status?: string;
  phone?: string | null;
  updated_at?: string;
  is_finalist?: boolean | null;
  is_selected?: boolean | null;
};
export type QueueReview = {
  id: string;
  applicant_id?: string;
  application_id?: string;
  assignment_id?: string;
  reviewer_id: string;
  status?: string;
  is_complete?: boolean;
};
export type QueueAssignment = { id: string; application_id: string; reviewer_id: string };
export type ScholarshipQueueMetadata = {
  school: string | null;
  college: string | null;
  screeningState: string;
  missingDocuments: string[];
  score: number | null;
  rank: number | null;
  applicationStatus: string | null;
  phone: string | null;
  updatedAt: string | null;
  isFinalist: boolean;
  isSelected: boolean;
};

export function projectScholarshipQueue(input: {
  applicants: ReadSource<ScholarshipQueueApplicant[]>;
  reviews: ReadSource<QueueReview[]>;
  assignments: ReadSource<QueueAssignment[]>;
}): { items: ReviewQueueItem<ScholarshipQueueMetadata>[]; state: ReadState } {
  const applicants = input.applicants.data ?? [];
  const ranked = [...applicants].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0));
  const ranks = new Map(ranked.map((a, index) => [a.id, index + 1]));
  const items = applicants.map((applicant) => {
    const reviews = (input.reviews.data ?? []).filter(
      (review) => review.applicant_id === applicant.id,
    );
    const assignments = (input.assignments.data ?? []).filter(
      (assignment) => assignment.application_id === applicant.application_id,
    );
    const completed = reviews.filter((review) => review.is_complete).length;
    const duplicate = new Set<string>();
    const seen = new Set<string>();
    for (const review of reviews)
      seen.has(review.reviewer_id)
        ? duplicate.add(review.reviewer_id)
        : seen.add(review.reviewer_id);
    const anomalies = [
      ...(duplicate.size ? ["Duplicate review records detected."] : []),
      ...(assignments.length !== 5
        ? ["Assignment count differs from the five-review target."]
        : []),
    ];
    const progress: ReviewProgress = {
      state: input.reviews.data && input.assignments.data ? "known" : "partial",
      assignedReviewers: input.assignments.data ? assignments.length : null,
      startedReviews: input.reviews.data ? reviews.length : null,
      completedReviews: input.reviews.data ? completed : null,
      remainingReviews: input.reviews.data ? Math.max(0, 5 - completed) : null,
      denominator: { kind: "fixed", value: 5 },
      anomalies,
    };
    const missingDocuments = [
      !applicant.has_essay && "Essay",
      !applicant.has_transcript && "Transcript",
      !applicant.applicant_signature_status && "Signature",
    ].filter(Boolean) as string[];
    return {
      program: "scholarship" as const,
      applicationId: applicant.id,
      applicantName: `${applicant.first_name} ${applicant.last_name}`.trim(),
      applicantEmail: applicant.email,
      status: normalizedStatus(applicant.review_status),
      progress,
      destination: `/applicants/${applicant.id}`,
      capabilities: capabilityProjection(true),
      metadata: {
        school: applicant.graduation_high_school,
        college: applicant.college_attending,
        screeningState: applicant.preliminary_screening_status,
        missingDocuments,
        score: applicant.total_score,
        rank: ranks.get(applicant.id) ?? null,
        applicationStatus: applicant.application_status ?? null,
        phone: applicant.phone ?? null,
        updatedAt: applicant.updated_at ?? null,
        isFinalist: !!applicant.is_finalist,
        isSelected: !!applicant.is_selected,
      },
    };
  });
  const state =
    input.applicants.state === "error"
      ? "error"
      : combinedReadState([input.applicants, input.reviews, input.assignments]);
  return { items, state: state === "ready" && items.length === 0 ? "empty" : state };
}

export type ScholarshipQueueFilters = {
  search: string;
  school: string;
  college: string;
  applicationStatus: string;
  screeningStatus: string;
  reviewStatus: string;
  minScore: string;
  maxScore: string;
  missingEssay: boolean;
  missingTranscript: boolean;
  missingSignature: boolean;
};
export function filterScholarshipQueue(
  items: ReviewQueueItem<ScholarshipQueueMetadata>[],
  filters: ScholarshipQueueFilters,
) {
  const query = filters.search.toLowerCase();
  return items.filter((item) => {
    if (
      query &&
      !item.applicantName.toLowerCase().includes(query) &&
      !(item.applicantEmail ?? "").toLowerCase().includes(query)
    )
      return false;
    if (
      filters.school &&
      !(item.metadata.school ?? "").toLowerCase().includes(filters.school.toLowerCase())
    )
      return false;
    if (
      filters.college &&
      !(item.metadata.college ?? "").toLowerCase().includes(filters.college.toLowerCase())
    )
      return false;
    if (
      filters.applicationStatus !== "all" &&
      item.metadata.applicationStatus !== filters.applicationStatus
    )
      return false;
    if (
      filters.screeningStatus !== "all" &&
      item.metadata.screeningState !== filters.screeningStatus
    )
      return false;
    if (filters.reviewStatus !== "all" && item.status.nativeValue !== filters.reviewStatus)
      return false;
    if (filters.minScore && (item.metadata.score ?? 0) < Number(filters.minScore)) return false;
    if (filters.maxScore && (item.metadata.score ?? 0) > Number(filters.maxScore)) return false;
    if (filters.missingEssay && !item.metadata.missingDocuments.includes("Essay")) return false;
    if (filters.missingTranscript && !item.metadata.missingDocuments.includes("Transcript"))
      return false;
    if (filters.missingSignature && !item.metadata.missingDocuments.includes("Signature"))
      return false;
    return true;
  });
}

export type GrantQueueApplication = {
  id: string;
  applicant_name: string;
  applicant_email: string | null;
  review_status: string;
  completed_review_count: number;
  average_score: number;
};
export type GrantQueueDetail = {
  application_id: string;
  business_name: string;
  business_age_range: string | null;
  lara_status: string | null;
  business_operating_model: string | null;
};
export type GrantQueueMetadata = {
  businessName: string | null;
  businessAge: string | null;
  laraStatus: string | null;
  operatingModel: string | null;
  averageScore: number | null;
};
export function projectGrantQueue(input: {
  applications: ReadSource<GrantQueueApplication[]>;
  details: ReadSource<GrantQueueDetail[]>;
  assignments: ReadSource<QueueAssignment[]>;
  reviews: ReadSource<QueueReview[]>;
}): { items: ReviewQueueItem<GrantQueueMetadata>[]; state: ReadState } {
  const byId = new Map((input.details.data ?? []).map((detail) => [detail.application_id, detail]));
  const items = (input.applications.data ?? []).map((application) => {
    const assignments = (input.assignments.data ?? []).filter(
      (a) => a.application_id === application.id,
    );
    const reviews = (input.reviews.data ?? []).filter((r) => r.application_id === application.id);
    const completed = reviews.filter((r) => r.status === "completed").length;
    const detail = byId.get(application.id);
    return {
      program: "business_growth_grant" as const,
      applicationId: application.id,
      applicantName: application.applicant_name,
      applicantEmail: application.applicant_email,
      status: normalizedStatus(application.review_status),
      destination: `/grants/${application.id}`,
      capabilities: capabilityProjection(true),
      progress: {
        state: input.assignments.data && input.reviews.data ? "known" : "partial",
        assignedReviewers: input.assignments.data ? assignments.length : null,
        startedReviews: input.reviews.data
          ? reviews.filter((r) => r.status !== "not_started").length
          : null,
        completedReviews: input.reviews.data ? completed : application.completed_review_count,
        remainingReviews:
          input.assignments.data && input.reviews.data
            ? Math.max(0, assignments.length - completed)
            : null,
        denominator: {
          kind: "assigned",
          value: input.assignments.data ? assignments.length : null,
        },
        anomalies: [],
      },
      metadata: {
        businessName: detail?.business_name ?? null,
        businessAge: detail?.business_age_range ?? null,
        laraStatus: detail?.lara_status ?? null,
        operatingModel: detail?.business_operating_model ?? null,
        averageScore: application.completed_review_count ? application.average_score : null,
      },
    };
  });
  const state = combinedReadState([
    input.applications,
    input.details,
    input.assignments,
    input.reviews,
  ]);
  return { items, state: state === "ready" && items.length === 0 ? "empty" : state };
}

export function projectAssignmentProgress(
  program: "scholarship" | "business_growth_grant",
  assignment: QueueAssignment,
  grantReviews: QueueReview[],
  scholarshipReviews: QueueReview[],
  scholarshipApplicantId?: string,
): ReviewProgress {
  const rows =
    program === "scholarship"
      ? scholarshipReviews.filter(
          (review) =>
            review.applicant_id === scholarshipApplicantId &&
            review.reviewer_id === assignment.reviewer_id,
        )
      : grantReviews.filter(
          (review) =>
            review.assignment_id === assignment.id ||
            (review.application_id === assignment.application_id &&
              review.reviewer_id === assignment.reviewer_id),
        );
  const completed = rows.some((review) =>
    program === "scholarship" ? review.is_complete : review.status === "completed",
  )
    ? 1
    : 0;
  return {
    state: "known",
    assignedReviewers: 1,
    startedReviews: rows.length ? 1 : 0,
    completedReviews: completed,
    remainingReviews: 1 - completed,
    denominator: { kind: "assigned", value: 1 },
    anomalies: rows.length > 1 ? ["Duplicate review records detected."] : [],
  };
}
