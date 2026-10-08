# Business Growth Grant workflow fixes — October 8, 2026

Branch: `business-growth-grant-brand-refresh`. Inspected baseline: `6a58f0975dfe120acae06384cca3b15135535c54`. Scope: meeting corrections A–H, followed by Phase 3 regression testing. No deployment, production database mutation, invitation or email was performed. No applicant intake fields or follow-up tools were added.

## Phase 1: existing behavior and confirmed gaps

Read `AGENTS.md`, README, architecture audit, eligibility screening/refinement, conflict disclosure, distribution and rankings documentation against current components, helpers, migrations and tests. The architecture audit is historical; the current application uses React/TanStack Start, Query, Supabase and Vercel.

Already working: atomic eligibility saves with stale-version checks; all six approved verification keys; Eligible/Needs clarification/Ineligible decisions and required reasons; Save & next after any valid final decision, including clarification; private individual review/score RLS; admin conflict resolution/replacement; individual invitation/password setup; shared real/test review engine; submitted-review protection; partial/zero score persistence; active-assignment, completed-review ranking calculations and production/test isolation.

| Severity | Element / route / state                                            | Observed problem and evidence                                                                                                                                  | Exact correction, reason and expected outcome                                                                                                                                                                                                                                                             | Verification                                                                                                                                                                  |
| -------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High     | Grant detail, unsaved score/comment or save in flight; all widths  | `useBlocker` checked eligibility only. A section-unrelated route departure could discard competitive edits.                                                    | Extend the existing blocker to all unsaved/saving work, allow same-application section changes, and keep dirty drafts when background server versions change. Save with the originally hydrated version so stale edits are rejected.                                                                      | Navigation/hydration unit cases; transactional stale-version tests; authenticated browser interruption remains manual.                                                        |
| High     | Grant detail, score/document query failure; all widths             | Score query errors were discarded; document errors became an empty list. Cached data could remain visible after a failed refetch.                              | Fail closed on score/document/rubric load errors and evaluate error before rendering cached material. A failed load must not look like an empty, savable review.                                                                                                                                          | TypeScript/build and source trace; provider failure injection remains manual.                                                                                                 |
| High     | Assigned Grant reviewer after a new conflict; all widths           | Competitive writes were held, but `current_user_can_access_application` still authorized the active assignment.                                                | Extend that existing predicate to exclude the reviewer's unresolved disclosure. Application/detail/document/private storage policies inherit it. Remove cached material immediately after successful disclosure. Admins retain resolution access, and clearance/replacement use the existing audited RPC. | Isolated authenticated-role tests for header/detail/document/storage denial, clearance, peer continuity and replacement.                                                      |
| Medium   | `/grants` → detail → document → queue; all widths                  | Queue scope was local React state; practice links navigated away from the application; active workspace section was local state.                               | Store scope/section with existing URL filters; applicant remains in the path. Open all supporting resources separately. Reserve a private document window before asynchronous signing to avoid losing user activation; report failures. Screening entry always opens Overview.                            | URL parsing and document-window tests; local browser preserves filtered sign-in return URL. Applicant-document browser reproduction still requires nonproduction credentials. |
| Medium   | Grant Overview eligibility, incomplete source evidence; all widths | Business eligibility guidance did not name the location/history/revenue checks.                                                                                | Show the approved Tri-County, three-year and $20,000 checks, reported address/revenue, separate verification and notes, and clarification guidance. Keep all six persisted keys and human decisions.                                                                                                      | Requirement projection tests; no automatic eligibility calculation.                                                                                                           |
| Medium   | Random Allocation group selection/preview; all widths              | Duplicate group options remained selectable, balanced mode was not preselected, and two separate confirmations plus “Frozen preview” language added confusion. | Disable duplicate selections, default balanced allocation, consolidate identity/coverage confirmation at finalization, and label previews/finalized assignments plainly. Show total, available, excluded and unassigned counts, proposed per-group/per-reviewer counts and existing progress.             | Duplicate-choice unit tests, odd-count/exclusion/preservation SQL tests and existing frozen snapshot tests.                                                                   |
| High     | Grant rankings with unresolved conflict; all widths                | Completed reviews on active but held assignments could receive a final ranking before conflict resolution.                                                     | Treat held assignments as outstanding, withhold their scores from the current ranking projection, and show an explicit conflict hold. Clearing restores inclusion; replacing retains the old review but uses the replacement assignment.                                                                  | Lifecycle ranking test and conflict authorization fixtures. No persisted score/aggregate rewrite.                                                                             |
| Low      | Administrator rankings; all widths                                 | Only score range appeared; cached results lacked an explicit refresh action.                                                                                   | Add expandable completed totals, Refresh rankings and fresh loading on entry; invalidate ranking/queue caches after saves.                                                                                                                                                                                | Aggregation, incomplete-review, multiple-reviewer, funding-boundary and test-isolation tests. Authenticated update journey remains manual.                                    |

## Phase 2: A–H implementation and preservation

### A. Eligibility and progress

