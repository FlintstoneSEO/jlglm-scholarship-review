import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationEmailDraftLink,
  applicationEmailTemplate,
  emailBlockedReason,
  validateApplicantEmail,
} from "./application-email-templates.ts";
test("decision email requires an explicit non-selection regardless of review progress", () => {
  const s = {
    recipient: false,
    finalized: false,
    notSelected: false,
    reviewComplete: false,
    email: "owner@example.org",
  };
  assert.ok(emailBlockedReason(s, "decision"));
  const reviewed = { ...s, reviewComplete: true, finalized: true };
  assert.ok(emailBlockedReason(reviewed, "decision"));
  assert.equal(emailBlockedReason({ ...s, notSelected: true }, "decision"), null);
  assert.ok(emailBlockedReason({ ...s, notSelected: true, recipient: true }, "decision"));
  assert.ok(emailBlockedReason({ ...s, notSelected: true, email: null }, "decision"));
  assert.ok(
    emailBlockedReason(
      { ...s, notSelected: true, email: "owner@example.org\r\nBcc:other@example.org" },
      "decision",
    ),
  );
  assert.ok(emailBlockedReason(s, "recipient"));
  assert.equal(emailBlockedReason({ ...s, recipient: true }, "recipient"), null);
});
test("Prince templates personalize owner and preserve sourced wording without duplicate signature names", () => {
  for (const kind of ["decision", "recipient"] as const) {
    const t = applicationEmailTemplate(kind, "Ada Owner");
    assert.match(t.body, /^Dear Ada Owner,/);
    assert.equal(validateApplicantEmail(t.subject, t.body), null);
    assert.equal((t.body.match(/Prince Solace/g) || []).length, 1);
  }
  assert.equal(
    applicationEmailTemplate("decision", "Ada").subject,
    "2026 Business Growth Grant – Application Decision",
  );
  assert.ok(validateApplicantEmail("Decision", "[NEEDS CLIENT INPUT: name]"));
  assert.ok(validateApplicantEmail("Decision", "Denial"));
  assert.ok(validateApplicantEmail("Bad\r\nBcc: x", "text"));
});
test("the email client receives a personalized draft with no forced sender or extra recipients", () => {
  const template = applicationEmailTemplate("decision", "Jacqueline Taylor");
  const draft = new URL(
    applicationEmailDraftLink(
      "owner+grants@example.org",
      template.subject + " & follow-up",
      template.body,
    ),
  );
  assert.equal(draft.protocol, "mailto:");
  assert.equal(decodeURIComponent(draft.pathname), "owner+grants@example.org");
  assert.deepEqual([...draft.searchParams.keys()], ["subject", "body"]);
  assert.equal(draft.searchParams.get("subject"), template.subject + " & follow-up");
  assert.equal(draft.searchParams.get("body"), template.body.replaceAll("\n", "\r\n"));
  assert.match(draft.searchParams.get("body")!, /^Dear Jacqueline Taylor,/);
});
