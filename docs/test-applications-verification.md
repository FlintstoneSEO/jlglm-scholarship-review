# Test Application verification

2026-10-06, branch `business-growth-grant-brand-refresh`. Initial implementation checks below were local. The hosted migration was subsequently applied with explicit user authorization; see the hosted verification below. No frontend deployment, email, imports or real assignment changes were performed.

## Hosted migration verification

Applied through the Supabase plugin to `jlglm-scholarship-review` (`vkbjvoltuecfvedhedbu`) on 2026-10-06; history records `20261006145039`, `test_applications`. The local migration filename matches that version. All prerequisite migrations were verified present by name, and live ranking, allocation and deactivation definitions matched the expected baseline.

- PASS: 80 applications remain: 40 real and 40 existing practice records marked `is_test=true`; no misclassified records.
- PASS: real application content, assignment and review counts and MD5 fingerprints match before/after (excluding the newly added flag).
- PASS: production views use `security_invoker=true`; operation events have RLS; anonymous RPC execution is revoked; authenticated RPCs retain explicit administrator checks and an empty search path.
- PASS: rollback-only calls without a user identity reject create, reset and delete with insufficient privilege.
- Security advisors add only the expected notices for the three intentionally callable, authorization-checked SECURITY DEFINER RPCs. Existing lifecycle/idempotency policy and password-protection notices remain unchanged.
- NEEDS MANUAL VALIDATION: authenticated provider/browser journeys, storage and concurrent writes. No new fictional applications were persisted during these checks.

## Implementation inventory

- Migration `20261006145039_test_applications.sql`: immutable shared `is_test`, deterministic practice backfill, source guard, security-invoker production scopes/ranking exclusion, real allocation-pool exclusion, authorized create/reset/delete RPCs, independent minimal operation events.
- `_app.testing.tsx`, shell and mobile navigation: active administered programs, fictional preview/creation, confirmation, assignment links, scoped test list, reset/delete confirmations and error recovery.
- `TestApplicationBadge`, `TestApplicationBanner`, `ApplicationScopeFilter`, `ApplicationDocumentLink`: shared identity, explicit list scopes and native sample-document navigation. Both queues/detail routes and assignment management consume the existing review architecture.
- Reporting consumers: Grant dashboard/queue default, Grant ranking service and pure projection; Scholarship dashboard, scoring summary, contact administration and MCP summary/list. Existing CSV import explicitly selects real records; database guards reject attempts to attach import identity or upsert a test's external ID.
- Test fixtures use native application content columns. Grant fixture covers business/financial/growth/use-of-funds/impact information and three sample documents; Scholarship includes fictional education and sample essay/transcript, using the existing editable 2027 cycle. Future programs reuse shared metadata/management and need their normal production content adapter; no new test review engine is required.

## Evidence

| Check | Result | Scope |
|---|---|---|
| Unit tests | PASS, 119 tests | Isolation helpers, extreme-score ranking/award invariance, existing review/navigation/import/auth regression coverage |
| New SQL behavior suite | PASS | Both programs' actual draft/submit RPCs, assigned/unassigned access, denied reviewer/other-program management, default real identity, immutable test identity, import upsert rejection, reset/repeated review, test-only deletion, conflict/replacement dependents, deactivated assignment cleanup, forced-delete rollback |
| Current SQL regression suites | PASS, 10 suites including the new suite | All migrations load; authorization, Scholarship transactions, rubric lifecycle, committee allocation, reviewer groups, practice/conflicts, deactivation, eligibility batch saves, account setup |
| TypeScript | PASS | Native application and generated route contracts |
| Scoped lint | PASS | Changed application source files |
| Production build | PASS | Local Vercel output; no deployment |
| Synthetic browser | PASS | Fictional APIs only: both program creation paths, optional-assignment links, reset/delete/cancel; 320/375/390/768/1024/1440 widths for creation, confirmation, list and reset dialog; no body/main/dialog horizontal overflow; scoped axe scan without violations |

Browser screenshots are in ignored `supabase/.temp/testing-browser/`. Local provider stubs and intercepted browser responses are separate evidence: SQL verifies database behavior in PGlite, while browser tests verify rendered UI. Neither proves hosted Supabase/PostgREST/auth/storage or real account behavior.

Two older suites, `phase_d_grant_transactional.sql` and `admin_review_reset_and_access.sql`, fail with `conflict_declaration_required` because their fixtures omit the existing required Grant declaration. The same failures were reproduced with this new migration excluded. They are pre-existing fixture incompatibilities, not PASS results. Current `grant_practice_sessions.sql` and the new suite cover normal Grant submission and conflict/replacement behavior under the current guards.

## Rendered review and refinements

Severity: low. Element: Testing confirmation assignment action. Viewport: 320px. Observed problem: combined assignment/view wording was unnecessarily long for a narrow action. Evidence: initial implementation had “Assign reviewers now / View Assignments.” Exact change: “Assign reviewers now,” keeping the established assignment destination. Reason: readable task action. Expected outcome: concise wrapped action group. Verification: confirmation screenshot and main-width check at all six widths, PASS.

Severity: low. Element: Testing buttons. Viewport: touch widths. Observed problem: default UI buttons were 36px high. Evidence: initial rendered Testing list. Exact change: scope 44px minimum height to Testing controls/dialog without changing unrelated button primitives. Reason: touch ergonomics. Expected outcome: usable touch targets. Verification: screenshots and scoped accessibility review, PASS.

## Release limitations and preservation

- Hosted migration is applied; deploy the matching frontend separately. Keep flags, guards and exclusions on rollback while tests exist. Real applications remain false; only explicit practice-session markers are backfilled true.
- Existing Grant practice round archive/reset behavior and assignment history remain. Per-application reset clears review state, not eligibility or assignment lifecycle; suspended/deactivated assignments remain suspended.
- Scholarship screening is still global-admin-only and 2026 remains historical/locked. Program admins can create/manage tests and inspect them; a global admin completes Scholarship screening. No authorization policy was widened.
- Deletion refuses uploaded private/discussion files until removed through existing document controls, avoiding orphaned storage. SQL deletion alone cannot atomically remove provider objects.
- No visible Test Connection action, live Sheets sync implementation or outbound export exists in this checkout. Connection verification wording is documented; CSV import is isolated. Any separately hosted sync service must honor the shared production scope and source guards before release.
- NEEDS MANUAL VALIDATION: hosted RLS/RPC exposure, real administrator/reviewer journeys, storage cleanup, concurrent writes, deployed responsive states and any external Sheets service. Local work does not claim production sign-off.

## Reproduction

Use `npm.cmd test`, `npx.cmd tsc --noEmit`, `npm.cmd run build` and the repository's scoped ESLint commands. The isolated SQL runner depends on the existing ignored PGlite installation under `supabase/.temp/committee-test/`:

```text
node supabase/tests/run-committee-local.mjs supabase/tests/test_applications.sql supabase/tests/multi_program_authorization.sql supabase/tests/phase_d_scholarship_transactional.sql supabase/tests/phase_d_rubric_lifecycle.sql supabase/tests/growth_grant_committee.sql supabase/tests/grant_reviewer_groups.sql supabase/tests/grant_practice_sessions.sql supabase/tests/admin_assignment_deactivation.sql supabase/tests/grant_eligibility_batch_save.sql supabase/tests/account_setup_lifecycle.sql
```

For UI checks, run the local development server at `127.0.0.1:5182`, then `node supabase/tests/test-applications-browser.mjs`. The existing ignored harness dependencies include Playwright and axe. All provider API calls are intercepted with fictional responses.
