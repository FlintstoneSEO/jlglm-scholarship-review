import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

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
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const reviewerId = ctx.getUserId();

    const { data: existing, error: findError } = await supabase
      .from("reviews")
      .select("id")
      .eq("applicant_id", input.applicant_id)
      .eq("reviewer_id", reviewerId)
      .maybeSingle();
    if (findError) return errorResult(findError.message);

    const payload = {
      applicant_id: input.applicant_id,
      reviewer_id: reviewerId,
      reviewer_name: ctx.getUserEmail() ?? "Reviewer",
      writing_score: input.writing_score,
      rhetoric_score: input.rhetoric_score,
      reviewer_notes: input.reviewer_notes ?? null,
      is_complete: true,
      submitted_at: new Date().toISOString(),
    };

    const { data, error } = existing
      ? await supabase.from("reviews").update(payload).eq("id", existing.id).select().maybeSingle()
      : await supabase.from("reviews").insert(payload).select().maybeSingle();

    if (error) return errorResult(error.message);
    return jsonResult({
      review: data,
      subtotal: input.writing_score + input.rhetoric_score,
      note: "Scores are advisory. Final scholarship recipients are chosen by the Justice League scholarship committee.",
    });
  },
});
