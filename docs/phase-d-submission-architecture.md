# Phase D submission architecture preparation

Date: 2026-09-26  
Status: conceptual design only; blocked by the Phase D decision gate.

## Preservation boundaries

This proposal does not change current writes. It preserves legacy Scholarship rows and score semantics (Writing 0–9, Rhetoric 0–9, subtotal /18, five completed reviews, aggregate /90), the MCP `submit_review` capability, Grant `program_reviews` and `review_scores`, arbitrary active Grant criteria/maxima, per-review totals, and completed-review averages. Program-specific math remains adapter-owned.

## Shared contract

A shared orchestration contract should express lifecycle intent and concurrency, not calculate program scores:

```ts
type ReviewProgram = "scholarship" | "business_growth_grant";
type ReviewSubmissionIntent = "save_draft" | "submit";

type CriterionSubmission = {
  criterionId: string;
  value: number;
};

type ReviewSubmissionInput = {
  intent: ReviewSubmissionIntent;
  program: ReviewProgram;
  applicationId: string;
  assignmentId: string;
  reviewerId: string; // asserted for correlation; server derives and verifies the actor
  reviewId?: string;
  currentVersion?: number;
  rubricVersion?: string;
  criteria: CriterionSubmission[];
  comments?: string;
  idempotencyKey: string;
};

type ReviewSubmissionResult = {
  reviewId: string;
  status: "in_progress" | "submitted";
  savedAt: string;
  submittedAt: string | null;
  version: number;
  replayed: boolean;
};

type ReviewSubmissionErrorCode =
  | "validation"
  | "authorization"
  | "conflict"
  | "stale_version"
  | "stale_rubric"
  | "already_submitted"
  | "unavailable"
  | "transaction_failure";

type ReviewSubmissionError = {
  code: ReviewSubmissionErrorCode;
  message: string;
  fieldErrors?: Record<string, string>;
  currentVersion?: number;
};
```

The authenticated boundary must derive the actor from the session rather than trust `reviewerId`. `applicationId`, `assignmentId`, and any `reviewId` must all describe the same program/reviewer relationship. An idempotency replay returns the original accepted result; reuse of the same key with different content returns `conflict`.

## Adapter boundary

```ts
interface ReviewWriteAdapter {
  saveDraft(input: ReviewSubmissionInput): Promise<ReviewSubmissionResult>;
  submit(input: ReviewSubmissionInput): Promise<ReviewSubmissionResult>;
}
```

- **ScholarshipReviewWriteAdapter:** maps criterion IDs to legacy Writing/Rhetoric fields, validates integer 0–9, preserves reviewer subtotal /18 and five-review aggregate /90, and calls the eventual shared authorized Scholarship write boundary.
- **BusinessGrantReviewWriteAdapter:** loads the authoritative active/versioned rubric, validates an exact criterion set and each configured maximum, persists normalized score rows, and calls the Grant transaction boundary.
- Neither adapter shares storage SQL or score math. Both share error/result semantics, actor/assignment checks, version preconditions, and idempotency expectations.

No TypeScript interface or adapter is added in Phase D preparation because doing so could be mistaken for an authorized alternate writer before lifecycle decisions are approved.

## Scholarship write architecture

### Target boundary

Both the browser route and MCP `submit_review` should call one server-authorized database function/RPC (or a server endpoint that delegates immediately to that function) using the caller JWT. Postgres is the preferred canonical concurrency boundary because uniqueness, RLS-visible identity, score triggers, and both entry points converge there.

Conceptual sequence:

1. derive `auth.uid()`;
2. verify the applicant/application link, program, active assignment, and D3 eligibility state;
3. validate exactly Writing and Rhetoric integers from 0 through 9;
4. claim/check idempotency key;
5. lock/find the canonical reviewer/applicant review;
6. compare `currentVersion`;
7. enforce the approved D1 state transition;
8. write score fields, notes, completion state, and timestamps;
9. let one approved aggregate implementation recompute completed sum/count;
10. record history only if the approved lifecycle requires it;
11. commit and return the canonical row/version.

