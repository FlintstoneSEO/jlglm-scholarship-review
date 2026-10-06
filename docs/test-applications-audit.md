# Test applications: audit and implementation boundary

Code audit, 2026-10-06; branch `business-growth-grant-brand-refresh`, initially clean. README and architecture audit were checked against current migrations and routes. Hosted schema/data have not been inspected or changed.

## Existing behavior

- Grant practice sessions create 40 shared `portal_applications` with explicit `practice_session_id`/round, Grant detail rows and fictional documents. Existing normal assignments, eligibility screening, conflict declarations, rubrics, drafts and submissions apply. Reset archives assignments and seeds another round; it does not clear an individual application's reviews. No Scholarship test generator or general `is_test` exists.
- Practice identity is immutable and RLS restricts sessions to admins/participants plus normal assignment checks. Rank view, Grant queue/dashboard and ranking route filter on the session marker. Scholarship dashboards, rankings, contact lists and MCP summaries currently read legacy applicants/reviews without test filtering. No outbound Sheets export exists in this checkout; source configuration tables exist but the current import UI is CSV upload. No visible Test Connection action exists to rename.
- Imports match program/external IDs. Scholarship trigger links legacy applicants to shared headers and automatically assigns eligible applications to all Scholarship reviewers. Preserve this assignment rule, screening and the distinct Scholarship sum/Grant average semantics.
- Review reset RPC clears individual reviews and dependencies, preserves assignments and audits identity. Deletion is complicated by restrictive references in lifecycle events, reset history, conflict reports/resolutions/declarations, and assignment-deactivation guards. Storage discussion copies are separate objects; deletion must refuse applications with stored uploads rather than orphan files.
- Existing practice markers are deterministic evidence of fictional data. Only those rows are backfilled as tests. No name/email/ID inference and no changes to production reviews, IDs or assignments.

## Authorized implementation and screen specification

Preserve TanStack/React, roles, RLS, existing review adapters/workspaces and program content. Improve test metadata and isolation; add one Testing route in the existing administrator shell. No unrelated redesign or visual direction change. Future programs reuse metadata, isolation and management; program content adapters still need actual schemas/workspaces, just as production does.

Admin journey: Testing → select an active administered program → preview clearly fictional schema-native data → create → optional existing assignment screen → open normal application. Screening remains explicit, so creation confirmation says Pending screening rather than claiming readiness. Reset confirms clearing drafts, scores, comments, certifications, request keys and conflict declarations/reports; retains application, eligibility and assignments including suspension/deactivation history. Delete confirms and removes only the application's dependents in one database transaction, with independent minimal operation audit. Existing practice round reset remains available and retains its historical meaning.

Testing composition: compact H1 and purpose/exclusion explanation; primary Create Test Application button; inline creation form with labelled program selection and sample preview; confirmation with Open, View Assignments and Create Another; list of tests with status, assignment counts and explicit reset/delete buttons. Loading, empty, errors and denied states are visible. Existing Card/Button/Select/Dialog/Badge primitives; no new visual system. Mobile actions wrap and rows stack with 44px targets; dialogs fit viewport and use native Radix focus management. Real/All/Test filters in both application lists default to Real for admins; reviewer queues include authorized tests. All selected test records carry TEST badge and workspace banner.

## Isolation and migration implications

Add immutable `portal_applications.is_test boolean not null default false`. Existing deterministic practice rows become true; future practice inserts are marked automatically. Security-invoker production views centralize default reporting boundaries for shared applications, legacy applicants and legacy reviews. Ranking view filters before ranking. Test source IDs must be null and external IDs immutable, so CSV/Sheets upserts cannot relabel or overwrite them. Real allocation pools exclude tests; individual assignments remain normal.

Deploy migration before frontend. Rollback frontend is safe; retain metadata, reporting exclusions and guards while test records exist. Dropping the column/views would allow tests into results and is not a safe rollback. Apply/test only in an isolated database here; production migration and deployment remain separately authorized operations.

## Issues

Severity: high. Element: Scholarship reporting routes/MCP. State: newly introduced tests. Problem: unfiltered legacy reads could affect totals/ranks. Evidence: `_app.index.tsx`, `_app.top.tsx`, `review-progress.ts`. Change: production views and default scopes. Reason: isolate fictional results. Outcome: extreme test scores leave real results unchanged. Verification: SQL fixtures plus route consumer audit.

Severity: medium. Element: Grant practice management. State: admin creation/reset. Problem: session-wide 40-record creation and archive/reseed are unsuitable for single-application testing. Evidence: `start_grant_practice`/`reset_grant_practice`. Change: shared Testing route and test-only RPCs; preserve existing session history. Reason: understandable repeatable individual testing. Outcome: no manual record manipulation. Verification: permission/reset/delete SQL and rendered workflow checks.
