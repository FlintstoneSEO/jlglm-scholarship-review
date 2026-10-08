import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";
import { normalizeReviewSubmissionError } from "../../review-submission";

export default defineTool({
  name: "submit_review",
  title: "Submit reviewer score",
  description:
    "Create or update the signed-in reviewer's Writing (0-9) and Rhetoric (0-9) scores and notes for an applicant. Scores are advisory only; the committee makes final selections.",
  inputSchema: {
    applicant_id: z.string().uuid(),
    writing_score: z.number().int().min(0).max(9),
    rhetoric_score: z.number().int().min(0).max(9),
    reviewer_notes: z.string().trim().max(4000).optional(),
    idempotency_key: z.string().min(8).max(200),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const reviewerId = ctx.getUserId();
    const { data: applicant, error: applicantError } = await supabase
      .from("applicants")
      .select("application_id")
      .eq("id", input.applicant_id)
      .single();
    if (applicantError || !applicant?.application_id)
      return errorResult(applicantError?.message ?? "Application is unavailable");
    const [{ data: assignment, error: assignmentError }, { data: existing, error: reviewError }] =
      await Promise.all([
        supabase
          .from("reviewer_assignments")
          .select("id")
          .eq("application_id", applicant.application_id)
          .eq("reviewer_id", reviewerId)
          .eq("lifecycle", "active")
          .single(),
        supabase
          .from("reviews")
          .select("id, version")
          .eq("applicant_id", input.applicant_id)
          .eq("reviewer_id", reviewerId)
          .eq("canonical_identity", true)
          .maybeSingle(),
      ]);
    if (assignmentError || !assignment) return errorResult(assignmentError?.message ?? "No assignment");
    if (reviewError) return errorResult(reviewError.message);
    const { data, error } = await supabase.rpc("submit_scholarship_review", {
      p_applicant_id: input.applicant_id,
      p_assignment_id: assignment.id,
      p_review_id: existing?.id,
      p_current_version: existing?.version ?? 0,
      p_writing_score: input.writing_score,
      p_rhetoric_score: input.rhetoric_score,
      p_comments: input.reviewer_notes,
      p_intent: "submit",
      p_idempotency_key: input.idempotency_key,
    });
    if (error) return errorResult(normalizeReviewSubmissionError(error).message);
    return jsonResult({
      review: data,
      subtotal: input.writing_score + input.rhetoric_score,
      note: "Scores are advisory. Final scholarship recipients are chosen by the Justice League scholarship committee.",
    });
  },
});
