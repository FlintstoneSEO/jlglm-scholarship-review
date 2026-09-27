# Phase D live verification and release status

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
