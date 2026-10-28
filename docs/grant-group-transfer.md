# Transfer a Grant application to another group

## Audit and authorized design — October 28, 2026

Baseline: fetched `origin/main` at `9357e64`. The original increment authorized local implementation and synthetic verification only; the subsequent October 28 instruction explicitly authorized applying the migration. It preserves the Concept B shell, tokens, Radix dialogs, routes, eligibility, rubric semantics, Scholarship engine and existing RLS read boundaries.

Verified owning sources: committee/group/practice/conflict/deactivation migrations, Phase D submission and idempotency functions, duplicate management migration, assignment summary RPC, Grant detail/queue/rankings, allocation progress and combined dashboard projections. Conflict resolution replaces one reviewer, suspends the original and excludes its score. Saved groups are mutable configurations; applied allocation JSON is frozen. Progress follows replacement chains from frozen reviewers. Assignment and review uniqueness is application/reviewer, not just active assignment. Scholarship shares assignment access but uses its separate legacy review submission and score model; this feature is Grant-only.

## Domain and migration decisions

Use a distinct immutable transfer event and an assignment `transferred_at` marker. Suspend departing active assignments and mark all earlier assignments as excluded transfer history, including previously suspended nonconflict assignments. Keep earlier suspension timestamps intact. Do not delete or rewrite reviews, scores, certifications, conflict declarations/reports/resolutions, audit events or frozen allocations. Transferred assignments can never be reactivated, moved or deleted. Destination identities recorded in transfer history cannot be moved or deleted; active assignment writes cannot add a third reviewer. Existing conflict replacement and unused-assignment deactivation protections still apply. Destination accounts must have no assignment of any lifecycle for this application. This deliberately rejects overlapping groups and active, suspended, deactivated and conflict-replaced collisions; safe reuse would require a separate assignment/review identity migration and is outside this increment. No fabricated conflict, deactivation, duplicate, eligibility change or review reset is recorded.

Require exactly two current active assignments, an active nonduplicate application, confirmed eligible status (an exception alone is insufficient), a different saved two-member group, available authorized accounts, no unresolved source conflict, no destination conflict history and current practice participants. A resolved earlier conflict is preserved and does not prevent transfer. Real/test/session/round identity stays on the same application. Only the selected application changes.

Database authorization precedes preview/read/commit. Confirmation serializes with group saves using the existing group/member then program-access lock order, then locks account and practice state and the application before assignments/reviews. Shared competitive write guards serialize on the application and reject transferred identities, including idempotency replay. A fresh preview contains affected assignment/review/score/certification/conflict state, eligibility, scope, group revision/member snapshot and current ownership. Commit recomputes it under locks and rejects changes. Actor/request UUID identifies retries; reusing it with changed parameters fails. Both departing suspensions, two fresh assignments, aggregate refresh and audit event commit together.

Active views omit transferred assignments/reviews; stored aggregate counts/scores omit transferred history. Base tables retain existing read policies. Current ownership is derived from the latest transfer event; allocation history stays frozen. Progress redirects the application's two slots to the destination group and follows subsequent conflict replacements. Manual assignments without an applied allocation receive one current transfer entry. Original allocation history remains separate.

## Incremental screen specification

Grant detail administrator controls gain “Transfer to another group.” Preserve existing shell and navigation: this is a focused workflow addition, not a visual redesign. Use a single scrollable Radix dialog with named current reviewers (including replacements), original/current group attribution, native labeled saved-group selection and a 10–4000 trimmed-character reason. Load fresh impact, list departing statuses and destination names, explain that prior scores leave current counts/rankings and destination reviews begin blank, then require explicit confirmation. Include loading, unavailable group explanations, no eligible groups, validation, stale preview, submission, retry and success states. Cancel/Back remain clear; prevent repeated submit; retain the request key across uncertain retries. Reuse focus containment/return, visible focus and minimum 44 CSS pixel controls. Names wrap at narrow widths. Assignment history shows transfer actor/time/reason only to admins; ordinary authorized readers get redacted transfer history. All prior transferred reviews are labeled excluded evidence.

## Release sequence

Apply the additive migration in an approved staging environment before the matching frontend. Verify actual Auth/PostgREST, distinct roles, RLS, provider versions and real device behavior there. Obtain separate authorization for hosted migration, production frontend release and any real transfer. Do not perform transfers during a mixed-version frontend rollout: older projections do not understand current transfer ownership. Roll back frontend only with transfer controls frozen; retain audit/markers/write protections and prefer a forward fix. No undo or assignment reuse is provided.

Migration: `supabase/migrations/20261028185053_grant_group_transfer.sql`, named by the repository's Supabase CLI. No data backfill or real transfer is included. Apply **all prior migrations and this migration before this frontend**. Releasing the frontend first will fail its new RPC/view contracts. The feature branch disables its Vercel automatic Git deployment, following the existing branch convention. The branch is pushed and draft PR #22 is open; the hosted migration is now applied as recorded below. The frontend has not been merged or deployed.

The existing `types.ts` uses generated-shape `TableDefinition` extensions; new event columns, assignment marker and RPC signatures follow that established format. No hosted schema/type introspection was used. Table/RPC access stays explicitly granted and protected by program-role checks, RLS and private helpers. The current [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security) was consulted for grants and security-invoker views.

## Verification — October 28, 2026

