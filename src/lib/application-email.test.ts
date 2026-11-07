import test from "node:test";
import assert from "node:assert/strict";
import {
  applicationEmailTemplate,
  emailBlockedReason,
  validateApplicantEmail,
} from "./application-email-templates.ts";
import {
  deliverReservedEmail,
  gmailRawMessage,
  sendGmailMessage,
  type EmailPayload,
  type DeliveryOutcome,
} from "./application-email-delivery.ts";

const email: EmailPayload = {
  id: "ad000000-0000-4000-8000-000000000001",
  recipient: "owner@example.org",
  subject: "Decision – 2026",
  body: "Dear Owner,\nThank you.",
};
test("decision email requires finalized/completed review or explicit decision; recipients always excluded", () => {
  const s = {
    recipient: false,
    finalized: false,
    notSelected: false,
    reviewComplete: false,
    email: email.recipient,
  };
  assert.ok(emailBlockedReason(s, "decision"));
  assert.ok(emailBlockedReason({ ...s, reviewComplete: true }, "decision"));
  assert.equal(
    emailBlockedReason({ ...s, reviewComplete: true, finalized: true }, "decision"),
    null,
  );
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
test("MIME carries exact UTF-8 body and prevents header injection", () => {
  const raw = Buffer.from(gmailRawMessage(email), "base64url").toString();
  assert.match(raw, /From: Justice League.*<info@justiceleagueglm.org>/);
  assert.equal(
    Buffer.from(raw.split("\r\n\r\n")[1].replaceAll("\r\n", ""), "base64").toString(),
    email.body.replaceAll("\n", "\r\n"),
  );
  assert.throws(() =>
    gmailRawMessage({ ...email, recipient: "owner@example.org\r\nBcc: x@y.org" }),
  );
});
test("Gmail acceptance, definite rejection and uncertain outcomes are distinguished without exposing provider errors", async () => {
  const request = (async (url: string, init: RequestInit) => {
    assert.match(url, /users\/info%40justiceleagueglm.org\/messages\/send$/);
    assert.ok(JSON.parse(init.body as string).raw);
    return Response.json({ id: "gmail-id" });
  }) as unknown as typeof fetch;
  assert.equal((await sendGmailMessage(email, "synthetic", request)).status, "accepted");
  for (const status of [400, 401, 403])
    assert.equal(
      (await sendGmailMessage(email, "x", async () => new Response("secret", { status }))).status,
      "failed",
    );
  for (const status of [429, 500, 503])
    assert.equal(
      (await sendGmailMessage(email, "x", async () => new Response("secret", { status }))).status,
      "unknown",
    );
  assert.equal(
    (
      await sendGmailMessage(email, "x", async () => {
        throw Error("timeout");
      })
    ).status,
    "unknown",
  );
  assert.equal(
    (await sendGmailMessage(email, "x", async () => Response.json({}))).status,
    "unknown",
  );
});
test("concurrent delivery claims send once, failed audit never triggers another send", async () => {
  let claimed = false,
    sends = 0;
  const deps = {
    claim: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    send: async () => {
      sends++;
      return { status: "accepted", providerId: "x", message: null } as DeliveryOutcome;
    },
    record: async () => {},
  };
  const results = await Promise.allSettled([
    deliverReservedEmail(email, deps),
    deliverReservedEmail(email, deps),
  ]);
  assert.equal(sends, 1);
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  claimed = false;
  await assert.rejects(
    deliverReservedEmail(email, {
      ...deps,
      record: async () => {
        throw Error("DB unavailable");
      },
    }),
    /Do not resend/,
  );
  assert.equal(sends, 2);
});
