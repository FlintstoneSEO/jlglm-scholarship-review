# Phase D live verification and release status

## Current release check — 2026-09-27, after main-database approval

The owner explicitly approved work on the main database. The SQL behavior suites used only new fixture identities and application IDs, each inside `BEGIN`/`ROLLBACK`. Failed trial runs also rolled back. A final inventory matched the pre-test baseline: one real Auth user, 20 portal applications and Grant details, one assignment and program membership, zero Scholarship applicants or review rows, two rubric versions, and two Scholarship criteria. No fixture or temporary Grant criterion remained. These tests simulate `authenticated` with `SET LOCAL ROLE` and `request.jwt.claim.sub`; they prove database behavior, not a real browser or JWT round trip.

### VERIFIED LIVE — migrations and security

| Live migration version | Repository source | Purpose |
|---|---|---|
| `20260927113550 phase_d_rubric_version_management` | `20260927030000_phase_d_rubric_version_management.sql` | Rubric lifecycle and RPC/helper grants |
| `20260927120049 revoke_scholarship_review_delete` | `20260927114210_revoke_scholarship_review_delete.sql` | Removes direct authenticated Scholarship review DELETE |
| `20260927120057 prevent_empty_grant_rubric_submission` | `20260927114530_prevent_empty_grant_rubric_submission.sql` | Requires a nonempty Grant rubric for final submit and casts the status enum correctly |
| `20260927120104 qualify_review_idempotency_digest` | `20260927115218_qualify_review_idempotency_digest.sql` | Resolves `pgcrypto`'s `extensions.digest` under the helper's empty search path |

The live migration versions differ from the repository filenames because they were applied directly through Supabase. All three follow-up migrations succeeded. The live catalog confirms the qualified digest, nonempty-rubric guard, enum cast, and revoked authenticated `DELETE` on `public.reviews`. Direct authenticated INSERT/UPDATE/DELETE remain revoked on `program_reviews` and `review_scores`. `review_lifecycle_events` and `review_idempotency_keys` retain RLS with no policies and no direct client table grants; they are RPC-internal. No policy was added to silence the advisor.

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

The live Grant rubric remains **active v1 with zero criteria**; the tests used rollback-only criteria. Scholarship v1 still has Writing and Rhetoric. **[NEEDS CLIENT INPUT: committee-approved Grant rubric criteria, descriptions, maximum point values, and display order if applicable.]** No Grant criterion was invented or retained.

`reviews.total_score` is a legacy generated field from the older five-category columns and stays zero for Writing/Rhetoric reviews. The Phase D Scholarship reviewer subtotal is `writing_score + rhetoric_score` (maximum 18); `applicants.total_score` sums completed reviewer subtotals. The transactional test verifies those effective values. Do not use the legacy `reviews.total_score` field to display the Phase D subtotal.

### VERIFIED FROM CODE / local checks