Retained the existing batch RPC, decision validation, notes, actor/time audit and optimistic concurrency. Clarification and Ineligible remain valid final decisions even with unresolved checks, each with the existing meaningful reason requirement. Save & next is already available for those decisions; no duplicate workflow was added. Save progress persists changed verification checks; unsaved final decision notes remain protected until explicitly confirmed. Expanded database checks verify saved clarification notes, verification answers/notes, and a documented Ineligible decision.

### B. Filters and navigation

Extended existing search parsing with real/test/all scope and active workspace section. Search, eligibility, scoring, LARA, operating model and age filters remain URL-backed; the current applicant remains the route parameter. All external PDF/spreadsheet links and practice documents open separately. Private signing reserves a window synchronously, clears its opener and closes it on error. The recent scroll-to-section behavior remains. No authenticated supporting-document reproduction was claimed.

### C. Verification presentation

Added the explicit approved business checks to the existing business verification item, plus reported business address and annual revenue in the summary. Source answers/document references remain unverified evidence. No requirements, schema keys, automatic disqualifications or applicant fields were added.

### D. Conflicts

Reporting after No Conflict already worked through `report_grant_conflict`; made that action easier to discover. The new migration closes the protected-material access gap. Existing write holds, audit records, administrator Needs Attention, candidate authorization, clearance and replacement remain. Existing submitted/draft records are retained. Already opened external Google Drive resources are controlled by that provider; existing signed URLs remain valid until their original expiry (currently 600 seconds). Portal authorization cannot revoke those previously issued capabilities. An administrator acting in their administrative role retains access to resolve the report.

### E. Reviewer access/testing

Kept individual invitation-only credentials and existing program/assignment RLS. `GuidedTesting` and Reviewer Assignments use the same `assignReviewer` client and native review engine. Test identity is the immutable `is_test` field, with visible labels and exclusion from live results. No Tony account was guessed, assigned, invited or emailed. Local role tests verify own/peer/cross-program boundaries; Tony's real account/setup is a manual release check.

### F. Scoring drafts

Kept one shared points/comments draft across Application and Rubric, partial/unscored/intentional-zero semantics, canonical transactional Save Draft and complete/certified submission checks. Added navigation/refresh protection, failed-load handling, original-version preservation and control disabling during saves. Submitted reviews remain read-only until an administrator explicitly reopens them. No rubric scale, criteria, weights, scoring calculation, thresholds or guidance changed.

### G. Random review distribution

Balanced random allocation remains server-owned. Duplicate groups are disabled in the selectors and rejected by server validation. Removed the preliminary identity checkbox; final confirmation combines identities, access, coverage and reviewers after the administrator sees the preview. Existing fixed-capacity mode remains advanced. New previews do not finalize assignments, and finalized allocations remain immutable/idempotent through the existing snapshot/apply logic. Manual conflict replacements remain available. Real distribution shows total applications, eligible/available, excluded and applications without active assignments; previews distinguish proposed coverage and available applications left unassigned, with exclusion reasons.

### H. Rankings and score visibility

Kept historical approved rubric-version validation, active assignments, valid completed scores, average of completed totals, tie handling, eligibility gates and existing funding categories. The production view and pure ranking helper both exclude tests. Private `program_reviews` and `review_scores` RLS continues to restrict individual reviewer scores to owner/admin; committee rankings remain admin-only in the route and database view. Added explicit unresolved-conflict hold, completed-total breakdown and refresh. Existing tests verify draft/reopened/suspended reviews do not contribute, missing/invalid scores cannot create final ranks, and completion of required submissions makes a ranking available. The approved 0–4 scale and existing weighted-point implementation were not altered.

## Phase 3: regression results

- PASS: library unit tests (157), including new document navigation, hydration/progress protection, duplicate-choice, presentation and conflict-ranking tests.
- PASS: TypeScript and changed-file ESLint.
- PASS: local Vercel/Nitro production build. Existing Rollup dependency annotation/chunk-size warnings are informational.
- PASS: all checked-in migrations apply to isolated PGlite PostgreSQL. Rollback-only suites: `grant_eligibility_batch_save`, `grant_conflict_resolution`, `grant_distribution_odd_counts`, `growth_grant_committee`, `grant_reviewer_groups`, `test_applications`, `phase_d_grant_transactional`, `phase_d_scholarship_transactional`, `multi_program_authorization`.
- PASS: synthetic role tests include denied peer review/score access, admin completed-score access, reviewer ranking denial, conflict document/private-storage denial and restoration, assignment preservation, 5-application 2/2/1 allocation, excluded unscreened/history records and idempotent finalization.
- PASS: local browser renders invitation-only Sign In and retains applicant/filter/scope/section in the protected `next` URL.
- NEEDS MANUAL VALIDATION: authenticated admin/reviewer journeys, actual PDF/spreadsheet return behavior, refresh/reopen in a browser, popup/failure states, keyboard/focus and responsive checks at 320/375/390/768/1024/1440px, provider RLS/storage/RPC behavior and multi-admin concurrency. The local browser has no authenticated nonproduction accounts. PGlite Auth/storage/crypto compatibility stubs do not establish live Supabase behavior.

