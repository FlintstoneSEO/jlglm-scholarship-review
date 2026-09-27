import assert from "node:assert/strict";
import test from "node:test";
import { grantOverviewRequirements } from "./grant-overview.ts";
import type { ReviewDocument } from "./review-domain.ts";

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
    ["owner", "business", "lara", "documentation", "profit-loss-2024", "profit-loss-2025"],
  );
  assert.ok(requirements.every((item) => item.status === "Missing"));
});

test("Grant overview distinguishes source answers, accessible documents, and human verification", () => {
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
  assert.equal(requirements[0].status, "Needs review");
  assert.equal(requirements[0].evidence, "Yes");
  assert.equal(requirements[1].status, "Needs review");
  assert.equal(requirements[2].documents[0], documents[0]);
  assert.equal(requirements[3].evidence, "2 supporting documents available");
  assert.equal(requirements[4].evidence, "Document available");
  assert.equal(requirements[5].status, "Missing");
  assert.ok(requirements.every((item) => item.verification.length > 0));
});
