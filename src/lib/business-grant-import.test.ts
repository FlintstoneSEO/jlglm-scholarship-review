import test from "node:test";
import assert from "node:assert/strict";
import { mapBusinessGrantRow } from "./business-grant-import.ts";

test("maps a Google Forms export and preserves its raw response", () => {
  const source = {
    Timestamp: "2026-08-20 10:30:00",
    "Response ID": "grant-response-42",
    "Contact Name": "Avery Johnson",
    "Email Address": "avery@example.com",
    "Business Name": "North Star Foods",
    "Business Need": "Replace essential equipment",
    "Grant Amount Requested": "$7,500",
    "Supporting Documents": "https://example.com/plan.pdf",
    "Future form question": "Preserve this answer",
  };
  const result = mapBusinessGrantRow(source);
  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.externalSubmissionId, "grant-response-42");
  assert.equal(result.data?.detail.business_name, "North Star Foods");
  assert.equal(result.data?.detail.amount_requested, 7500);
  assert.deepEqual(result.data?.detail.raw_response, source);
  assert.equal(result.data?.documents[0]?.external_url, "https://example.com/plan.pdf");
});

test("rejects rows without the idempotency and identity fields", () => {
  const result = mapBusinessGrantRow({ Email: "missing@example.com" });
  assert.equal(result.data, undefined);
  assert.deepEqual(result.errors, [
    "Missing stable external submission ID",
    "Missing applicant/contact name",
    "Missing business name",
  ]);
});
