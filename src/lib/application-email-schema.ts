import { z } from "zod";

export function isDecisionEmailTrackingUnavailable(error: { code: string }) {
  return error.code === "PGRST205" || error.code === "42P01";
}
export const applicationEmailHistorySchema = z.object({
  id: z.string(),
  kind: z.enum(["decision", "recipient"]),
  recipient: z.string(),
  sender: z.string(),
  subject: z.string(),
  body: z.string(),
  actor_id: z.string(),
  created_at: z.string(),
  status: z.enum(["reserved", "sending", "accepted", "failed", "unknown"]),
  provider_id: z.string().nullable(),
  error_message: z.string().nullable(),
});
export const applicationEmailWorkspaceSchema = z.object({
  applicationId: z.string(),
  programId: z.string(),
  name: z.string(),
  email: z.string().nullable(),
  businessName: z.string().nullable(),
  assigned: z.number(),
  completed: z.number(),
  reviewComplete: z.boolean(),
  recipient: z.boolean(),
  finalized: z.boolean(),
  notSelected: z.boolean(),
  decisionId: z.string().nullable(),
  decisionReason: z.string().nullable(),
  fingerprint: z.string(),
  history: z.array(applicationEmailHistorySchema),
});
export type ApplicationEmailWorkspace = z.infer<typeof applicationEmailWorkspaceSchema>;
