import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  grantDisplayRubricVersion,
  GRANT_REVIEWER_CERTIFICATION_VERSION,
} from "./grant-review-certification.ts";
import { createReviewWriteAdapter } from "./review-submission-client.ts";
import { normalizeReviewSubmissionError } from "./review-submission.ts";

const route = readFileSync(new URL("../routes/_app.grants.$id.tsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260928000000_grant_reviewer_certification.sql",
    import.meta.url,
  ),
  "utf8",
);

test("submitted historical review uses its own rubric; open review uses active rubric", () => {
  assert.equal(
    grantDisplayRubricVersion({ status: "completed", rubric_version_id: "old" }, "new"),
    "old",
  );
  assert.equal(
    grantDisplayRubricVersion({ status: "in_progress", rubric_version_id: "old" }, "new"),
    "new",
  );
  assert.match(route, /rubricVersion: displayRubricVersion/);
  assert.match(route, /historicalCriteria\.data/);
  assert.match(
    route,
    /submitted=\{review\?\.status === "completed"\}|const submitted = review\?\.status === "completed"/,
  );
});

test("Grant submit carries certification through canonical RPC; draft does not require it", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return {
        data: {
          reviewId: "review",
          status: "submitted",
          savedAt: "2026-09-27T00:00:00Z",
          submittedAt: null,
          version: 1,
        },
        error: null,
      };
    },
  };
  const adapter = createReviewWriteAdapter(client as never, "business_growth_grant");
  const input = {
    program: "business_growth_grant" as const,
    intent: "submit" as const,
    applicationId: "application",
    assignmentId: "assignment",
    rubricVersion: "rubric",
    criteria: [{ criterionId: "criterion", value: 0 }],
    idempotencyKey: "key",
    certificationVersion: GRANT_REVIEWER_CERTIFICATION_VERSION,
    certified: true,
  };
  await adapter.submit(input);
  await adapter.saveDraft({ ...input, certificationVersion: undefined, certified: undefined });
  assert.equal(calls[0]?.name, "submit_business_grant_review");
  assert.equal(calls[0]?.args.p_certification_version, GRANT_REVIEWER_CERTIFICATION_VERSION);
  assert.equal(calls[0]?.args.p_certified, true);
  assert.equal(calls[1]?.args.p_intent, "save_draft");
  assert.equal(calls[1]?.args.p_certified, undefined);
  assert.equal(
    normalizeReviewSubmissionError(
      new Error(
        "review_submission:certification_required:Reviewer certification is required before submission",
      ),
    ).code,
    "certification_required",
  );
});

test("certification is bound to submitted version and retained after reopen", () => {
  assert.match(migration, /unique \(program_review_id, review_version\)/);
  assert.match(
    migration,
    /values\(review\.id,v_program_id,actor,review\.version,p_certification_version\)/,
  );
  assert.match(migration, /p_intent='submit' and \(p_certified is not true/);
  assert.match(migration, /'certificationVersion',p_certification_version,'certified',p_certified/);
  assert.match(route, /setCertified\(false\)/);
  assert.match(route, /\.eq\("review_version", submittedReview\.version\)/);
});
