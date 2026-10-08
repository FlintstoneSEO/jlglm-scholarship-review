import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibilityDraft,
  changedVerifications,
  verifyDocumentGroup,
  hasUnsavedEligibilityDraft,
  eligibilityDecisionError,
  eligibilityProgressSaved,
} from "./grant-eligibility-draft.ts";
import type { Database } from "../integrations/supabase/types.ts";

type Eligibility = Database["public"]["Tables"]["application_eligibility_reviews"]["Row"];
const savedEligibility = (status: Eligibility["status"]): Eligibility => ({
  id: "screening",
  application_id: "application",
  program_id: "grant",
  status,
  notes: "Previously recorded decision",
  reviewed_by: "admin",
  reviewed_at: "2026-10-07T12:00:00Z",
  created_at: "2026-10-07T12:00:00Z",
  updated_at: "2026-10-07T12:00:00Z",
});

test("new and reconfirmation drafts require an explicit decision", () => {
  for (const saved of [null, { ...savedEligibility("not_reviewed"), notes: null }]) {
    const draft = eligibilityDraft([], saved);
    assert.equal(draft.decision, "");
    assert.equal(draft.baselineDecision, "");
    assert.equal(hasUnsavedEligibilityDraft(draft), false);
    assert.match(eligibilityDecisionError(draft)!, /Choose a final/);
  }
});

test("all saved final decisions and notes reload without becoming dirty", () => {
  for (const status of ["eligible", "needs_clarification", "ineligible"] as const) {
    const draft = eligibilityDraft([], savedEligibility(status));
    assert.equal(draft.decision, status);
    assert.equal(draft.notes, "Previously recorded decision");
    assert.equal(draft.expectedUpdatedAt, "2026-10-07T12:00:00Z");
    assert.equal(hasUnsavedEligibilityDraft(draft), false);
  }
});

test("Eligible requires every approved key verified, including independent LARA", () => {
  const draft = eligibilityDraft([], null);
  draft.decision = "eligible";
  draft.items = draft.items.map((item) => ({ ...item, status: "verified" }));
  assert.equal(eligibilityDecisionError(draft), null);
  for (const key of draft.items.map((item) => item.key)) {
    for (const status of ["pending", "missing", "failed", "needs_clarification"] as const) {
      assert.match(
        eligibilityDecisionError({
          ...draft,
          items: draft.items.map((item) => (item.key === key ? { ...item, status } : item)),
        })!,
        /All six/,
      );
    }
    assert.match(
      eligibilityDecisionError({
        ...draft,
        items: draft.items.filter((item) => item.key !== key),
      })!,
      /All six/,
    );
  }
});

test("Clarification and Ineligible require explanatory notes of at least ten characters", () => {
  for (const decision of ["needs_clarification", "ineligible"] as const) {
    const draft = { ...eligibilityDraft([], null), decision };
    for (const notes of ["", "          ", " short "]) {
      assert.match(eligibilityDecisionError({ ...draft, notes })!, /at least 10/);
    }
    assert.equal(
      eligibilityDecisionError({ ...draft, notes: "Missing current registration" }),
      null,
    );
  }
});

test("bulk documents preserve every LARA state and note without mutating the draft", () => {
  for (const status of [
    "pending",
    "verified",
    "missing",
    "failed",
    "needs_clarification",
  ] as const) {
    const draft = eligibilityDraft([], null);
    draft.items = draft.items.map((item) =>
      item.key === "lara_good_standing"
        ? { ...item, status, notes: "Independent registry finding" }
        : item,
    );
    draft.baseline = structuredClone(draft.items);
    const before = structuredClone(draft);
    const result = verifyDocumentGroup(draft);
    assert.deepEqual(
      result.items.find((item) => item.key === "lara_good_standing"),
      before.items.find((item) => item.key === "lara_good_standing"),
    );
    assert.deepEqual(draft, before);
    assert.equal(
      changedVerifications(result).some((item) => item.key === "lara_good_standing"),
      false,
    );
  }
});

test("group attestation leaves owner/business pending and preserves notes", () => {
  const draft = eligibilityDraft([], null);
  draft.items = draft.items.map((item) =>
    item.key === "profit_loss_2024" ? { ...item, notes: "Reviewed year and contents" } : item,
  );
  const verified = verifyDocumentGroup(draft);
  assert.equal(verified.items.filter((item) => item.status === "verified").length, 3);
  assert.equal(verified.items[0].status, "pending");
  assert.equal(verified.items[1].status, "pending");
  assert.equal(
    verified.items.find((item) => item.key === "profit_loss_2024")?.notes,
    "Reviewed year and contents",
  );
  assert.equal(draft.items.filter((item) => item.status === "verified").length, 0);
});

test("individual document exceptions remain in the batch after group attestation", () => {
  const draft = verifyDocumentGroup(eligibilityDraft([], null));
  draft.items = draft.items.map((item) =>
    item.key === "profit_loss_2025"
      ? { ...item, status: "needs_clarification", notes: "Wrong financial year supplied" }
      : item,
  );
  const changes = changedVerifications(draft);
  assert.equal(changes.length, 3);
  assert.equal(
    changes.find((item) => item.key === "profit_loss_2025")?.status,
    "needs_clarification",
  );
});

test("unchanged or reverted statuses do not reset a final decision", () => {
  const draft = eligibilityDraft([], null);
  assert.deepEqual(changedVerifications(draft), []);
  draft.items = draft.items.map((item) => ({ ...item, notes: "   " }));
  assert.deepEqual(changedVerifications(draft), []);
});

test("saved checks can be left without a warning, but unsaved decision notes remain protected", () => {
  const draft = verifyDocumentGroup(eligibilityDraft([], null));
  assert.equal(hasUnsavedEligibilityDraft(draft), true);
  const saved = eligibilityProgressSaved(draft, "2026-10-07T12:00:00Z");
  assert.equal(hasUnsavedEligibilityDraft(saved), false);
  assert.equal(hasUnsavedEligibilityDraft({ ...saved, notes: "Follow up on registration" }), true);
  assert.equal(hasUnsavedEligibilityDraft({ ...saved, decision: "needs_clarification" }), true);
});

test("Save progress retains final-decision edits and protects a reset saved decision", () => {
  const draft = eligibilityDraft([], savedEligibility("eligible"));
  const saved = eligibilityProgressSaved(verifyDocumentGroup(draft), "new timestamp");
  assert.equal(saved.decision, "eligible");
  assert.equal(saved.notes, draft.notes);
  assert.equal(saved.baselineDecision, "");
  assert.equal(saved.baselineNotes, "");
  assert.equal(saved.expectedUpdatedAt, "new timestamp");
  assert.deepEqual(changedVerifications(saved), []);
  assert.equal(hasUnsavedEligibilityDraft(saved), true);
  assert.match(eligibilityDecisionError(saved)!, /All six/);
});
