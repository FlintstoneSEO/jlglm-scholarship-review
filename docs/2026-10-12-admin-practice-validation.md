# Administrator conflict resolution and practice validation

Date: 2026-10-12. Local fixtures only; no deployment, hosted migration, account, real review or assignment changes. Existing working-tree changes were preserved. No scoring, eligibility, assignment, authorization or database semantics changed.

## Fixed issues

### 1. Repeated resolution after success

- Severity: medium.
- Element/file: `src/components/review/GrantConflictResolution.tsx`.
- Route/state: administrator Review Distribution → Needs Attention; successful clear/replace, including a subsequent parent refresh failure.
- Observed problem: after a successful RPC the still-mounted form allowed another resolution; the callback shared the write-error catch, so a failed refresh could imply that the resolution itself failed.
- Evidence: successful synthetic RPC retained the report in the fixture response; inspection showed no success guard and `await onResolved()` inside the write catch.
- Exact recommended change (implemented): lock the decision/reason/replacement and Record resolution after success; isolate refresh failure and offer Retry refresh without another resolution write.
- Reason: administrators need an accurate distinction between a recorded decision and stale list data.
- Expected outcome: a recorded resolution cannot be submitted again from the same mounted form; refresh retry performs reads only.
- Verification method: browser checks failed-write input retention, successful clear/replace messages, disabled Record resolution after success, exact RPC arguments and write count. The callback-rejection/retry branch is code-reviewed; browser fixtures do not force React Query invalidation to reject.

### 2. Practice navigation led to the wrong task/scope

- Severity: medium.
- Element/file: `GrantPracticeSessions.tsx`, `src/routes/_app.grants.$id.tsx`.
- Route/state: Testing → selected practice run; practice workspace administrator/reviewer.
- Observed problem: setup referred to allocation/assignment controls “below” that Testing does not render. The workspace sent everyone to `/assignments` with its real default scope, including reviewers without administrator access.
- Evidence: Testing renders practice controls without an allocation component; the original workspace link had no role distinction or search scope.
- Exact recommended change (implemented): direct setup to Testing screening and Reviewer Assignments test scope; add Assign practice reviewers with `scope=test`. Send administrators back to Testing and reviewers back to Applications test scope.
- Reason: practice must stay distinguishable from real review work and destinations must fit the caller's role.
- Expected outcome: administrators can find practice setup/assignment tasks; reviewer navigation retains test scope.
- Verification method: browser asserts administrator workspace destination and test-scoped assignment URL; reviewer branch verified in source. Full group-allocation UI remains outside this follow-up; SQL validates the existing practice allocation RPC.

### 3. Document-read failure looked like an empty document list

- Severity: medium.
- Element/file: `src/routes/_app.grants.$id.tsx`.
- Route/state: practice or real Grant workspace, supporting-document read error.
- Observed problem: document query errors were ignored and projected to `[]`; otherwise-cleared readiness could still say Ready to score. Query failures without data were also labeled unavailable before the error branch.
- Evidence: missing `documentResult.error` check in the parallel-read query; synthetic rejected document response.
- Exact recommended change (implemented): propagate document-read errors and render the existing load-error state before the no-data state.
- Reason: an unavailable evidence read must not appear to be a successfully loaded empty set.
- Expected outcome: load failure prevents misleading readiness; successful recovery restores normal review controls without changing document requirements or score gates.
- Verification method: synthetic read rejection displays “We could not load this application,” removes Ready to score, then recovery opens the fictional 2024 P&L and returns to the application.

## PASS — local evidence

- All checked-in migrations applied to an isolated in-memory PGlite database. `grant_conflict_resolution.sql`, `grant_practice_sessions.sql`, `grant_reviewer_certification.sql` and `grant_eligibility_screening.sql` pass. Practice fixtures now use the seven criteria/maxima in checked-in guidance: 15/15/15/20/15/10/10. Certification fixtures create their own rubric and record required reviewer/admin declarations rather than assuming hosted setup. Transactions roll back.
- SQL covers authorized candidates and rejected peers/banned accounts, original score/history exclusion, unaffected partner continuity/privacy, replacement declaration, 40-record practice rounds, real/practice isolation, failed reset rollback, stale-round rejection, reset/end archival and certification/eligibility rules. PGlite uses local Auth/Storage shims; this is not hosted Supabase proof.
- Administrator synthetic browser mode passes prerequisites, trimmed reason minimum, empty/failed candidate reads, clear without replacement, rejected-write retention, clear/replace result feedback and duplicate prevention.
- Practice browser mode passes reset cancellation, reset with current round, end with updated round, start requiring two participants, administrator without assignment, missing declaration/rubric, eligibility blocking and explicit scoring exception, document failure/recovery/opening, seven-criterion draft save, certification requirement, submission and archived/suspended assignment save blocking.
- Existing reviewer/Scholarship browser regression passes dirty departure, failed-save retention, explicit saving, personal queue holds, submission continuation, dashboard/help and Scholarship tab retention.
- Administrator conflict, practice controls and seven-criterion rubric have no document/main horizontal overflow at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Rubric main-region axe scan has zero violations for requested WCAG tags. Selected 390px conflict and 1440px rubric captures inspected; this is limited visual review, not all-state accessibility certification. External fonts remain blocked.
- 163 Node tests, TypeScript, scoped application lint, local production build and whitespace checks pass. Initial restricted build dependency-read EPERM was environmental; permitted unchanged build succeeded. Existing dependency annotation/bundle warnings remain.

## Reproduce safely

Use `supabase/tests/run-committee-local.mjs` with the four SQL paths listed above. It constructs a new in-memory database and never connects to Supabase.

Start the app with `VITE_SUPABASE_URL=http://127.0.0.1:54329` and a synthetic `VITE_SUPABASE_PUBLISHABLE_KEY`; set `USABILITY_PREVIEW_ORIGIN` to its loopback origin. Run `node supabase/tests/reviewer-usability-browser.mjs --admin-practice` for this increment and omit the flag for reviewer/Scholarship regression. Existing ignored browser dependencies are under `supabase/.temp/committee-test`; on Windows use the installed browser path if needed. Current run used port 4175. Browser responses and all permitted writes are in memory; external hosts and unexpected writes are blocked. Full page loads reauthenticate only through intercepted synthetic Auth responses.

Screenshots are ignored under `supabase/.temp/reviewer-usability/`, with `admin-conflict-*`, `admin-practice-*` and `practice-seven-criteria-*` prefixes. No new package dependency was added.

## NEEDS MANUAL VALIDATION

Hosted two-reviewer/admin role/RLS/storage enforcement, actual active/ended rounds and hosted rubric configuration, simultaneous resolution/session changes, device close-tab behavior, full keyboard/screen-reader journeys, all administrative error-state visual reviews and hosted font rendering remain unverified. Candidate loading/focus refresh and mid-selection revocation are guarded in source and eligibility is rechecked by the existing RPC; this browser increment directly covers empty/failed reads, not a concurrent revocation. Approved policy examples/support address and affected real-account password access remain separate client/hosted follow-ups. Phase F remains gated.
