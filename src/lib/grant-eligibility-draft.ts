import type { Database } from "../integrations/supabase/types";

type Item = Database["public"]["Tables"]["eligibility_review_items"]["Row"];
type Eligibility = Database["public"]["Tables"]["application_eligibility_reviews"]["Row"];
export const documentRequirementKeys = [
  "lara_good_standing",
  "profit_loss_2024",
  "profit_loss_2025",
  "required_documentation",
];
export const eligibilityRequirementKeys = [
  "owner_eligibility",
  "business_eligibility",
  ...documentRequirementKeys,
];
export type VerificationDraft = { key: string; status: Item["status"]; notes: string };
export type EligibilityDraft = {
  items: VerificationDraft[];
  baseline: VerificationDraft[];
  expectedUpdatedAt: string | null;
  decision: Exclude<Eligibility["status"], "not_reviewed">;
  notes: string;
  baselineDecision: Exclude<Eligibility["status"], "not_reviewed">;
  baselineNotes: string;
};
export function eligibilityDraft(items: Item[], eligibility: Eligibility | null): EligibilityDraft {
  const values = eligibilityRequirementKeys.map((key) => {
    const item = items.find((item) => item.requirement_key === key);
    return { key, status: item?.status ?? "pending", notes: item?.notes ?? "" };
  });
  return {
    items: values,
    baseline: values,
    expectedUpdatedAt: eligibility?.updated_at ?? null,
    decision:
      eligibility?.status && eligibility.status !== "not_reviewed"
        ? eligibility.status
        : "eligible",
    notes: eligibility?.notes ?? "",
    baselineDecision:
      eligibility?.status && eligibility.status !== "not_reviewed"
        ? eligibility.status
        : "eligible",
    baselineNotes: eligibility?.notes ?? "",
  };
}
export function changedVerifications(draft: EligibilityDraft): VerificationDraft[] {
  return draft.items.filter((item) => {
    const saved = draft.baseline.find((saved) => saved.key === item.key);
    return item.status !== saved?.status || item.notes.trim() !== (saved?.notes ?? "").trim();
  });
}
export function verifyDocumentGroup(draft: EligibilityDraft): EligibilityDraft {
  return {
    ...draft,
    items: draft.items.map((item) =>
      documentRequirementKeys.includes(item.key) ? { ...item, status: "verified" } : item,
    ),
  };
}

export function hasUnsavedEligibilityDraft(draft: EligibilityDraft | null): boolean {
  return (
    !!draft &&
    (changedVerifications(draft).length > 0 ||
      draft.decision !== draft.baselineDecision ||
      draft.notes !== draft.baselineNotes)
  );
}
