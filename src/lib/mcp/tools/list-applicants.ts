import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_applicants",
  title: "List applicants",
  description:
    "List 2026 Reparations Scholarship applicants with optional filters for screening status, application status, and name/email search.",
  inputSchema: {
    search: z.string().trim().optional().describe("Match against first name, last name, or email."),
    preliminary_screening_status: z
      .enum(["pending_screening", "eligible_for_review", "did_not_meet_minimum_requirements"])
      .optional(),
    application_status: z
      .enum([
        "submitted",
        "complete",
        "incomplete",
        "finalist",
        "selected",
        "not_selected",
        "withdrawn",
      ])
      .optional(),
    limit: z.number().int().min(1).max(200).default(50),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("applicants")
      .select(
        "id, first_name, last_name, email, phone, college_attending, application_status, review_status, preliminary_screening_status, total_score, rank, is_finalist, is_selected, has_essay, has_transcript",
      )
      .order("total_score", { ascending: false, nullsFirst: false })
      .limit(input.limit);

    if (input.preliminary_screening_status)
      query = query.eq("preliminary_screening_status", input.preliminary_screening_status);
    if (input.application_status) query = query.eq("application_status", input.application_status);
    if (input.search) {
      const s = `%${input.search}%`;
      query = query.or(`first_name.ilike.${s},last_name.ilike.${s},email.ilike.${s}`);
    }

    const { data, error } = await query;
    if (error) return errorResult(error.message);
    return jsonResult({ count: data?.length ?? 0, applicants: data ?? [] });
  },
});
