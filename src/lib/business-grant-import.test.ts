import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveApplicantName,
  liveBusinessGrantHeaders,
  mapBusinessGrantRow,
  suggestBusinessGrantMappings,
} from "./business-grant-import.ts";

function liveRow(overrides: Record<string, unknown> = {}) {
  return {
    [liveBusinessGrantHeaders.submitted_at]: "2026-08-20 10:30:00",
    [liveBusinessGrantHeaders.applicant_first_name]: "Ryan",
    [liveBusinessGrantHeaders.applicant_middle_name]: "Malcom",
    [liveBusinessGrantHeaders.applicant_last_name]: "Holmes",
    [liveBusinessGrantHeaders.applicant_email]: "ryan@example.com",
    [liveBusinessGrantHeaders.business_name]: "North Star Foods",
    [liveBusinessGrantHeaders.lara_documentation]: "https://drive.google.com/lara",
    [liveBusinessGrantHeaders.profit_loss_2024]: "https://drive.google.com/p-and-l-2024",
    [liveBusinessGrantHeaders.profit_loss_2025]: "https://drive.google.com/p-and-l-2025",
    "Future form question": "Preserve this answer",
    ...overrides,
  };
}

test("derives applicant names with and without a middle name", () => {
  assert.equal(deriveApplicantName(" Ryan ", " Malcom ", " Holmes "), "Ryan Malcom Holmes");
  assert.equal(deriveApplicantName("Ryan", "  ", "Holmes"), "Ryan Holmes");
});

test("maps the live form and preserves its complete raw response", () => {
  const source = liveRow();
  const result = mapBusinessGrantRow(source);
  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.applicantName, "Ryan Malcom Holmes");
  assert.equal(result.data?.detail.business_name, "North Star Foods");
  assert.deepEqual(result.data?.detail.raw_response, source);
});

test("creates three distinct typed document records", () => {
  const documents = mapBusinessGrantRow(liveRow()).data?.documents;
  assert.deepEqual(
    documents?.map(({ document_type, label }) => ({ document_type, label })),
    [
      { document_type: "lara_documentation", label: "LARA Good Standing Documentation" },
      { document_type: "profit_loss_2024", label: "2024 Profit & Loss Statement" },
      { document_type: "profit_loss_2025", label: "2025 Profit & Loss Statement" },
    ],
  );
});

test("allows blank middle name and optional LARA upload", () => {
  const result = mapBusinessGrantRow(
    liveRow({
      [liveBusinessGrantHeaders.applicant_middle_name]: "",
      [liveBusinessGrantHeaders.lara_documentation]: "",
    }),
  );
  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.applicantName, "Ryan Holmes");
  assert.equal(result.data?.documents.length, 2);
});

test("fails only a live row missing its required first name", () => {
  const result = mapBusinessGrantRow(
    liveRow({ [liveBusinessGrantHeaders.applicant_first_name]: "" }),
  );
  assert.equal(result.data, undefined);
  assert.deepEqual(result.errors, ["Missing applicant first name"]);
});

test("keeps legacy response-ID imports available", () => {
  const result = mapBusinessGrantRow({
    "Response ID": "grant-response-42",
    "Contact Name": "Avery Johnson",
    "Business Name": "North Star Foods",
    "Supporting Documents": "https://example.com/plan.pdf",
  });
  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.externalSubmissionId, "grant-response-42");
  assert.equal(result.data?.documents[0]?.document_type, null);
});

test("derives a deterministic legacy-import identity across repeat imports", () => {
  const first = mapBusinessGrantRow(liveRow()).data;
  const second = mapBusinessGrantRow(
    liveRow({ [liveBusinessGrantHeaders.business_description]: "Updated source answer" }),
  ).data;
  assert.equal(first?.externalSubmissionId, second?.externalSubmissionId);
  assert.equal(second?.detail.business_description, "Updated source answer");
  assert.equal("review_status" in (second?.detail ?? {}), false);
  assert.equal("reviewer_comments" in (second?.detail ?? {}), false);
});

test("suggests exact live mappings while leaving applicant_name derived", () => {
  const mappings = suggestBusinessGrantMappings([
    liveBusinessGrantHeaders.submitted_at,
    liveBusinessGrantHeaders.applicant_first_name,
    liveBusinessGrantHeaders.applicant_middle_name,
    liveBusinessGrantHeaders.applicant_last_name,
    liveBusinessGrantHeaders.business_name,
  ]);
  assert.deepEqual(mappings, [
    { sourceColumn: "Timestamp", targetField: "submitted_at" },
    { sourceColumn: "Applicant First Name", targetField: "applicant_first_name" },
    { sourceColumn: "Applicant Middle Name", targetField: "applicant_middle_name" },
    { sourceColumn: "Applicant Last Name", targetField: "applicant_last_name" },
    { sourceColumn: "Business Name", targetField: "business_name" },
  ]);
});

test("suggests every live form header to its exact first-class target", () => {
  const entries = Object.entries(liveBusinessGrantHeaders);
  const mappings = suggestBusinessGrantMappings(entries.map(([, header]) => header));

  assert.equal(entries.length, 29);
  assert.deepEqual(
    new Map(mappings.map(({ sourceColumn, targetField }) => [sourceColumn, targetField])),
    new Map(entries.map(([targetField, sourceColumn]) => [sourceColumn, targetField])),
  );
  assert.equal(
    mappings.some(({ targetField }) => targetField === "applicant_name"),
    false,
  );
});

test("normalizes all live applicant-owned answers without review-owned fields", () => {
  const source = liveRow(
    Object.fromEntries(
      Object.entries(liveBusinessGrantHeaders).map(([target, header]) => [
        header,
        target === "submitted_at" ? "2026-08-20 10:30:00" : `${target} answer`,
      ]),
    ),
  );
  source[liveBusinessGrantHeaders.applicant_first_name] = "Ryan";
  source[liveBusinessGrantHeaders.applicant_middle_name] = "";
  source[liveBusinessGrantHeaders.applicant_last_name] = "Holmes";
  source[liveBusinessGrantHeaders.business_name] = "North Star Foods";
  source[liveBusinessGrantHeaders.lara_documentation] = "https://drive.google.com/lara";
  source[liveBusinessGrantHeaders.profit_loss_2024] = "https://drive.google.com/p-and-l-2024";
  source[liveBusinessGrantHeaders.profit_loss_2025] = "https://drive.google.com/p-and-l-2025";

  const result = mapBusinessGrantRow(source);

  assert.deepEqual(result.errors, []);
  assert.equal(result.data?.applicantName, "Ryan Holmes");
  assert.equal(result.data?.detail.why_grant_now, "why_grant_now answer");
  assert.equal(result.data?.detail.proposed_use_of_funds, "proposed_use_of_funds answer");
  assert.equal(result.data?.documents.length, 3);
  assert.equal("review_status" in (result.data?.detail ?? {}), false);
  assert.equal("reviewer_comments" in (result.data?.detail ?? {}), false);
  assert.deepEqual(result.data?.detail.raw_response, source);
});