- `npx.cmd tsc --noEmit`: **PASS** after nine Phase D-related diagnostics were corrected.
- `npm.cmd test`: **PASS**, 36 unit tests.
- `npm.cmd run build`: **PASS** with the known esbuild parent-directory sandbox access; Vercel Nitro output generated. This is a local build, not deployed runtime proof.
- Targeted ESLint on review components/libraries, affected routes, `vite.config.ts`, and `src/routes/mcp.ts` with Prettier disabled: **zero errors**, four Fast Refresh warnings. Exact targeted lint reports 4,450 `prettier/prettier` findings; repository-wide CRLF/formatting cleanup is separate debt. `.vercel` is now ignored.
- Repository environment requirements: browser/build `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; SSR `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`; no `VITE_SUPABASE_SERVICE_ROLE_KEY`. **VERCEL DASHBOARD VALUES REQUIRE MANUAL CONFIRMATION.**

### Release decision

**Phase D functional implementation and database verification are COMPLETE for the tested paths.** The user-approved main-database rollback suite replaces the earlier unavailable disposable-database run for these scenarios. Phase E application design may be planned, but **Phase E branding/color implementation still requires separate approval** under `AGENTS.md`; no Phase E work began here.

**BLOCKS PRODUCTION RELEASE ONLY:** verify Vercel dashboard values and deployed browser/SSR sessions with real role tokens; perform the simultaneous-connection canonical race if required by release policy; configure the committee-approved Grant rubric before launching Grant final review; complete the live CSV/import and private external-document access checks in the README deployment checklist. These are not claims of current production behavior.

**NON-BLOCKING TECH DEBT:** repository-wide Prettier/CRLF findings, four Fast Refresh warnings, bundle-size warnings, and performance advisor findings without representative workload evidence. The current performance advisor still reports 23 unindexed foreign keys, the duplicate discussion-document index, two `user_roles` RLS init-plan warnings, and one multiple-permissive-policy warning. Defer speculative optimization. **CONFIGURATION INPUT:** Grant rubric and the separate Auth leaked-password-protection console setting.

---

## Prior checkpoint — before explicit main-database approval

The following section is retained as an **earlier observation**. Its statements that the three follow-up migrations were repository-only, behavior tests were unavailable, and Phase D was incomplete are superseded by the current release check above.

### Deployment and live security

- **VERIFIED LIVE:** Supabase migration history contains `20260927113550 phase_d_rubric_version_management`. This is the live application of repository source `supabase/migrations/20260927030000_phase_d_rubric_version_management.sql`; the version timestamps differ because the migration was applied directly to the project. The Phase D base migration `20260926120000 phase_d_review_submission` is also present.
- **VERIFIED LIVE:** `anon` and `authenticated` cannot execute `compute_review_subtotal`, `get_user_role`, `handle_new_user`, `recompute_applicant_score`, `rls_auto_enable`, or `touch_updated_at`. `anon` cannot execute `has_role`; `authenticated` retains it for existing role policies. The five application RPCs (`submit_scholarship_review`, `submit_business_grant_review`, `reopen_review`, `create_rubric_version`, `activate_rubric_version`) remain authenticated-only.
- **VERIFIED FROM CODE:** Those application RPCs derive `auth.uid()` and check actor, program, assignment or review state internally. Browser-supplied identity is not used as authorization. The six remaining authenticated `SECURITY DEFINER` advisor warnings are these five RPCs plus `has_role`; they are intentional public-schema execution surfaces and remain tracked, not suppressed. Behavioral role tests are still required.
- **VERIFIED LIVE:** `review_lifecycle_events` and `review_idempotency_keys` have RLS enabled, no policies, and no direct `anon` or `authenticated` table privileges. They are RPC-internal audit/idempotency tables. An admin audit-history UI would require a separate authorization design; no permissive SELECT policy is added.
- **VERIFIED LIVE:** `reviews` has an authenticated `DELETE` table grant but no DELETE RLS policy. No application route deletes reviews directly. `supabase/migrations/20260927114210_revoke_scholarship_review_delete.sql` is a new **repository-only** defense-in-depth revoke and is **not deployed**. `program_reviews` and `review_scores` already lack authenticated direct INSERT, UPDATE, and DELETE grants. The new revoke and its effective role behavior require migration release verification.
- **VERIFIED FROM CODE:** The deployed Grant submission RPC permits final submit of the zero-criterion active rubric when supplied `p_criteria` is an empty array: both sides of its exact-count comparison are zero. `supabase/migrations/20260927114530_prevent_empty_grant_rubric_submission.sql` adds an explicit nonempty active-criterion check to the same atomic RPC. This **repository-only** fix is **not deployed** and needs transactional verification before release.
- **VERIFIED LIVE:** The security advisor no longer reports anonymous `SECURITY DEFINER` exposure. Remaining findings are the six authenticated function warnings, the two policy-free internal tables, and [Leaked Password Protection Disabled](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The Auth setting is an admin-console recommendation, not a SQL change.

### Behavioral verification

The main database is **not disposable at this check**. A read-only count found 20 `portal_applications`, one `reviewer_assignments` row, and one `user_program_access` row, although the earlier inventory below found zero for each. Existing records may be operational data; no test fixtures were created and no existing row was changed. The one global admin now has a program-membership row, so the zero-membership case cannot be proved from current live data. **VERIFIED FROM CODE:** `src/lib/auth-context.tsx` loads all active programs for the global admin even if there are zero memberships, while other roles use their program memberships. A browser session and database role test remain pending.

**VERIFIED BY TEST:** The rollback-only assertions in `supabase/tests/phase_d_submission.sql` passed against live before the new DELETE assertion was added. They checked RLS, direct INSERT/UPDATE grants, RPC grants, canonical indexes, and current data invariants; they did not exercise lifecycle behavior. The existing `phase_d_rubric_lifecycle.sql` fixture was rejected by automatic approval review because its own instructions prohibit running it on live even with rollback. No workaround was attempted. An isolated migrated database is required for the fixture suite.

| Required behavior | Current result |
|---|---|
| Scholarship save, submit, lock, admin reopen, edit, resubmit; Writing/Rhetoric 0–9, subtotal /18, five-reviewer target; lifecycle events | **NOT VERIFIED BY DATABASE TEST**; SQL and application paths inspected only |
| Eligibility suspension, preserved records, restoration without duplicate assignment | **NOT VERIFIED BY DATABASE TEST** |
| 2027+ canonical Scholarship identity and duplicate/concurrent creation | Unique partial index **VERIFIED LIVE**; concurrency behavior **NOT TESTED** |
| Grant draft/clone/edit/activate, one active version, immutable history, empty-draft rejection | Migration and fixture **VERIFIED FROM CODE**; behavior **NOT TESTED** |
| Grant atomic draft/submit, invalid score rollback, exact criterion set, lock/reopen/resubmit | **NOT VERIFIED BY DATABASE TEST**; deployed empty-rubric final-submit defect found in code |
| Scholarship/Grant idempotency replay and conflicting payload | **NOT VERIFIED BY DATABASE TEST** |
| Stale review version and stale Grant rubric | Error branches **VERIFIED FROM CODE**; behavior **NOT TESTED** |
| Peer review, score, and comment isolation; admin and viewer role matrix | RLS policies **VERIFIED FROM CODE/CATALOG**; role behavior **NOT TESTED** |
| Global admin with zero memberships and program-admin scoping | Selector **VERIFIED FROM CODE**; zero-membership live case **NOT TESTED** |

The live Grant rubric remains active v1 with **zero criteria**, while Scholarship v1 has Writing and Rhetoric. No Grant criterion was invented or added. **[NEEDS CLIENT INPUT: approved Business Growth Grant rubric criteria, descriptions, maximum point values, and display order if applicable.]** The deployed RPC currently has the empty-rubric defect above; the new migration would make final submission require a populated active rubric. The committee configuration input alone does not block Phase E design work.

### Application and deployment checks

| Check | Result |
|---|---|
| `npx.cmd tsc --noEmit` | **PASS** after resolving nine queue, applicant, assignment, and Grant document callback diagnostics without broad `any` or suppressions |
| `npm.cmd test` | **PASS**, 36 tests |
| `npm.cmd run build` | **PASS** with sandbox access for esbuild's parent-directory probe; Vercel Nitro generated `.vercel/output/nitro.json` and server functions. This is a local Windows build, not deployed runtime proof. |
| Targeted ESLint on review components, domain libraries, affected routes, `vite.config.ts`, and `src/routes/mcp.ts` with the Prettier rule disabled | **PASS**, zero errors and four Fast Refresh warnings. The exact targeted lint run has 4,450 `prettier/prettier` findings caused largely by existing formatting/CRLF debt. `.vercel` is now excluded in `eslint.config.js`. Repository-wide formatting remains **DEFERRED TECH DEBT**. |
| Vercel environment | **REPOSITORY REQUIREMENTS VERIFIED:** browser/build `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`; SSR `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`. No `VITE_SUPABASE_SERVICE_ROLE_KEY`. **VERCEL DASHBOARD VALUES REQUIRE MANUAL CONFIRMATION.** |

**DEFERRED TECH DEBT:** The performance advisor reports 23 unindexed foreign keys, the duplicate Scholarship discussion-document index, two `user_roles` RLS init-plan warnings, and a multiple-permissive-policy warning on `user_roles`. The database has no representative review workload, so no speculative index or policy rewrite was made. These findings should be assessed against real query plans and access patterns. Existing bundle-size warnings likewise remain a performance follow-up.

### Exit decision

| Classification | Items |
|---|---|
| **BLOCKS PHASE E** | Phase D lifecycle, authorization, atomicity, and version behavior still lack database role/transaction tests in an isolated environment. The deployed Grant RPC has an empty-rubric final-submit defect, and its repair has not been verified or deployed. |
| **BLOCKS PRODUCTION RELEASE ONLY** | Apply and verify both new migrations, including the Scholarship DELETE revoke; confirm Vercel dashboard variables and deployed runtime; complete role-based and browser checks; configure approved Grant rubric before Grant review launch. |
| **NON-BLOCKING TECH DEBT** | Repository-wide Prettier/CRLF debt, Fast Refresh warnings, performance advisor findings without workload evidence, and bundle-size warnings. |
| **CONFIGURATION INPUT** | Committee-approved Grant rubric criteria, descriptions, maxima, and order; Auth leaked-password protection recommendation. |

**Phase D is not complete. Phase E is not authorized to begin under the current phase gate.** The rubric-management migration is live, local build and TypeScript gates pass, and the anonymous helper exposure is resolved. Isolated behavioral validation and both new migrations remain outstanding. No Phase E palette, token, or shell changes were made.

---

## Historical verification notes — 2026-09-26 and earlier 2026-09-27

The notes below are retained as **earlier observations**, not current migration, advisor, data, test, or release status. In particular, statements that `20260927030000_phase_d_rubric_version_management.sql` was pending were true when written and are superseded by the current release check above.

Checked: 2026-09-26 (America/New_York)

## Scope and deployment target

- Supabase project: `jlglm-scholarship-review` (`vkbjvoltuecfvedhedbu`), status `ACTIVE_HEALTHY`, PostgreSQL 17.6, region `us-west-2`.
- Application target: Vercel. `vercel.json` identifies TanStack Start and `vite.config.ts` sets Nitro to `vercel`.
- No Phase E palette, brand-token, or shell changes are included.
- Phase D migration `20260926120000_phase_d_review_submission` is present in the live migration history.
- New local migration `20260927030000_phase_d_rubric_version_management` is not yet deployed. Its deployment is held for disposable-database migration and behavioral verification.

## Live database inventory

**VERIFIED LIVE** using the connected Supabase project, migration listing, table inventory, read-only SQL catalog queries, and Supabase advisors:

| Data | Live count / state |
|---|---:|
| `applicants` | 0 |
| `reviews` | 0 |
| `portal_applications` | 0 |
| `reviewer_assignments` | 0 |
| `program_reviews` | 0 |
| `review_scores` | 0 |
| `review_lifecycle_events` | 0 |
| `review_idempotency_keys` | 0 |
| `user_program_access` | 0 |
| `user_roles` | 1 global admin |
| `rubric_versions` | 2, one active v1 per program |
| `rubric_criteria` | 2, Scholarship Writing and Rhetoric (9 points each); no Grant criteria |

Both programs are active. The zero Scholarship application/review counts confirm there is no 2026 data in this database to reconcile or migrate. They are consistent with the supplied fresh-database intent. The live database has not yet received applications, so its counts cannot prove that no external source retains historical records; no such import is part of this deployment request. The checked-in forward-only Scholarship canonical identity boundary remains the 2027+ path; no duplicate cleanup is required by this live inventory.

The single global admin and zero program-membership rows match the intended global-admin selector model. **VERIFIED FROM CODE:** `src/lib/auth-context.tsx` synthesizes active-program admin entries for that role without inserting `user_program_access` rows. A separate browser session test for this live user was not performed.

## Live security review

Catalog inspection confirmed RLS on the Phase D tables, own-review and admin-review read policies, own-score and admin-score visibility, active-assignment and Scholarship-eligibility predicates, storage access predicates for both private buckets, and `search_path = ''` on the public submission/reopen RPCs. The submission and reopen functions are `SECURITY DEFINER`, revoked from `PUBLIC` and `anon`, and executable by `authenticated`; this is intentional for the reviewed user-scoped transaction endpoints, which derive `auth.uid()` and validate role/assignment/application state internally. This catalog review is not a substitute for role-token behavioral tests.

The live catalog also exposed `DELETE` grants on `program_reviews` and `review_scores`. A reviewer policy permitted deletion of their score rows, which bypasses the intended atomic submission boundary. The new local migration revokes direct insert/update/delete from authenticated users on both tables; canonical SECURITY DEFINER RPCs continue to write as their owner. A test role request is still required after applying the migration. Code review also found PL/pgSQL ambiguity where `program_id` was both a local variable and column name in the submission/reopen functions. The local migration replaces those functions with qualified queries and `v_program_id`; runtime confirmation remains pending.

Supabase security advisors reported exposed SECURITY DEFINER functions, including the intended submit/reopen endpoints and trigger helpers, plus leaked-password protection disabled. The new migration revokes public execution of trigger-only helpers (`rls_auto_enable`, `touch_updated_at`, `compute_review_subtotal`, `handle_new_user`, and `recompute_applicant_score`) and the unused `get_user_role` endpoint; it revokes anon execution of `has_role` while retaining authenticated execution required by the existing `user_roles` policies. The new create/activate rubric RPCs are also authenticated SECURITY DEFINER endpoints and check the acting administrator and program in their bodies. After deployment, advisor warnings for the intentionally callable submit/reopen/has_role/rubric operations must be reviewed against these checks. The two audit tables have no policies, but direct client grants are revoked by the Phase D migration. Leaked-password protection is a project Auth setting outside this migration and remains an admin-console action.

### Security verification still required

- Run `supabase/tests/multi_program_authorization.sql`, `supabase/tests/phase_d_submission.sql`, and `supabase/tests/phase_d_rubric_lifecycle.sql` against a disposable migrated database.
- Exercise reviewer, viewer, program-admin, global-admin, and cross-program requests through authenticated database roles; the live project currently has no application/reviewer fixtures.
- After migration deployment, re-run security advisors and confirm no unintended `anon`/`PUBLIC` function execution or direct review/score write grant remains.

## Performance advisors

The live advisor reported 23 unindexed foreign keys, including a number on Phase D tables, two RLS init-plan warnings on `user_roles`, 12 unused indexes, one duplicate index pair on Scholarship discussion documents, and one multiple-permissive-policy warning on `user_roles`. Existing query-path indexes cover several reviewed Phase D lookups through leading columns or unique constraints (for example assignment identity, review-score identity, and idempotency key identity). No additional index was added from advisor output alone: the application/review tables are empty, so query volume and a production-like query plan are unavailable. Revisit Phase D foreign-key index findings with observed query plans and realistic data before adding indexes. Unused/duplicate index cleanup is outside this Phase D rubric fix.

## Rubric version management

**Implemented locally, pending disposable-database verification and deployment.** The rubric screen now lists active/draft/retired versions, criteria count, review usage, and read-only history. It supports a blank draft, cloning the active version, adding/toggling draft criteria, and explicit activation. Criteria clone rows retain name, description, maximum points, display order, and active state while receiving independent IDs.

Migration `20260927030000_phase_d_rubric_version_management.sql` uses the existing `active` and `retired_at` fields to represent the lifecycle: active, draft (`false`/`NULL`), and retired (`false`/timestamp). Version creation locks the program row, increments the program version number, and clones criteria in one RPC. Activation is a single authorized RPC that serializes on the program row, retires the prior active version, and activates one same-program draft. It rejects empty drafts. RLS and a locking trigger permit edits only to unused drafts and serialize criteria edits against activation; versions linked to reviews remain immutable. The one-active partial unique index remains the final database constraint.

The live Grant rubric is currently v1 with zero criteria. The original committee-approved Grant criteria and maxima are not present in this project. **[NEEDS CLIENT INPUT: committee-approved Business Growth Grant rubric criteria, descriptions, and maximum points.]** No criteria or scoring rules have been invented. New Grant final reviews remain unready until an authorized administrator configures the approved rubric.

The Grant submission RPC checks the active version before it accepts a submission, persists that rubric version on a newly created review, and rejects stale rubric submissions. The live project has no review rows, so the requested v1-to-v2 historical-retention submission sequence cannot be exercised live. It is included as a required disposable-database regression scenario, not reported as passed.

## Application and environment

- `vercel.json` and `nitro: { preset: "vercel" }` are retained.
- Browser build variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- SSR auth middleware runtime variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
- `SUPABASE_SERVICE_ROLE_KEY` is only for trusted server operations if they are actually added; it is never a `VITE_*` variable. The current `supabaseAdmin` module is not imported by application routes.
- The build configuration still contains the Cloudflare Vite plugin as existing build tooling and externalizes the optional `cloudflare:workers` probe from the Lovable MCP package. The active Nitro deployment preset is Vercel; no runtime migration to Cloudflare was made.
- Supabase migration history includes the historical Google Sheets source-metadata migration, but the current Grant workflow imports CSV. Repository runtime search found no service-account credential or scheduled Google Sheets sync runtime. Historical schema metadata and migration files remain for audit history.

## Checks and remaining release gates

| Check | Result |
|---|---|
| Live migration list / Phase D base migration | Verified present |
| Live fresh-data inventory | Verified: no application or review rows |
| Live RLS/function/policy catalog review | Read-only inspection complete; role behavioral checks pending |
| Security and performance advisors | Run; findings recorded above |
| Rubric version management | Implemented locally; not deployed |
| `npm test` | Pass: 36 unit tests |
| `npm run build` | Pass: Vercel Nitro output generated at `.vercel/output`; required sandbox escalation because the default sandbox blocked esbuild's parent-directory probe |
| `npm run lint` | Fail: 12,379 errors, overwhelmingly repository-wide CRLF/Prettier violations plus existing formatting issues |
| Targeted ESLint on changed TS/TSX files | Pass |
| `tsc --noEmit` | Fail on existing errors in queue projections, Scholarship queue/assignments, and the Grant document callback; no reported errors in the changed rubric route/types |
| Disposable database behavior tests | Pending; no disposable Supabase database has been provisioned in this session |
| Vercel deployment build and environment configuration | Local verification and dashboard confirmation pending |
| Live Grant committee rubric | Missing approved criteria; client input required |

Phase D is **not fully complete** and the repository is **not ready to start Phase E**. Release blockers are disposable-database lifecycle/RLS/RPC verification, the repository-wide lint/typecheck backlog, post-migration live advisor/catalog checks, production Vercel environment confirmation, and the approved Grant rubric criteria. No commit or database deployment was made.

## Release validation refresh (2026-09-27 America/New_York)

This refresh records checks performed against the current checkout and the connected live project. It did not modify the live database.

### Target and migration state

- **VERIFIED LIVE:** Supabase project `vkbjvoltuecfvedhedbu` is reachable, `ACTIVE_HEALTHY`, PostgreSQL 17.6.1, `us-west-2`.
- Live migration history contains `20260926120000_phase_d_review_submission`; it does **not** contain `20260927030000_phase_d_rubric_version_management`.
- The live schema already contains `rubric_versions`, `rubric_criteria.rubric_version_id`, and `program_reviews.rubric_version_id`, with one active v1 per program. This inventory does not prove the pending migration ran: its grants and trigger-helper revokes are absent, and no migration-history row records it.
- No Supabase development branches are currently provisioned. The local machine has neither the Supabase CLI executable nor Docker. No disposable database was available for the required migration and behavioral suite. The migration was therefore **not applied to live**.

### Live read-only security findings

- Authenticated direct `INSERT`/`UPDATE` privileges on `reviews`, `program_reviews`, and `review_scores` are false. Authenticated `DELETE` table privileges are true on all three. RLS currently has no `DELETE` policy on `reviews`; Grant `program_reviews` has an administrator-only delete policy; `review_scores` has a reviewer/admin delete policy. The pending migration revokes authenticated DML on Grant `program_reviews` and `review_scores`, but not on `reviews`. Consequently, the Scholarship delete boundary remains dependent on current RLS and should be reviewed as part of remediation; direct-write assertions must test effective role behavior, not table grants alone.
- The pending migration's helper-function revokes are not live. Current catalog confirms anonymous `EXECUTE` on SECURITY DEFINER helpers `compute_review_subtotal`, `handle_new_user`, `recompute_applicant_score`, `rls_auto_enable`, and `touch_updated_at`. Authenticated `EXECUTE` on those helpers and `get_user_role(uuid)` also remains. The intentional submission and reopen RPCs are executable by authenticated and not anon. These findings keep the live security gate **BLOCKED** until the migration is safely tested and deployed, followed by a fresh catalog/advisor review.
- Current security advisors still report the five anonymous SECURITY DEFINER helper exposures, authenticated SECURITY DEFINER warnings, two RLS-enabled audit tables without policies, and disabled leaked-password protection. No warning was dismissed. Leak-password protection requires a separate Auth setting change and remains an admin-console follow-up.
- Current performance advisors report 23 unindexed foreign keys plus the previously recorded init-plan, unused/duplicate index, and permissive-policy notices. No indexes were added because no realistic fixture/query-plan evidence is available. Reassess query-path-relevant findings with fixture data in a disposable environment.
- Current active rubric inventory: Scholarship v1 has two active criteria (Writing and Rhetoric); Grant v1 has zero active criteria. Grant remains intentionally unconfigured pending **[NEEDS CLIENT INPUT: approved Business Growth Grant rubric criteria, descriptions, and maximum points.]**

### Disposable behavior tests and fixture coverage

- Disposable environment: **unavailable**. No migration replay or disposable test users/applications/assignments were created. The SQL files in `supabase/tests/` were inspected but were **not executed**.
- Therefore Scholarship save/submit/reopen/resubmit, eligibility suspension/reactivation, canonical concurrency, Grant transaction and rollback, idempotency replay/conflict, stale review/rubric behavior, rubric clone/activation/immutability, role matrix, peer visibility, global-admin behavior, and authenticated bypass checks are **NOT VERIFIED** at the database behavioral layer.
- Live project has no disposable role fixtures. Existing live review/application data is not used for release testing. The global-admin selector behavior remains verified from code only; no browser session test was performed.

### Application and environment checks

- `npm.cmd test`: **PASS**, 36 tests.
- `npm.cmd run build`: **PASS** after sandbox execution was approved; Vercel Nitro output generated in `.vercel/output`. Build warns that some client chunks exceed 500 kB.
- `npx.cmd tsc --noEmit`: **FAIL**, 9 diagnostics in existing queue projections/tests, Scholarship applicant/assignment projections, and Grant document callback typing. No diagnostic points to the rubric-management route/types; this has not been established as a clean full-project typecheck.
- `npm.cmd run lint`: the exact command's first run overlapped the production build and failed while ESLint read a generated `.vercel/output` file that the build was replacing. A post-build exact rerun was stopped after prolonged scanning. Then `npm.cmd run lint -- --ignore-pattern .vercel` completed against the source tree and **FAILED** with 11,251 errors and 12 warnings. Most errors are CRLF/Prettier violations across existing files; at least `src/routes/mcp.ts` and `vite.config.ts` also have concrete formatting differences. The current ESLint ignore list excludes `dist`, `.output`, and `.vinxi`, but not `.vercel`; no lint configuration or source formatting was changed in this validation pass.
- `vercel.json`, `nitro: { preset: "vercel" }`, and documented browser/SSR environment variable names were verified in the repository. Vercel dashboard values are **NOT VERIFIED**. `SUPABASE_SERVICE_ROLE_KEY` is documented only as server-side and never as a `VITE_*` variable.

### Refreshed release decision

Phase D remains **NOT COMPLETE** and Phase E is **NOT READY TO BEGIN**. The mandatory disposable database is unavailable, the live migration is not deployed, live helper execution grants remain exposed, live security verification is not clean, role-based behavior is untested, Vercel dashboard values are unconfirmed, Grant criteria need client input, and full-project lint/typecheck gates have not passed. No migration, fixture, commit, UI redesign, or Phase E color/branding change was made.
