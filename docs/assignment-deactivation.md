# Assignment deactivation

Authorized scope: admin deactivation of assignments without current reviews, including assignments retained by review-reset history. Keep the existing visual system, routes, scoring, eligibility, roles, conflict resolution, and persisted reviews/audit records.

## Existing behavior and migration implications

`_app.assignments.tsx` deletes assignments after checking only current Grant reviews. `admin_review_reset_events.assignment_id` uses `ON DELETE RESTRICT`, so a reset leaves an apparently unused assignment that cannot be deleted. Scholarship reviews require a separate applicant/reviewer lookup. Active assignments control reviewer application access and workload; suspended assignments already exclude that access/workload. Scholarship eligibility transitions automatically reactivate suspended assignments.

Add nullable admin deactivation timestamp/actor fields; existing rows remain unchanged. Deactivation uses the existing suspended lifecycle and records who acted. A dedicated admin RPC rejects current reviews in either implementation and unresolved Grant conflicts. It locks application then assignment, matching competitive review insertion/conflict writes, and refreshes existing Grant totals without altering score semantics. Scholarship eligibility reactivation must skip explicitly deactivated assignments. The database must prevent reactivation or clearing the marker through ordinary assignment updates. No reviews, scores, reset events, users, applications, or assignments are deleted. This action does not replace conflict resolution or Reset Review.

The application/reviewer uniqueness constraint remains intact: deactivation does not permit another assignment for the same pair. Restoration of explicitly deactivated assignments is outside this increment.

## Screen specification

Retain the current assignments shell and responsive rows. For active assignments with no current review, replace the trash icon with a labeled Deactivate assignment button. Current reviews keep Reset Review and an explanation that deactivation requires clearing the current review first. Suspended historical assignments have no deactivation action. Show Deactivated by admin with its timestamp for explicitly deactivated rows, preserve their history, and exclude them from active workload totals using the existing lifecycle filters.

Use the existing accessible Dialog primitive: identify applicant and reviewer, explain loss of assignment access and active workload plus retained history, and offer Cancel / Deactivate assignment. Disable both actions during the request; retain the dialog on failure and report the database message. On success close it, refresh queries, and confirm deactivation. Keep touch targets and responsive button wrapping.

## Verification and release

Test permission denial for reviewers, viewers, other-program admins and anonymous callers; admin success despite restrictive reset-history FK; idempotent retry; current Grant/Scholarship review and conflict rejection; retained audit identity; automatic Scholarship reactivation skipping deactivated rows; ordinary-update reactivation guard. Run native unit tests, TypeScript, and production build. Record actual validation evidence below.

Apply the migration before deploying the matching UI. The user subsequently authorized applying this migration; application deployment remains pending. Browser and hosted-role checks remain separate from local SQL proof. To roll back the feature, cut UI callers back first; retain deactivation columns and rows so access/history remain consistent.

### Local evidence (2026-10-05)

- PASS: 106 native unit tests; TypeScript no-emit check; targeted ESLint; Vercel production build.
- PASS: all 28 checked-in migrations loaded in disposable PGlite PostgreSQL, then the rollback-only `supabase/tests/admin_assignment_deactivation.sql` assertions passed. The suite reproduces the original restrictive foreign-key error, tests success with retained reset history, idempotence, unauthorized callers, reviewer application-access loss, current Grant and Scholarship review rejection, unresolved conflict rejection, blocked direct marker writes/reactivation, automatic Scholarship eligibility transitions, retained history deletion protection, and a stale Scholarship review insertion after deactivation.
- Test-runtime boundary: provider Auth/Storage scaffolding and default table grants are supplied by `supabase/scripts/test-assignment-deactivation.mjs`; pgcrypto extension creation is skipped because this runtime does not provide it. No cryptographic operations are exercised. This is local database behavior proof, not hosted Supabase configuration, simultaneous-session, or browser proof. The test dependency was installed in a temporary directory; project dependencies and lockfiles are unchanged.
- NEEDS MANUAL VALIDATION: authenticated admin dialog keyboard/focus and responsive review; hosted roles/RLS and simultaneous submission/deactivation. Application deployment has not been performed.

### Hosted migration evidence (2026-10-05, America/New_York)

- Applied to confirmed project `jlglm-scholarship-review` (`vkbjvoltuecfvedhedbu`) through the Supabase migration tool. Recorded UTC version: `20261006020146`, name: `admin_assignment_deactivation`. The local filename and references match that recorded version.
- Preflight confirmed the existing Scholarship assignment function matches the inspected baseline and Grant totals/conflict prerequisites exist. The deactivation function was absent.
- PASS: function exists; both new fields and all three guard triggers exist; authenticated callers have EXECUTE, anonymous callers do not. An unauthenticated function call was rejected in a rolled-back transaction.
- Existing data counts are unchanged: one assignment, one reset audit event; zero assignments were deactivated by this schema migration. The actual applicant assignment was not modified.
- Security advisor delta: one expected warning for the new authenticated-callable SECURITY DEFINER RPC. It enforces program-admin access in its body and denies anonymous callers. See [Supabase RPC advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Pre-existing advisor findings were unchanged.
- Hosted fixture mutations and authenticated browser success checks were not run. The locally passed rollback suite remains separate evidence.

To repeat the isolated check, install `@electric-sql/pglite@0.5.3` in a temporary directory and run `node supabase/scripts/test-assignment-deactivation.mjs <absolute-path-to-pglite/dist/index.js>` from the repository root. The runner creates an in-memory database and closes it after the suite; it has no hosted-database connection.
