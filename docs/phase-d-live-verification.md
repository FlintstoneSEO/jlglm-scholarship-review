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
