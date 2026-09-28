# Current Phase D Status

**Phases A–D are complete. Phase D functional implementation and database behavior are verified for the tested paths. Phase E visual-system implementation is authorized and underway.** The production release follow-ups below do not block Phase E. Earlier incomplete/blocked checkpoints are preserved in [the archive](archive/phase-d-pre-verification-checkpoint.md).

## Verified state — 2026-09-27, after main-database approval

The owner explicitly approved work on the main database. The SQL behavior suites used only new fixture identities and application IDs, each inside `BEGIN`/`ROLLBACK`. Failed trial runs also rolled back. A final inventory matched the pre-test baseline: one real Auth user, 20 portal applications and Grant details, one assignment and program membership, zero Scholarship applicants or review rows, two rubric versions, and two Scholarship criteria. No fixture or temporary Grant criterion remained. These tests simulate `authenticated` with `SET LOCAL ROLE` and `request.jwt.claim.sub`; they prove database behavior, not a real browser or JWT round trip.

### VERIFIED LIVE — migrations and security

| Live migration version | Repository source | Purpose |
|---|---|---|
| `20260927113550 phase_d_rubric_version_management` | `20260927113550_phase_d_rubric_version_management.sql` | Rubric lifecycle and RPC/helper grants |
| `20260927120049 revoke_scholarship_review_delete` | `20260927120049_revoke_scholarship_review_delete.sql` | Removes direct authenticated Scholarship review DELETE |
| `20260927120057 prevent_empty_grant_rubric_submission` | `20260927120057_prevent_empty_grant_rubric_submission.sql` | Requires a nonempty Grant rubric for final submit and casts the status enum correctly |
| `20260927120104 qualify_review_idempotency_digest` | `20260927120104_qualify_review_idempotency_digest.sql` | Resolves `pgcrypto`'s `extensions.digest` under the helper's empty search path |

The repository filenames were reconciled with the live migration versions during Grant Rubric Phase 6; see [the reconciliation record](grant-rubric-summary-phase-6.md). All three follow-up migrations succeeded. The live catalog confirms the qualified digest, nonempty-rubric guard, enum cast, and revoked authenticated `DELETE` on `public.reviews`. Direct authenticated INSERT/UPDATE/DELETE remain revoked on `program_reviews` and `review_scores`. `review_lifecycle_events` and `review_idempotency_keys` retain RLS with no policies and no direct client table grants; they are RPC-internal. No policy was added to silence the advisor.

The post-deployment security advisor has no anonymous SECURITY DEFINER exposure. Its remaining notices are six intentional authenticated functions (the five application RPCs and `has_role`), the two policy-free RPC-internal tables, and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The application RPCs derive `auth.uid()` and enforce actor/program/assignment checks; the role simulations below exercised allow and deny paths. Keep these findings visible. Password protection is an Auth console recommendation. No serious Phase D database authorization defect remains in the tested paths.

### VERIFIED BY TEST — rolled-back main-database fixtures

