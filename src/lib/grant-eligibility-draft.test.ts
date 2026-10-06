import test from "node:test";
import assert from "node:assert/strict";
import {
  eligibilityDraft,
  changedVerifications,
  verifyDocumentGroup,
  hasUnsavedEligibilityDraft,
} from "./grant-eligibility-draft.ts";

test("group attestation leaves owner/business pending and preserves notes", () => {
  const draft = eligibilityDraft([], null);
  draft.items = draft.items.map((item) =>
    item.key === "profit_loss_2024" ? { ...item, notes: "Reviewed year and contents" } : item,
  );
  const verified = verifyDocumentGroup(draft);
  assert.equal(verified.items.filter((item) => item.status === "verified").length, 4);
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
  assert.equal(changes.length, 4);
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
  const saved = { ...draft, baseline: draft.items };
  assert.equal(hasUnsavedEligibilityDraft(saved), false);
  assert.equal(hasUnsavedEligibilityDraft({ ...saved, notes: "Follow up on registration" }), true);
  assert.equal(hasUnsavedEligibilityDraft({ ...saved, decision: "needs_clarification" }), true);
});