- **192 unit tests passed**, including frozen snapshot preservation, current destination group attribution, replacement chains after transfer, latest-transfer selection, overlapping snapshot deduplication, manually assigned work entering progress once and out-of-scope exclusion.
- **All 20 checked-in SQL suites passed** against disposable PGlite with every migration. Includes authorization, atomic rollback of both suspensions and both inserts, immutable history, direct-write protection, score exclusion/recount, old reviewer access/write rejection, unavailable accounts, all assignment collision lifecycles, eligibility/status/conflict restrictions, canonically trimmed reasons, idempotent retries, later transfers, real/test/practice/round boundaries and Scholarship regressions.
- **Complete transfer SQL suite passed on native PostgreSQL 18.4 (UTF8)**. Separate connections verified submission-first stale impact, transfer-first stale submission denial, and simultaneous identical transfer requests returning exactly one audit event. Tests wait for the actual database lock before releasing the winning transaction.
- **TypeScript, changed-source ESLint and production build passed**. Full `npm run lint` was run and fails on repository-wide CRLF/Prettier formatting and existing warnings. This feature's changed source passes its targeted lint. The build retains third-party directive/annotation and chunk-size warnings.
- **Synthetic browser transfer checks passed**: error/loading/retry/empty groups, reason validation, fresh impact, stale re-preview, explicit confirmation, pending-click prevention, uncertain outcome retry using the same request UUID, refreshed ownership/excluded history, reviewer action denial, focus containment/return and scoped WCAG AA axe checks. Reflow/screenshots cover 320, 375, 390, 768, 1024 and 1440 CSS pixels. Assignment-summary, duplicate-management and the standard reviewer browser regressions passed, including Scholarship tab retention and explicit draft save. Visual inspection of compact and desktop confirmation screens found readable wrapping and reachable actions in the existing design system.

All fixtures are fictional. Browser requests to external providers are blocked, including web fonts, so normal production font rendering remains a hosted check. Provider stand-ins do not verify actual Supabase Auth, PostgREST function exposure/schema cache, actual hosted RLS roles, private document provider access, or Vercel deployment. Verify those in an approved staging environment before release. The initial implementation performed no hosted migration; the subsequently authorized application and its verification are recorded below. No real transfer, merge or frontend deployment was performed.

### Hosted migration and PR follow-up — October 28, 2026

The user authorized checking draft PR #22 for review comments/failed checks and applying the migration. At head `f80d3a92936b618ee63778a8c10019678bd2c6e7`, GitHub returned no review threads, discussion comments, check runs or commit statuses. There were no reported review issues or failed checks to fix; absent checks are not a hosted CI pass.

The linked project was verified as `jlglm-scholarship-review` (`vkbjvoltuecfvedhedbu`, PostgreSQL 17.6). Prerequisite migrations were present, and normalized definitions of the five relevant existing private functions matched the disposable pre-transfer baseline. The transfer SQL suite was rerun locally and passed before applying the unchanged reviewed SQL.

Supabase recorded **`20261028192006`, `grant_group_transfer`**, for source file **`20261028185053_grant_group_transfer.sql`**. This management-API history timestamp differs from the source filename, as with several existing repository migrations. Treat this as the applied mapping; do not replay the source migration because its filename timestamp differs. Reviewed source SHA-256: `34B3D4B5E679B72DEE3B775FE384E06C7717BDB29349469FA598BBCE901B3C02`.

Post-application checks confirmed the new column/table, RLS enabled on the audit table, security-invoker public RPCs, denied anonymous RPC/table access, no authenticated direct audit mutation grant and retained security-invoker active views. Calls to all three RPCs as `authenticated` with no signed-in identity were denied by the database authorization guards. No identities or test application records were created in the hosted project.

Counts and full-row checksums matched before/after for applications, assignments (excluding the newly added null marker), reviews, scores, certifications, conflict reports/resolutions and frozen allocations. There are **zero transfer events and zero transferred assignments**. No existing application or review was changed. Real-role/browser/PostgREST end-to-end acceptance remains pending; these schema checks do not replace it.

Security advisor results were unchanged: 29 existing authenticated security-definer RPC warnings, two existing RLS-without-policy informational entries and the existing disabled leaked-password-protection warning. This migration introduced no new advisor findings. See [security-definer RPC guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS-without-policy guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [password-protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Keep PR #22 in draft. Frontend merge/deployment and any real transfer still require separate authorization. The migrated database must remain unused for real transfers during the mixed-version rollout.

### Reproduction

Use the repository Node/npm dependencies. Optional PGlite/Playwright/axe libraries live under ignored `supabase/.temp/committee-test` as in the duplicate-management guide.

```powershell
npm test
npx tsc --noEmit
$sqlSuites = Get-ChildItem supabase/tests/*.sql | ForEach-Object FullName
node supabase/tests/run-committee-local.mjs @sqlSuites
npm run build
```

For native tests, use a fresh empty **UTF8** PostgreSQL database on loopback with a name beginning `transfer_test_`. The runner creates provider stand-ins and applies migrations; never point it at a shared database. Set `TRANSFER_TEST_DATABASE_URL` to that disposable database and pass a local `pg` module path:

```powershell
node supabase/tests/transfer-concurrency.mjs C:/path/to/pg/lib/index.js
```

Start the app at port 4174 using `VITE_SUPABASE_URL=http://127.0.0.1:54329` and `VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-local-fixture-key`, then run:

```powershell
node supabase/tests/reviewer-usability-browser.mjs --transfers
node supabase/tests/reviewer-usability-browser.mjs --assignment-summary
node supabase/tests/reviewer-usability-browser.mjs --duplicates
```

Screenshots and logs are under ignored `supabase/.temp/reviewer-usability` and `supabase/.temp/transfer-*`. The browser harness blocks external hosts and does not use real credentials.
