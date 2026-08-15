import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "add_applicant_note",
  title: "Add committee note",
  description: "Add a committee note to an applicant record as the signed-in user.",
  inputSchema: {
    applicant_id: z.string().uuid(),
    note: z.string().trim().min(1).max(4000),
    note_type: z.string().trim().max(50).default("general"),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("applicant_notes")
      .insert({
        applicant_id: input.applicant_id,
        note: input.note,
        note_type: input.note_type,
        created_by: ctx.getUserId(),
        created_by_name: ctx.getUserEmail() ?? "Committee member",
      })
      .select()
      .maybeSingle();
    if (error) return errorResult(error.message);
    return jsonResult({ note: data });
  },
});
