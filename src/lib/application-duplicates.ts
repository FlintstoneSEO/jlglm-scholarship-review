import { z } from "zod";

export const duplicateImpactSchema = z.object({
  application_id: z.string(),
  assignments: z.array(
    z.object({
      id: z.string(),
      reviewer_name: z.string(),
      lifecycle: z.string(),
      review_status: z.string(),
      review_version: z.number().nullable(),
    }),
  ),
});
export const duplicateCandidatesSchema = z.array(
  z.object({
    id: z.string(),
    applicant_name: z.string(),
    business_name: z.string(),
  }),
);
export type DuplicateImpact = z.infer<typeof duplicateImpactSchema>;
export type DuplicateCandidate = z.infer<typeof duplicateCandidatesSchema>[number];

export function duplicateImpactCounts(impact: DuplicateImpact) {
  return {
    assignments: impact.assignments.length,
    completed: impact.assignments.filter((a) => a.review_status === "completed").length,
    drafts: impact.assignments.filter((a) => a.review_status === "in_progress").length,
    notStarted: impact.assignments.filter((a) => a.review_status === "not_started").length,
  };
}
export function validDuplicateReason(reason: string) {
  return reason.trim().length >= 10 && reason.trim().length <= 4000;
}

export const duplicateExclusionExplanation =
  "Completed reviews remain preserved as excluded history and do not count toward active totals, rankings or funding recommendations. Reviews and scores will not be transferred or combined.";