## Database and deployment approval

Required local additive migration: `supabase/migrations/20261008160858_grant_workflow_access_safety.sql`. It replaces only the existing private access predicate; it has no applicant/eligibility/assignment/review/score DML, no backfill, no new exposed RPC and no scoring recalculation. Existing function privileges remain intact. All database fixtures execute only in the isolated harness and roll back. No claim is made about today's production counts/fingerprints.

Before production: obtain approval to apply this migration, compare live migration history/schema to the checked-in prerequisites, capture pre/post record counts/fingerprints, verify provider policies with approved accounts, then deploy the matching frontend only after approval. Restore the prior predicate definition from `20261006001032_grant_practice_and_conflict_resolution.sql` if rollback is needed; do not rerun that entire historical migration or delete disclosures/reviews. Revert the matching frontend separately. Security basis: [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Prince and Tony manual testing

Use an approved nonproduction environment with this migration and synthetic applications. Do not use production applicant/review records as fixtures. No automatic emails are needed.

1. Prince: select Needs screening, a search and scope; open an applicant. Record missing documentation with verification notes; choose Needs clarification, add a meaningful reason and Save & next. Confirm all answers/notes reload, the original leaves Needs screening, and the next applicant opens Overview with the same filters. Repeat Ineligible: short/missing reasons must be rejected and a valid reason must persist. Eligible requires all six checks.
2. Prince: from Overview and Documents, open PDF, spreadsheet and Michigan registry resources; return to the original tab. Confirm applicant, filter/search/scope/section and pending edits remain. Test a private document, blocked popup, signing denial, failed save and browser Back. Cancel leaving with unsaved edits, then save and leave safely.
3. Prince: choose three saved groups in Random Allocation; a selected group must be unavailable in the other selectors. Check balanced mode, total/available/excluded/unassigned counts, exclusion reasons and both reviewers for each application. For an odd eligible pool, group counts differ by at most one. Preview must create no assignments. Confirm only after review; reopening/new previews/retries must not alter finalized assignments. Test incomplete eligibility and existing historical assignments stay excluded.
4. Prince: verify Tony's exact existing account and Grant membership in Users & Access. Through Testing, create/select a clearly labeled synthetic Grant application and assign it to that confirmed reviewer. No live applicant changes, resets or automatic invitations. Confirm its scores never enter real rankings or funding decisions.
5. Tony: sign in with individual credentials; verify assigned-only application access and denied unassigned/cross-program URLs. Declare No Conflict, save partial scores/comments, switch Application sections and Rubric, refresh and reopen. Persisted drafts must reload; unsaved departure/refresh must warn; incomplete/unscored/certification-missing submission must remain blocked. Intentionally scored zero must persist.
6. Tony: after No Conflict, expand “Report a newly discovered conflict / view disclosure” and report a meaningful reason. Protected material/scoring must become unavailable. Prince: open Needs Attention, clear with a documented reason or replace with an eligible different reviewer. Verify audit history, original saved review/score retention, original access denial after replacement, new reviewer access and unaffected peer progress.
7. With two independent synthetic reviewers, finish all approved criteria and certify/submit. Prince: refresh rankings, compare persisted completed totals and arithmetic mean/funding category, expand score breakdown, and confirm outstanding submissions/held conflicts cannot receive final ranks. A reviewer must not access committee rankings or another reviewer's score rows. Reopening a review must return it to outstanding until resubmission.
8. Run the equivalent existing Scholarship draft/submit/assigned-access checks. Its components/scoring were not edited; the shared predicate retains its preliminary-screening/assignment branch.

## Changed files

- `src/components/review/GrantCommitteeAllocation.tsx`
- `src/components/review/GrantConflictDisclosure.tsx`
- `src/components/review/GrantOverview.tsx`
- `src/routes/_app.grants.index.tsx`
- `src/routes/_app.grants.$id.tsx`
- `src/routes/_app.grant-rankings.tsx`
- `src/lib/grant-screening.ts`, `src/lib/grant-screening.test.ts`
- `src/lib/grant-overview.ts`, `src/lib/grant-overview.test.ts`
- `src/lib/review-distribution.ts`, `src/lib/review-distribution.test.ts`
- `src/lib/grant-ranking-summary.ts`, `src/lib/grant-ranking-summary.test.ts`
- `src/lib/grant-document-navigation.ts`, `src/lib/grant-document-navigation.test.ts` (new)
- `src/lib/grant-workflow-state.ts`, `src/lib/grant-workflow-state.test.ts` (new)
- `supabase/migrations/20261008160858_grant_workflow_access_safety.sql` (new)
- `supabase/tests/grant_eligibility_batch_save.sql`
- `supabase/tests/grant_conflict_resolution.sql`
- `supabase/tests/grant_distribution_odd_counts.sql` (new)
- This report.
