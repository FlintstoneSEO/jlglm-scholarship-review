import type { Database } from "@/integrations/supabase/types";
import type { ReviewDocument } from "./review-domain";

type GrantDetail = Database["public"]["Tables"]["business_grant_application_details"]["Row"];

export type EligibilityRequirement = {
  id: string;
  label: string;
  evidence: string;
  documentNote: string;
  verification: string;
  documents: ReviewDocument[];
};

function sourceValue(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "object") {
    if (Object.keys(value).length === 0) return null;
    return JSON.stringify(value);
  }
  return String(value);
}

export function grantOverviewRequirements(
  detail: Pick<
    GrantDetail,
    "descendant_eligibility" | "eligibility_answers" | "lara_status" | "lara_explanation"
  >,
  documents: ReviewDocument[],
): EligibilityRequirement[] {
  const matching = (kind: string) => documents.filter((document) => document.kind === kind);
  const lara = matching("lara_documentation");
  const p2024 = matching("profit_loss_2024");
  const p2025 = matching("profit_loss_2025");
  const documented = documents.filter((document) => document.url || document.storagePath);
  return [
    {
      id: "owner_eligibility",
      label: "Black/African American business owner eligibility",
      evidence: sourceValue(detail.descendant_eligibility) ?? "No identity response in the record",
      documentNote: "No separate document type is mapped to this requirement.",
      verification:
        "Confirm the applicant's response and business ownership against program requirements.",
      documents: [],
    },
    {
      id: "business_eligibility",
      label: "Business eligibility",
      evidence: sourceValue(detail.eligibility_answers) ?? "No eligibility answers in the record",
      documentNote: "No separate document type is mapped to this requirement.",
      verification: "Review the application answers against the business eligibility requirements.",
      documents: [],
    },
    {
      id: "lara_good_standing",
      label: "LARA registration and good standing",
      evidence: sourceValue(detail.lara_status) ?? "No LARA response in the record",
      documentNote: lara.some((document) => document.url || document.storagePath)
        ? "LARA document available"
        : "No accessible LARA document in the record",
      verification: detail.lara_explanation
        ? `Review the applicant's explanation: ${detail.lara_explanation}`
        : "Verify current registration and good standing; the response alone is not proof.",
      documents: lara,
    },
    {
      id: "required_documentation",
      label: "Required documentation",
      evidence: documented.length
        ? `${documented.length} supporting document${documented.length === 1 ? "" : "s"} available`
        : "No accessible supporting documents in the record",
      documentNote: "Document presence does not establish that all required items are complete.",
      verification: "Check each required document for completeness and relevance.",
      documents: documented,
    },
    {
      id: "profit_loss_2024",
      label: "2024 P&L",
      evidence: p2024.some((document) => document.url || document.storagePath)
        ? "Document available"
        : "No accessible 2024 P&L in the record",
      documentNote: p2024.some((document) => document.url || document.storagePath)
        ? "2024 P&L document linked"
        : "2024 P&L document missing",
      verification: "Open the statement and verify the year and contents.",
      documents: p2024,
    },
    {
      id: "profit_loss_2025",
      label: "2025 P&L",
      evidence: p2025.some((document) => document.url || document.storagePath)
        ? "Document available"
        : "No accessible 2025 P&L in the record",
      documentNote: p2025.some((document) => document.url || document.storagePath)
        ? "2025 P&L document linked"
        : "2025 P&L document missing",
      verification: "Open the statement and verify the year and contents.",
      documents: p2025,
    },
  ];
}
