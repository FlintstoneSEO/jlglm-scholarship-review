import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_applicant",
  title: "Get applicant detail",
  description:
    "Get one applicant's full record including reviewer scores, committee notes, contact log, and missing-document checklist.",
  inputSchema: { applicant_id: z.string().uuid().describe("Applicant UUID.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ applicant_id }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);

    const { data: applicant, error } = await supabase
      .from("applicants")
      .select("*")
      .eq("id", applicant_id)
      .maybeSingle();
    if (error) return errorResult(error.message);
    if (!applicant) return errorResult("Applicant not found (or not visible to you).");

    const [reviews, notes, contacts] = await Promise.all([
      supabase
        .from("reviews")
        .select("id, reviewer_name, writing_score, rhetoric_score, total_score, is_complete, reviewer_notes, submitted_at")
        .eq("applicant_id", applicant_id),
      supabase
        .from("applicant_notes")
        .select("id, note, note_type, created_by_name, created_at")
        .eq("applicant_id", applicant_id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_logs")
        .select("id, contact_type, subject, contacted_by_name, contacted_at")
        .eq("applicant_id", applicant_id)
        .order("contacted_at", { ascending: false }),
    ]);

    const missing: string[] = [];
    if (!applicant.has_essay) missing.push("Essay");
    if (!applicant.has_transcript) missing.push("Transcript");
    if (!applicant.applicant_signature_status) missing.push("Applicant signature");
    if (applicant.is_18_or_older === false && !applicant.guardian_signature_status)
      missing.push("Guardian signature");

    return jsonResult({
      applicant,
      missing_documents: missing,
      reviews: reviews.data ?? [],
      notes: notes.data ?? [],
      contact_logs: contacts.data ?? [],
    });
  },
});
