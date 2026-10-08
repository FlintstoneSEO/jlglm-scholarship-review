import type { Database } from "../integrations/supabase/types";

type Item = Database["public"]["Tables"]["eligibility_review_items"]["Row"];
type Eligibility = Database["public"]["Tables"]["application_eligibility_reviews"]["Row"];
export const documentRequirementKeys = [
  "profit_loss_2024",
  "profit_loss_2025",
  "required_documentation",
];
export const eligibilityRequirementKeys = [
  "owner_eligibility",
  "business_eligibility",
  "lara_good_standing",
  ...documentRequirementKeys,
];
export type VerificationDraft = { key: string; status: Item["status"]; notes: string };
export type EligibilityDraft = {
  items: VerificationDraft[];
  baseline: VerificationDraft[];
  expectedUpdatedAt: string | null;
  decision: Exclude<Eligibility["status"], "not_reviewed"> | "";
  notes: string;
  baselineDecision: EligibilityDraft["decision"];
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
      eligibility?.status && eligibility.status !== "not_reviewed" ? eligibility.status : "",
    notes: eligibility?.notes ?? "",
    baselineDecision:
      eligibility?.status && eligibility.status !== "not_reviewed" ? eligibility.status : "",
    baselineNotes: eligibility?.notes ?? "",
  };
}
export function changedVerifications(draft: EligibilityDraft): VerificationDraft[] {
  return draft.items.filter((item) => {
    const saved = draft.baseline.find((saved) => saved.key === item.key);
    return item.status !== saved?.status || item.notes.trim() !== (saved?.notes ?? "").trim();
  });
}

export function eligibilityDecisionError(draft: EligibilityDraft): string | null {
  if (!draft.decision) return "Choose a final eligibility decision before saving it.";
  if (draft.decision === "eligible") {
    return eligibilityRequirementKeys.every((key) =>
      draft.items.some((item) => item.key === key && item.status === "verified"),
    )
      ? null
      : "All six requirements must be verified before confirming Eligible.";
  }
  return draft.notes.trim().length >= 10
    ? null
    : "Explain the decision in a note of at least 10 characters.";
}
export function verifyDocumentGroup(draft: EligibilityDraft): EligibilityDraft {
  return {
    ...draft,
    items: draft.items.map((item) =>
      documentRequirementKeys.includes(item.key) ? { ...item, status: "verified" } : item,
    ),
  };
}

// Saving changed checks resets the server decision, but keeps the administrator's
// unsaved decision and note available for final confirmation.
export function eligibilityProgressSaved(
  draft: EligibilityDraft,
  updatedAt: string | null,
): EligibilityDraft {
  const resetDecision = changedVerifications(draft).length > 0;
  return {
    ...draft,
    baseline: draft.items,
    expectedUpdatedAt: updatedAt,
    baselineDecision: resetDecision ? "" : draft.baselineDecision,
    baselineNotes: resetDecision ? "" : draft.baselineNotes,
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
