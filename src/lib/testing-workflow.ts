/** Tutorial state and progress are projections of the normal review system. */
export function parseAssignmentSearch(s: Record<string, unknown>): {
  scope?: "real" | "test";
  application?: string;
  program?: string;
} {
  return {
    scope: s.scope === "test" ? ("test" as const) : ("real" as const),
    application: typeof s.application === "string" ? s.application : undefined,
    program: typeof s.program === "string" ? s.program : undefined,
  };
}
export function parseTestingSearch(s: Record<string, unknown>): {
  guide?: boolean;
  application?: string;
  reviewer?: string;
} {
  return {
    guide: s.guide === true || s.guide === "true",
    application: typeof s.application === "string" ? s.application : undefined,
    reviewer: typeof s.reviewer === "string" ? s.reviewer : undefined,
  };
}
export function practiceApplicationName(name: string, slug: string, businessName?: string | null) {
  const clean = (businessName || name).replace(/^TEST\s*[-\u2013:]\s*/i, "").trim();
  const oldPractice = clean.match(/^PRACTICE (?:Business|Applicant) (\d+)$/i);
  if (oldPractice) {
    const names = [
      "Capital City Repair",
      "Riverfront Catering",
      "Maple Street Market",
      "Cedar Grove Services",
      "Oak Lane Studio",
    ];
    const number = Math.max(1, Number(oldPractice[1]));
    return `${names[(number - 1) % names.length]} ${Math.ceil(number / names.length)}`;
  }
  if (/^Sample (Applicant|Business|Student)$/i.test(clean))
    return slug === "scholarship" ? "Jordan Williams" : "Capital City Repair";
  return clean || "Fictional applicant";
}
export type PracticeAssignment = {
  id: string;
  application_id: string;
  reviewer_id: string;
  lifecycle: string;
};
export type PracticeReview = {
  id: string;
  assignment_id?: string;
  applicant_id?: string;
  reviewer_id: string | null;
  status?: string;
  is_complete?: boolean;
  total_score?: number | null;
  writing_score?: number;
  rhetoric_score?: number;
};
export function practiceProgress(
  slug: string,
  applicationId: string,
  applicantId: string | null,
  assignments: PracticeAssignment[],
  reviews: PracticeReview[],
) {
  return assignments
    .filter((a) => a.application_id === applicationId)
    .map((assignment) => {
      const review = reviews.find((r) =>
        slug === "scholarship"
          ? r.applicant_id === applicantId && r.reviewer_id === assignment.reviewer_id
          : r.assignment_id === assignment.id,
      );
      const active = assignment.lifecycle === "active";
      const completed =
        active &&
        !!review &&
        (slug === "scholarship" ? review.is_complete === true : review.status === "completed");
      const started =
        active && !!review && (slug === "scholarship" || review.status !== "not_started");
      return {
        assignment,
        review,
        completed,
        started,
        score:
          completed && review
            ? slug === "scholarship"
              ? (review.writing_score ?? 0) + (review.rhetoric_score ?? 0)
              : (review.total_score ?? null)
            : null,
        label: !active
          ? "Inactive assignment"
          : completed
            ? "Completed"
            : started
              ? "In Progress"
              : "Not Started",
      };
    });
}
export const testingChecklist = [
  "Application appears in the reviewer's queue",
  "Reviewer can open the application",
  "Application information and documents are visible",
  "Rubric displays correctly",
  "Scores and reviewer comments can be entered",
  "Draft can be saved and reopened",
  "Review can be submitted",
  "Test is excluded from real rankings and reports",
] as const;
export type AssignmentInput = {
  application_id: string;
  program_id: string;
  reviewer_id: string;
  assigned_by: string | null;
};
export async function saveReviewerAssignment(
  input: AssignmentInput,
  insert: (
    input: AssignmentInput,
  ) => PromiseLike<{ error: { code?: string; message: string } | null }>,
) {
  const { error } = await insert(input);
  if (error)
    throw new Error(
      error.code === "23505"
        ? "This person already has an assignment for this application. Check the assigned reviewers, including inactive assignments."
        : error.message,
    );
}
