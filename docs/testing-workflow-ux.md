# Testing and application-first assignments

## Current branch audit and authorization

2026-10-06, business-growth-grant-brand-refresh. User explicitly authorizes this workflow implementation. Baseline: 119 Node tests pass. README and architecture-audit describe older baselines; current code and migration 20261006145039 are authoritative for this change.

Testing already creates individual is_test applications using admin-gated create_test_application. Reset clears reviews/conflicts but retains eligibility and assignment lifecycle; delete refuses uploaded files and removes only test dependents. Historical Grant sessions have separate archive/reseed semantics. Scholarship uses legacy reviews with is_complete and Writing/Rhetoric; Grant uses assignment-linked program_reviews and rubric scores. Reporting uses production views and excludes is_test before aggregation. No changes to SQL, eligibility, lifecycle, rubric, scores, imports, roles, RLS or production data are authorized here.

Roles: program/global admins manage tests and assignments; reviewers use their own normal queue/workspace; viewers cannot manage tests. Database authorization remains authoritative. No impersonation or eligibility bypass.

## Findings

- Severity: high. Element: _app.assignments / GrantPracticeSessions. State: Grant admin. Problem: assignment page creates practice runs. Evidence: embedded GrantPracticeSessions calls start_grant_practice. Change: remove management from assignments; retain historical session management only in Testing. Reason: separate creation and assignment responsibilities. Outcome: no practice creator in assignments. Verification: source regression guard and authenticated browser journey.
- Severity: medium. Element: Testing assignment links. State: any test. Problem: scope-only links lose chosen application. Evidence: search has only scope. Change: URL-backed application and program selection, validated against loaded authorized applications. Reason: continuity. Outcome: chosen test opens with assigned reviewers. Verification: search parser/selection tests plus browser.
- Severity: medium. Element: Testing progress. State: Scholarship/Grant. Problem: only assignment counts are shown. Evidence: query omits reviews. Change: shared read model joins active assignments to native reviews. Reason: trustworthy completion. Outcome: started/completed counts and selected-reviewer completion. Verification: legacy/native/lifecycle/error fixtures.
- Severity: medium. Element: Help Guide. State: administrator testing. Problem: no dedicated testing instructions. Evidence: both section lists omit testing. Change: shared plain-language testing section and direct hash link. Reason: nontechnical task support. Outcome: ten questions answered in context. Verification: section/link tests and keyboard browser review.

## Preserve / improve / restructure

Preserve TanStack Start/React, existing shell/tokens/UI primitives, routes, assignments and saved group allocation, program-specific workspaces and persistence, TEST reporting exclusions. Improve labels, application selection and progress; restructure test controls into Testing. No replacement review engine. Generic reusable-agent snapshots are unchanged.

## Selected direction and screen specification

This is a task hierarchy and copy change within the authorized existing Phase E visual system, not a material visual-direction change. Preserve the administrator shell because program/role switching already matches these tasks; no new navigation destinations. User-requested IA: Testing owns creation/reset/delete; Reviewer Assignments owns application selection, reviewer assignment and retained administrative actions. Existing Grant group allocation remains available under a secondary disclosure.

Assignments: compact H1/purpose -> Real/Test filter (default Real) -> labelled application selector -> application name, program and TEST badge -> assigned reviewer rows with native progress/lifecycle -> add reviewer -> secondary workload/group/history. Query failure disables mutation and offers Retry; invalid deep link never silently selects another application. Mobile keeps identity and actions together with wrapping 44px targets.

Testing: compact H1 -> practice introduction + Start Guided Test + direct guide link -> program selector -> individual creation -> practice list with identity, program, reviewer names, assigned/started/completed counts and Open/Assign/Reset/Delete -> historical Grant session management under disclosure. Plain descriptions accompany destructive confirmation. All existing operations retained.

Guide: accessible Radix dialog, Step N of 5 and heading focus on progression. Select active administered program; explicit create via existing RPC; screening reminder/open normal application; select and assign actual authorized reviewer via normal assignment service; reviewer uses own queue; refresh/poll native review status, then show completed persisted score (no invented maximum). URL stores chosen test/reviewer to resume after leaving for screening or reviewing; no personal data in URL. Finish closes guide; reset uses existing confirmed operation and returns to review instructions with assignments retained. Errors remain visible; no success on failed/partial reads. No auto-verification of document readability, visual rubric correctness, draft reliability, queue visibility or real reporting behavior. Manual checklist covers those observations.

## Support and assumptions

