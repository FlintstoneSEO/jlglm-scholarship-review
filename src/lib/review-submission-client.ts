import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeReviewSubmissionError,
  parseReviewSubmissionResult,
  type ReviewSubmissionInput,
  type ReviewSubmissionResult,
  type ReviewWriteAdapter,
} from "./review-submission.ts";

type RpcClient = Pick<SupabaseClient, "rpc">;

async function call(
  client: RpcClient,
  functionName: "submit_scholarship_review" | "submit_business_grant_review",
  input: ReviewSubmissionInput,
): Promise<ReviewSubmissionResult> {
  const args =
    input.program === "scholarship"
      ? {
          p_applicant_id: input.applicationId,
          p_assignment_id: input.assignmentId,
          p_review_id: input.reviewId,
          p_current_version: input.currentVersion,
          p_writing_score: input.criteria.find((item) => item.criterionId === "writing")?.value,
          p_rhetoric_score: input.criteria.find((item) => item.criterionId === "rhetoric")?.value,
          p_comments: input.comments,
          p_recommendation: input.recommendation,
          p_intent: input.intent,
          p_idempotency_key: input.idempotencyKey,
        }
      : {
          p_application_id: input.applicationId,
          p_assignment_id: input.assignmentId,
          p_review_id: input.reviewId,
          p_current_version: input.currentVersion,
          p_rubric_version: input.rubricVersion,
          p_criteria: input.criteria,
          p_comments: input.comments,
          p_intent: input.intent,
          p_idempotency_key: input.idempotencyKey,
          p_certification_version: input.certificationVersion,
          p_certified: input.certified,
        };
  const { data, error } = await client.rpc(functionName, args);
  if (error) throw normalizeReviewSubmissionError(error);
  return parseReviewSubmissionResult(data);
}

export function createReviewWriteAdapter(
  client: RpcClient,
  program: ReviewSubmissionInput["program"],
): ReviewWriteAdapter {
  const functionName =
    program === "scholarship" ? "submit_scholarship_review" : "submit_business_grant_review";
  const invoke = (input: ReviewSubmissionInput) => call(client, functionName, input);
  return {
    saveDraft: (input) => invoke({ ...input, program, intent: "save_draft" }),
    submit: (input) => invoke({ ...input, program, intent: "submit" }),
  };
}
