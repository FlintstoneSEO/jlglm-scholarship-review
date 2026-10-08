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
  triage?: string;
};

function sourceValue(value: unknown): string | null {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  if (typeof value === "object") {
    if (
      Object.keys(value).length === 0 ||
      Object.values(value).every((item) => sourceValue(item) === null)
    )
      return null;
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
  const documented = documents.filter(
    (document) => document.url?.trim() || document.storagePath?.trim(),
  );
  return [
    {
      triage: sourceValue(detail.descendant_eligibility)
        ? undefined
        : "Missing submitted identity/ownership answer; human follow-up needed",
      id: "owner_eligibility",
      label: "Black/African American business owner eligibility",
      evidence: sourceValue(detail.descendant_eligibility) ?? "No identity response in the record",
      documentNote: "No separate document type is mapped to this requirement.",
      verification:
        "Confirm the applicant's response and business ownership against program requirements.",
      documents: [],
    },
    {
      triage: sourceValue(detail.eligibility_answers)
        ? undefined
        : "Missing submitted business eligibility answers; human follow-up needed",
      id: "business_eligibility",
      label: "Business location, operating history and revenue",
      evidence: sourceValue(detail.eligibility_answers) ?? "No eligibility answers in the record",
      documentNote: "No separate document type is mapped to this requirement.",
      verification:
        "Verify location in the eligible Tri-County region, at least three years in operation, and the $20,000 annual revenue requirement against the approved program requirements. Record Needs clarification when the evidence does not support a determination; do not infer eligibility from an address or missing answers.",
      documents: [],
    },
    {
      triage: !sourceValue(detail.lara_status)
        ? "Missing submitted LARA answer"
        : !lara.some((d) => d.url?.trim() || d.storagePath?.trim())
          ? "Missing LARA document reference"
          : undefined,
      id: "lara_good_standing",
      label: "LARA registration and good standing",
      evidence: sourceValue(detail.lara_status) ?? "No LARA response in the record",
      documentNote: lara.some((document) => document.url?.trim() || document.storagePath?.trim())
        ? "LARA document reference present"
        : "No referenced LARA document in the record",
      verification: detail.lara_explanation
        ? `Review the applicant's explanation: ${detail.lara_explanation}`
        : "Verify current registration and good standing; the response alone is not proof.",
      documents: lara,
    },
    {
      triage: documented.some((d) => d.url?.trim() || d.storagePath?.trim())
        ? undefined
        : "Missing supporting-document reference; human follow-up needed",
      id: "required_documentation",
      label: "Required documentation",
      evidence: documented.length
        ? `${documented.length} supporting document${documented.length === 1 ? "" : "s"} referenced`
        : "No referenced supporting documents in the record",
      documentNote: "Document presence does not establish that all required items are complete.",
      verification: "Check each required document for completeness and relevance.",
      documents: documented,
    },
    {
      triage: p2024.some((d) => d.url?.trim() || d.storagePath?.trim())
        ? undefined
        : "Missing supporting-document reference; human follow-up needed",
      id: "profit_loss_2024",
      label: "2024 P&L",
      evidence: p2024.some((document) => document.url?.trim() || document.storagePath?.trim())
        ? "Document reference present"
        : "No referenced 2024 P&L in the record",
      documentNote: p2024.some((document) => document.url?.trim() || document.storagePath?.trim())
        ? "2024 P&L document linked"
        : "2024 P&L document missing",
      verification: "Open the statement and verify the year and contents.",
      documents: p2024,
    },
    {
      triage: p2025.some((d) => d.url?.trim() || d.storagePath?.trim())
        ? undefined
        : "Missing supporting-document reference; human follow-up needed",
      id: "profit_loss_2025",
      label: "2025 P&L",
      evidence: p2025.some((document) => document.url?.trim() || document.storagePath?.trim())
        ? "Document reference present"
        : "No referenced 2025 P&L in the record",
      documentNote: p2025.some((document) => document.url?.trim() || document.storagePath?.trim())
        ? "2025 P&L document linked"
        : "2025 P&L document missing",
      verification: "Open the statement and verify the year and contents.",
      documents: p2025,
    },
  ];
}