No generic feedback/support storage exists. Review notes and contact logs are applicant-specific and unsuitable for product support. Document problem reporting as future work; tell testers to give the administrator the step, expected behavior, actual behavior and error message. Do not invent recipients or send messages.

Fictional display names normalize only known generated TEST prefixes and generic sample labels; preserve meaningful existing fictional business/person names. Stored data stays unchanged. Future program content still requires its production adapter. Hosted authenticated/RLS, mobile/keyboard and real submission QA require safe test accounts; local/source tests do not establish them.

## Final implementation and verification

Implemented on the current branch without a commit or deployment. Assignments has URL-backed Real/Test and application selection, application identity, assigned reviewers, Add Reviewer and secondary workload/group allocation. Practice creation and group reset/end now live only in Testing. Test review reset links back to Testing; real administrative review reset and audited assignment deactivation retain their existing behavior. Testing lists program, fictional name, creation time, reviewer identities and native started/completed counts. Existing group sessions remain available under an optional disclosure. Normal review queues and workspace headers use the same fictional display-name helper, without changing stored names or production identity.

GuidedTesting is a Radix dialog orchestration layer, not a review engine. It uses existing creation/reset/delete RPCs, a single shared normal assignment client, own-account queue links, and native progress reads. It supports multiple reviewers through Choose Another Reviewer. URL selection resumes the guide after screening/review navigation. Checklist observation and manual QA are explicitly separate. Failed reads never produce successful completion content. No SQL, RLS, database writes, credentials, package dependencies, scoring, review-save or submission functions changed during this implementation.

Help audit also corrected obsolete Scholarship documentation: fixed dashboard counts, fictional fixed reviewer roster, shared-account guidance, a legacy 100-point rubric, and claimed email-based import deduplication. The current UI uses Writing/Rhetoric 0-9 each, Save draft and Submit/Update Review; the current Scholarship CSV importer inserts applications rather than upserting by email.

### Files

- src/routes/_app.assignments.tsx: application-first assignment screen and selected-app progress/actions.
- src/routes/_app.testing.tsx: practice control center, contextual links and confirmed management actions.
- src/components/review/GuidedTesting.tsx: five-step tutorial and manual checklist.
- src/lib/use-testing-applications.ts: authorized test-only read model for native progress and reviewer names.
- src/lib/testing-workflow.ts and testing-workflow.test.ts: search, label, progress and shared assignment contracts/regressions.
- src/lib/reviewer-assignment-client.ts: normal assignment insertion shared by both entry points.
- src/components/review/ApplicationScopeFilter.tsx and TestApplicationBadge.tsx: plain filter and reusable TEST text.
- src/lib/review-queue-projections.ts; src/routes/_app.applicants.$id.tsx; src/routes/_app.grants.$id.tsx: consistent fictional display identity in queues/workspaces.
- src/components/help/TestingHelpContent.tsx; ScholarshipHelpGuide.tsx; BusinessGrowthGrantHelpGuide.tsx; src/lib/help-guide.test.ts: shared contextual help and current Scholarship instructions.
- docs/test-applications.md; docs/testing-workflow-ux.md; templates/design-decision-log.md: workflow, evidence and preservation choices.

### Results and evidence boundary

PASS: all 130 Node tests (119 baseline plus 11 added), TypeScript noEmit, ESLint on all changed TypeScript/TSX files, production Vite/Nitro/Vercel build, git diff whitespace validation. Tests include Real defaults, explicit Test selection, URL context, generated names, native/legacy completion, inactive assignment exclusion, score semantics, assignment error propagation, no creator in Assignments, contextual help and unchanged SQL isolation guards. Source policy assertions and reset projections are not live permission/reset execution.

NEEDS MANUAL VALIDATION: browser widths 320/375/390/768/1024/1440, keyboard/focus, actual program-admin/reviewer/viewer/unauthenticated access, create/screen/assign/draft/submit/refresh/reset/delete journeys, uploaded-file deletion denial, and real assignment/reporting regressions using safe fictional accounts. Browser inventory was empty; opening the local in-app browser returned Browser is not available: iab. Dev server successfully starts at http://127.0.0.1:8080, but this does not establish rendered or authenticated browser proof. Existing supabase/tests/test_applications.sql supplies transactional database fixtures; it was not rerun against a database in this task. No live provider or production mutations occurred.

Future support enhancement: agree on an existing organizational recipient/storage destination before adding Report a Problem. No support address or ticket infrastructure was invented. Manual checklist checks are temporary UI state, explicitly labelled; persisting an audit checklist is separate scope.
