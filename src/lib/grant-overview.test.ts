import assert from "node:assert/strict";
import test from "node:test";
import { grantOverviewRequirements } from "./grant-overview.ts";
import type { ReviewDocument } from "./review-domain.ts";
import {
  grantRequirementStatusLabel,
  grantEligibilityStatusLabel,
} from "./grant-eligibility-display.ts";

const document = (
  kind: string,
  url: string | null = "https://example.org/document",
): ReviewDocument => ({
  id: kind,
  label: kind,
  kind,
  source: "external",
  url,
  storagePath: null,
});

test("Grant overview retains all six eligibility requirements in review order", () => {
  const requirements = grantOverviewRequirements(
    {
      descendant_eligibility: null,
      eligibility_answers: {},
      lara_status: null,
      lara_explanation: null,
    },
    [],
  );
  assert.deepEqual(
    requirements.map((item) => item.id),
    [
      "owner_eligibility",
      "business_eligibility",
      "lara_good_standing",
      "required_documentation",
      "profit_loss_2024",
      "profit_loss_2025",
    ],
  );
  assert.ok(requirements.every((item) => !("status" in item)));
});

test("Grant overview distinguishes source answers, document references, and human verification", () => {
  const documents = [
    document("lara_documentation"),
    document("profit_loss_2024"),
    document("profit_loss_2025", null),
  ];
  const requirements = grantOverviewRequirements(
    {
      descendant_eligibility: "Yes",
      eligibility_answers: { business: "Yes" },
      lara_status: "Yes",
      lara_explanation: null,
    },
    documents,
  );
  assert.equal(requirements[0].evidence, "Yes");
  assert.equal(requirements[1].evidence, '{"business":"Yes"}');
  assert.equal(requirements[2].documents[0], documents[0]);
  assert.equal(requirements[3].evidence, "2 supporting documents referenced");
  assert.equal(requirements[4].evidence, "Document reference present");
  assert.equal(requirements[5].evidence, "No referenced 2025 P&L in the record");
  assert.ok(requirements.every((item) => item.verification.length > 0));
});

test("saved verification and final eligibility have distinct labels from source evidence", () => {
  assert.equal(grantRequirementStatusLabel.verified, "Verified");
  assert.equal(grantRequirementStatusLabel.pending, "Pending verification");
  assert.equal(grantEligibilityStatusLabel.eligible, "Eligible");
});

test("business verification states the approved location, history and revenue checks without deciding eligibility", () => {
  const requirement = grantOverviewRequirements(
    {
      descendant_eligibility: null,
      eligibility_answers: {},
      lara_status: null,
      lara_explanation: null,
    },
    [],
  ).find((item) => item.id === "business_eligibility")!;
  for (const text of ["Tri-County", "three years", "$20,000", "Needs clarification"])
    assert.ok(requirement.verification.includes(text));
  assert.equal(requirement.evidence, "No eligibility answers in the record");
  assert.equal("status" in requirement, false);
});
test("triage never converts a submitted answer or document reference into verification", () => {
  const requirements = grantOverviewRequirements(
    {
      descendant_eligibility: " ",
      eligibility_answers: {},
      lara_status: "Yes",
      lara_explanation: null,
    },
    [document("lara_documentation")],
  );
  assert.match(requirements[0].triage ?? "", /Missing submitted/);
  assert.match(requirements[1].triage ?? "", /Missing submitted/);
  assert.equal(requirements[2].triage, undefined);
  assert.match(requirements[4].triage ?? "", /Missing supporting-document reference/);
  assert.ok(requirements.every((r) => !("status" in r)));
  assert.match(requirements[2].verification, /response alone is not proof/);
});
