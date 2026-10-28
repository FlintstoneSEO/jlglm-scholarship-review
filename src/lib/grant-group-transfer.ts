import { z } from "zod";

export const transferGroupsSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    unavailable_reason: z.string().nullable(),
  }),
);
export const transferImpactSchema = z
  .object({
    application_id: z.string(),
    current_group: z.object({ id: z.string(), name: z.string() }).passthrough().nullable(),
    group: z
      .object({
        id: z.string(),
        name: z.string(),
        revision: z.number(),
        members: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
      })
      .passthrough(),
    assignments: z.array(
      z
        .object({
          id: z.string(),
          reviewer_id: z.string(),
          reviewer_name: z.string(),
          lifecycle: z.string(),
          review_status: z.string(),
          transferred_at: z.string().nullable(),
        })
        .passthrough(),
    ),
    completed_review_count: z.number(),
    average_score: z.number(),
  })
  .passthrough();
export type TransferImpact = z.infer<typeof transferImpactSchema>;
export function validTransferReason(reason: string) {
  const length = [...reason.trim()].length;
  return length >= 10 && length <= 4000;
}
export const transferExplanation =
  "Previous reviews remain excluded historical evidence. Their scores no longer count toward current review counts, average scores, rankings or completion. Both destination reviewers start fresh, with no inherited scores, comments, certifications or conflict declarations.";

export type TransferOwnership = {
  id: string;
  application_id: string;
  occurred_at: string;
  group_snapshot: { id: string; name: string; revision: number; members: string[] };
};
export const transferOwnershipSchema = z.array(
  z.object({
    id: z.string(),
    application_id: z.string(),
    occurred_at: z.string(),
    group_snapshot: z.object({
      id: z.string(),
      name: z.string(),
      revision: z.number(),
      members: z.array(z.string()).length(2),
    }),
  }),
);
export function latestTransfer(transfers: TransferOwnership[], applicationId: string) {
  return transfers
    .filter((t) => t.application_id === applicationId)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at) || b.id.localeCompare(a.id))[0];
}
