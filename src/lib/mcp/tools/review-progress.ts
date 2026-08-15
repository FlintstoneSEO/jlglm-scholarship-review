import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { errorResult, jsonResult, supabaseForUser } from "../supabase";

export default defineTool({
  name: "review_progress",
  title: "Review progress summary",
  description:
    "Summarize review progress: applicant counts by screening/application status, missing documents, and the top-ranked applicants by combined committee score (advisory only).",
  inputSchema: { top_limit: z.number().int().min(1).max(50).default(10) },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ top_limit }, ctx) => {
    if (!ctx.isAuthenticated()) return errorResult("Not authenticated");
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("applicants")
      .select(
        "id, first_name, last_name, application_status, preliminary_screening_status, review_status, total_score, is_finalist, is_selected, has_essay, has_transcript, applicant_signature_status, guardian_signature_status, is_18_or_older",
      );
    if (error) return errorResult(error.message);
    const rows = data ?? [];

    const tally = (key: keyof (typeof rows)[number]) =>
      rows.reduce<Record<string, number>>((acc, r) => {
        const k = String(r[key] ?? "unknown");
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {});

    const missingDocs = rows.filter(
      (r) =>
        !r.has_essay ||
        !r.has_transcript ||
        !r.applicant_signature_status ||
        (r.is_18_or_older === false && !r.guardian_signature_status),
    ).length;

    const top = [...rows]
      .filter((r) => r.total_score != null)
      .sort((a, b) => Number(b.total_score) - Number(a.total_score))
      .slice(0, top_limit)
      .map((r) => ({
        id: r.id,
        name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim(),
        total_score: r.total_score,
        is_finalist: r.is_finalist,
        is_selected: r.is_selected,
      }));

    return jsonResult({
      total_applicants: rows.length,
      by_screening_status: tally("preliminary_screening_status"),
      by_application_status: tally("application_status"),
      by_review_status: tally("review_status"),
      applicants_with_missing_documents: missingDocs,
      top_by_committee_score: top,
      disclaimer:
        "Rankings reflect committee-entered scores only. Final scholarship recipients are chosen by the Justice League scholarship committee.",
    });
  },
});