### Identity and historical data

D2 and live inventory must precede uniqueness. A future migration may add a unique `(applicant_id, reviewer_id)` constraint only after null-reviewer and duplicate conflicts are reported and resolved by an approved reconciliation artifact. Legacy source rows must not be deleted, merged, or reinterpreted automatically. The migration should fail closed when unresolved conflicts remain.

### Browser/MCP parity

The browser can continue to offer draft and submit intents. MCP currently represents final submission only; it should retain that capability and call the same boundary with `intent: "submit"`. The same D1, D2, D3, version, and idempotency rules must apply. MCP tool annotations should claim idempotency only when the boundary actually enforces it.

## Business Grant transaction

A security-definer Postgres RPC can provide a single native Supabase transaction, provided it uses a fixed empty `search_path`, fully qualified objects, explicit grants, and internal actor/role checks. RLS remains defense in depth for direct table access; the function must not bypass business authorization merely because it can bypass policies.

```text
BEGIN (implicit RPC transaction)
  derive actor and validate idempotency payload
  verify program membership/capability
  verify assignment belongs to actor, application, and program
  lock assignment/canonical review
  validate application availability
  load and lock/verify authoritative rubric version
  validate exact active criterion set, numeric values, and maxima
  create or find the one canonical review
  compare current review version and approved D1 state
  replace/upsert the complete criterion set
  save reviewer comments
  compute/reconcile per-review total from authoritative rows
  transition status for save_draft or submit
  update submitted timestamp according to D1
  recompute application completed count/average/status
  record idempotency result (and approved audit event, if required)
COMMIT
on any error: ROLLBACK
```

Do not retain multiple independent browser writes for final submission after this boundary is approved. Drafts should use the same atomic boundary unless D4 explicitly approves a different one.

## Idempotency and conflict model

- **Double click:** UI disables the local action; the same idempotency key makes the second request a replay.
- **Network retry:** same key and payload returns the stored result, including review/version.
- **Refresh during save:** client reloads canonical state; retry is safe if it retained the key, otherwise version/identity still prevents duplication.
- **Concurrent tabs:** optimistic `currentVersion` plus a row lock means one succeeds and the stale writer receives `stale_version`.
- **MCP/browser concurrency:** database uniqueness and the same locked Scholarship boundary prevent two canonical rows; versions resolve conflicting content.
- **Stale criteria:** Grant sends/derives a rubric version; mismatch returns `stale_rubric` before any score write.
- **Previously submitted:** behavior follows approved D1; return a stable `already_submitted`, replay result, or approved reopen path—never infer it.
- **Key retention:** scope keys to actor/program/application/intent, store a request hash and result, and approve a retention interval before implementation.

## Audit history decision

An audit table is not authorized. It becomes required if D1 permits reopen or post-submit changes and the project needs to distinguish original submission from later edits. Candidate events are created, draft_saved, submitted, reopened, and changed_after_submission with actor, time, previous/new state, version, and request correlation. Immutable submission may still warrant a submitted event, but existing timestamps might suffice if the project explicitly approves that level of evidence.

## RLS design (proposal only)

No policy is changed now. After decisions:

- deny or permit owner updates based on D1 at the database boundary;
- make eligibility/assignment lifecycle part of Scholarship application, review, note/contact, discussion-document, and storage access under D3;
- keep Grant review and score access constrained to the assigned reviewer or approved program/global admin;
- validate that an RPC caller has the same or narrower effective permission than direct RLS;
- separate peer-row visibility from aggregate/count visibility under D8.

Required role matrix: global admin, program admin, assigned reviewer, unassigned reviewer, viewer, no-access authenticated user, anonymous user, and a user assigned only to another program. Test SELECT/INSERT/UPDATE and RPC execution, not merely rendered controls.

## Migration plan (not authored or approved)

