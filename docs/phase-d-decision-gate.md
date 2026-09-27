# Phase D decision gate: review submission architecture

Decision date: 2026-09-26
Gate status: **PHASE D IMPLEMENTATION AUTHORIZED**

## Authorized scope

Phase D implementation is authorized only for the approved D1–D9 scope in `review-workflow-decisions.md`:

- shared typed submission contract;
- canonical Scholarship browser/MCP submission boundary;
- forward-looking 2027+ Scholarship identity enforcement while preserving 2026;
- submitted locks, explicit administrator reopen, versions, idempotency, and lifecycle audit events;
- Scholarship assignment suspension/reactivation and corresponding authorization enforcement;
- dynamic versioned Business Growth Grant rubrics and one atomic draft/final transaction;
- global-admin all-program selector behavior without synthetic membership rows;
- administrator-only individual peer-review visibility; and
- client adoption within the existing Phase C routes/workspace.

This gate **does not authorize** Phase E colors/branding, a route/navigation redesign, changed scoring semantics, changed Scholarship reviewer counts, automatic historical reconciliation, deletion of historical rows, or unrelated RLS expansion.

## Approved decision summary

| Decision | Approved rule | Migration / implementation consequence | Required evidence |
|---|---|---|---|
| D1 | Reviewer lock after submit; explicit audited admin reopen | Add versions/audit and enforce lifecycle in canonical functions/RLS | Post-submit denial, admin reopen, resubmit, audit actor/time |
| D2 | Preserve 2026; canonical unique identity for 2027+ | Partial forward-looking uniqueness; no automatic duplicate repair | Live duplicate report and concurrency tests |
| D3 | Suspend access on ineligibility; preserve artifacts; reactivate without duplication | Assignment lifecycle plus authorization/policy changes | Before/suspended/restored role matrix and preserved counts |
| D4 | Grant draft and submit use one transaction | Authorized RPC, idempotency, version checks, rollback | Failure injection/retry/conflict/aggregate tests |
| D5 | Exactly 5 reviewers; `/18` each and `/90` combined | Preserve triggers/math; flag assignment anomalies | Four/five/over-five and total tests |
| D6 | Dynamic immutable rubric versions | Version tables/links; stale-rubric rejection | Arbitrary rubric and historical-retention tests |
| D7 | Global admins see all programs; program admins stay membership-scoped | Selector synthesis only; no membership provisioning | Zero-membership global-admin and cross-role tests |
| D8 | Named peer rows/comments are admin-only | Tighten direct-read policies and client queries | Direct authorization matrix |
| D9 | Preserve Phase C workspace/routes | Adapter-only route changes; no redesign | Phase C regression suite |

## Read-only preflight status

**Status update (2026-09-26):** The Supabase connection became available after this initial baseline was written. The read-only live inventory, migration state, policies, function grants, and advisor results are now recorded in [`phase-d-live-verification.md`](phase-d-live-verification.md). The live project has zero applicant/application/review rows; review/score DELETE grants were found and are removed by the new local Phase D security migration. The role-based behavior gate remains pending against a disposable database.

**VERIFIED FROM CODE — NOT VERIFIED LIVE.**

No Supabase URL, PostgreSQL connection string, or safe connected target was present in this environment on 2026-09-26, so `phase-d-read-only-inventory.sql` was not run against a live database. The checked-in code/migrations establish the following only:

- legacy Scholarship browser and MCP writers are independent read-then-write paths;
- the legacy Scholarship table has no checked-in global `(applicant_id, reviewer_id)` uniqueness;
- Scholarship aggregation counts completed rows and retains fixed-five `/90` semantics;
- the Grant browser currently performs review, score, and status writes separately;
- Grant review identity and review-score identity constraints exist;
- checked-in Grant criteria are dynamic, but not version-bound; and
- checked-in policies require tightening for submitted locks, suspended assignments, and peer-row visibility.

Before deployment, an authorized operator must run `docs/phase-d-read-only-inventory.sql` and review: applied migrations, Scholarship duplicate pairs, unlinked applicants, assignment-count discrepancies, Grant orphan reviews/scores, current Grant rubric rows, memberships, draft/submitted counts, and live policy/function definitions.

## Migration safety gate

Implementation may be prepared and tested locally. Deployment is blocked only where live facts are required:

1. archive the live read-only inventory output;
2. compare live schema/policies/functions to checked-in migrations;
3. manually disposition any materially consequential 2026 duplicate—never delete, merge, or pick the latest automatically;
4. confirm deterministic rubric-version backfill inputs without changing criteria/maxima;
5. take a database backup and exercise migrations/RPC/RLS on a production-like copy;
6. verify row counts, Scholarship `/18` and `/90`, Grant totals/averages, and lifecycle counts before/after; and
7. cut clients over only after database functions/policies are deployed.

Rollback must disable new writers first and preserve lifecycle events, idempotency records, rubric versions, review rows, and historical artifacts. No rollback may reinterpret scores or delete history.

## Gate conclusion

The recorded decisions satisfy the Phase D architecture gate. Phase D implementation is authorized for the exact scope above. Live inventory and production-like RLS/RPC verification remain release prerequisites, not permission to invent or destructively reconcile data.
