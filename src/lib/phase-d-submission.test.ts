import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ReviewSubmissionError,
  normalizeReviewSubmissionError,
  parseReviewSubmissionResult,
} from "./review-submission.ts";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260926120000_phase_d_review_submission.sql",
    import.meta.url,
  ),
  "utf8",
);
const scholarshipRoute = readFileSync(
  new URL("../routes/_app.applicants.$id.tsx", import.meta.url),
  "utf8",
);
const grantRoute = readFileSync(new URL("../routes/_app.grants.$id.tsx", import.meta.url), "utf8");
const mcp = readFileSync(new URL("./mcp/tools/submit-review.ts", import.meta.url), "utf8");
const auth = readFileSync(new URL("./auth-context.tsx", import.meta.url), "utf8");

test("submission result and stable database errors are typed", () => {
  assert.deepEqual(
    parseReviewSubmissionResult({
      reviewId: "r1",
      status: "submitted",
      savedAt: "2026-09-26T00:00:00Z",
      submittedAt: "2026-09-26T00:00:00Z",
      version: 2,
      replayed: true,
    }),
    {
      reviewId: "r1",
      status: "submitted",
      savedAt: "2026-09-26T00:00:00Z",
      submittedAt: "2026-09-26T00:00:00Z",
      version: 2,
      replayed: true,
    },
  );
  const error = normalizeReviewSubmissionError(
    new Error("review_submission:stale_rubric:Reload the active rubric"),
  );
  assert.ok(error instanceof ReviewSubmissionError);
  assert.equal(error.code, "stale_rubric");
  assert.equal(
    normalizeReviewSubmissionError(
      new Error(
        "review_submission:eligibility_locked:Competitive scoring is locked until eligibility is confirmed",
      ),
    ).code,
    "eligibility_locked",
  );
});

test("both browser routes and MCP use the canonical RPC boundary", () => {
  assert.match(scholarshipRoute, /createReviewWriteAdapter\(supabase, "scholarship"\)/);
  assert.doesNotMatch(scholarshipRoute, /from\("reviews"\)\.insert/);
  assert.match(grantRoute, /createReviewWriteAdapter\(supabase, "business_growth_grant"\)/);
  assert.doesNotMatch(grantRoute, /from\("review_scores"\)\.upsert/);
  assert.match(mcp, /rpc\("submit_scholarship_review"/);
  assert.doesNotMatch(mcp, /from\("reviews"\)\.insert/);
});

test("migration preserves history and enforces lifecycle, versions, rubric, and idempotency", () => {
  for (const expected of [
    "reviews_future_canonical_identity_key",
    "where canonical_identity",
    "assignment_lifecycle",
    "rubric_versions_one_active_per_program",
    "review_lifecycle_events",
    "review_idempotency_keys",
    "submit_scholarship_review",
    "submit_business_grant_review",
    "reopen_review",
    "stale_version",
    "stale_rubric",
    "already_submitted",
    "An active eligible assignment is required",
    "Final submission requires every active criterion exactly once",
    "revoke insert, update on public.reviews",
  ])
    assert.match(migration, new RegExp(expected));
  assert.doesNotMatch(migration, /delete from public\.reviews/i);
  assert.doesNotMatch(migration, /delete from public\.reviewer_assignments/i);
});

test("global admins receive all active programs without membership synthesis", () => {
  assert.match(auth, /nextRole === "admin"/);
  assert.match(auth, /\.eq\("active", true\)/);
  assert.match(auth, /id: `global:\$\{program\.id\}`/);
  assert.doesNotMatch(auth, /user_program_access"\)\.insert/);
});