1. **Inventory/preflight:** execute the read-only inventory, archive results, and stop on duplicates, orphan links, assignment discrepancies, invalid scores, or unknown live policies.
2. **Decision/reconciliation artifact:** record approved D1–D8 rules and an explicit disposition for every Scholarship duplicate.
3. **Additive foundations:** if approved, add versions, rubric snapshot/version references, idempotency storage, assignment lifecycle, and/or history without changing old meanings.
4. **Backfill:** populate only values supported by deterministic, approved rules; emit conflicts instead of guessing.
5. **Constraints/functions:** add canonical uniqueness and transactional functions only after preflight proves readiness.
6. **Policy transition:** apply approved RLS/function grants and execute the complete authorization matrix.
7. **Writer cutover:** update browser and MCP to the shared Scholarship boundary and Grant browser to its RPC.
8. **Postflight:** compare row counts, totals, /90 Scholarship aggregates, Grant totals/averages, and lifecycle counts.
9. **Retire old paths:** only after observability and rollback window succeed.

There is no proposed destructive migration and no migration file in this phase.

## Rollback strategy

- Take a database backup and export preflight/reconciliation mappings before migration.
- Prefer additive columns/functions and preserve original rows.
- Deploy new functions before switching callers; use a controlled feature flag/cutover.
- Roll back callers first, then grants/policies/functions only if old writers remain schema-compatible.
- Never roll back by deleting history, idempotency records, duplicate source rows, or score rows.
- If a postflight invariant fails, disable the new submission entry point, preserve evidence, restore from backup only under an approved incident procedure, and reconcile aggregates without changing source score meaning.

## Test plan

### Scholarship

- first draft creates one canonical review;
- repeated draft updates it and advances version once per distinct accepted request;
- submit applies approved D1 timestamps/state;
- duplicate concurrent submit produces one review;
- browser and MCP concurrency produces one identity and deterministic conflict/replay;
- post-submit score/comment changes follow D1 exactly;
- five completed reviews trigger completion, while four do not;
- historical duplicates fail preflight and exercise each approved reconciliation fixture;
- each subtotal remains /18 and the completed five-review aggregate remains /90;
- eligibility revoke/re-enable follows D3 for review, note, contact, and document access.

### Business Grant

- draft atomically persists review/comments/all criterion scores;
- submit atomically transitions and recomputes totals/average;
- injected failure after every stage rolls back every stage;
- retry with the same key replays; changed payload with that key conflicts;
- duplicate submit does not duplicate review or score rows;
- missing, extra, inactive, cross-program, negative, or over-maximum criteria fail;
- arbitrary criterion count and decimal configured maxima remain supported;
- stale review and rubric versions return typed errors without mutation;
- unauthorized or mismatched assignment fails;
- completed-review average includes exactly the approved completed set.

### Authorization

For global admin, program admin, assigned reviewer, unassigned reviewer, viewer, no-access user, anonymous user, and cross-program user: exercise direct table reads/writes, RPC calls, reopened/final states, eligibility transitions, peer rows, aggregates, and storage objects.

### Phase C regression

- Scholarship: Notes, Contact, discussion documents, admin comparison, queue-relative previous/next, applicant/admin header actions, and fixed rubric remain present.
- Grant: dynamic rubric, business application content, external/private documents, comments, subtotal, and completed-average context remain present.
- Shared workspace: one Scholarship navigation/header layer, identity/program/status/progress, section keyboard path, and no horizontal overflow at required widths.

## Exact decisions still required

1. D1 option plus score/comment/timestamp/history/reopen/aggregate details.
2. D2 canonical identity rule plus per-duplicate reconciliation rule.
3. D3 access and retention behavior for every listed artifact and re-eligibility.
4. D4 exact draft/final transaction, retry, idempotency, stale-version, and partial-row recovery semantics.
5. D5 fixed-five confirmation or a separately scoped configurable design.
6. D6 approved Grant criteria and rubric version/change semantics.
7. D7 global/program admin entry and membership model before access changes.
8. D8 named/anonymized peer visibility and timing.
9. D9 approved navigation/screen specification before later UI/navigation work.

Phase E brand/color work is outside this document and has not started.