| Suite / behavior | Result |
|---|---|
| `phase_d_submission.sql`, `multi_program_authorization.sql` | **PASS:** RLS, direct-write boundaries, RPC grants, indexes, schema invariants |
| `phase_d_rubric_lifecycle.sql` | **PASS:** Grant v1 to draft, clone with independent criterion ID, edit draft, activate one version, retire and preserve v1, active immutability, reject empty draft activation. The fixture now accepts an RLS-denied zero-row update as immutability and checks the row remained unchanged. |
| `phase_d_scholarship_transactional.sql` | **PASS:** 2027 eligible assignment, draft, submit, reviewer lock, reviewer reopen denial, program-admin reopen, edit, resubmit; score limits and Writing/Rhetoric subtotal 18, completed-score applicant aggregate, five-reviewer presentation target unchanged in code; lifecycle events present. |
| Eligibility | **PASS:** global-admin screening change suspended both assignments, removed reviewer access, retained review/note/discussion-document metadata, then restored the same assignment rows and access. |
| Canonical identity | **PASS:** one canonical review per reviewer/applicant and duplicate INSERT rejected by the unique index. A simultaneous two-connection race was not run; the unique index is the database concurrency backstop. |
| Scholarship idempotency/stale version | **PASS:** identical replay, changed-payload conflict, no duplicate review, and stale-version rejection. |
| `phase_d_grant_transactional.sql` | **PASS:** empty active rubric rejects final submit; temporary populated version supports atomic draft, score, comments, rubric binding, idempotency record, final submit, lock, admin reopen, resubmit. Invalid/missing/out-of-range scores leave no partial review or score state. |
| Grant idempotency/stale version/stale rubric | **PASS:** identical replay, changed-payload conflict, stale-version rejection, stale v1 rejection, and a review bound to a retired rubric rejects remapping after a new version activates. Historical score binding remains unchanged. |
| Peer and role isolation | **PASS at the database role layer:** reviewers see only their own Scholarship and Grant reviews/scores; viewer sees no individual reviews/scores; program admin sees both; scholarship-only reviewer cannot see the Grant application. A fixture global admin with zero membership rows accessed the active Scholarship program. Browser selector behavior remains verified from code. |

The committee-approved Grant rubric was configured on 2026-09-27 through the existing version lifecycle. **Live v2 is active with seven criteria, ordered maxima 15, 15, 15, 20, 15, 10, 10, and a 100-point total.** The prior empty v1 is retired and preserved. The configuration transaction is recorded in `supabase/scripts/configure_approved_grant_rubric.sql`. Scholarship v1 still has Writing and Rhetoric. The earlier rollback-only tests remain separate evidence; the new active v2 has not yet had a real browser reviewer submission.

`reviews.total_score` is a legacy generated field from the older five-category columns and stays zero for Writing/Rhetoric reviews. The Phase D Scholarship reviewer subtotal is `writing_score + rhetoric_score` (maximum 18); `applicants.total_score` sums completed reviewer subtotals. The transactional test verifies those effective values. Do not use the legacy `reviews.total_score` field to display the Phase D subtotal.

### VERIFIED FROM CODE / local checks

- `npx.cmd tsc --noEmit`: **PASS** after nine Phase D-related diagnostics were corrected.
- `npm.cmd test`: **PASS**, 36 unit tests.
- `npm.cmd run build`: **PASS** with the known esbuild parent-directory sandbox access; Vercel Nitro output generated. This is a local build, not deployed runtime proof.
- Targeted ESLint on review components/libraries, affected routes, `vite.config.ts`, and `src/routes/mcp.ts` with Prettier disabled: **zero errors**, four Fast Refresh warnings. Exact targeted lint reports 4,450 `prettier/prettier` findings; repository-wide CRLF/formatting cleanup is separate debt. `.vercel` is now ignored.
- Repository environment requirements: browser/build `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; SSR `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; no `VITE_SUPABASE_SERVICE_ROLE_KEY`. **VERCEL DASHBOARD VALUES REQUIRE MANUAL CONFIRMATION.**

## Production Release Follow-Ups

The user-approved main-database rollback suite replaces the earlier unavailable disposable-database run for the tested scenarios. It does not prove browser sessions, deployed runtime configuration, or simultaneous connection behavior.

- Verify Vercel dashboard values and deployed browser/SSR sessions with real role tokens.
- Perform the simultaneous-connection canonical race if required by release policy.
- Verify the newly configured Grant v2 in the deployed reviewer UI and complete an authorized real-role browser review before launch. The local UI changes in this pass are not a deployment claim.
- Complete the live CSV/import and private external-document access checks in the README deployment checklist.
- Review the separate Auth leaked-password-protection console setting.

## Deferred Technical Debt

- Repository-wide Prettier/CRLF findings and four Fast Refresh warnings.
- Bundle-size warnings.
- Performance advisor findings without representative workload evidence: 23 unindexed foreign keys, the duplicate discussion-document index, two `user_roles` RLS init-plan warnings, and one multiple-permissive-policy warning. Assess against real workloads before optimizing.
