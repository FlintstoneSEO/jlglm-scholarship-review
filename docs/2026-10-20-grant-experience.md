# Business Growth Grant experience refinement

Authorized by the October 20 request to improve the overall Grant UI/UX. This is a local Phase E presentation increment, within the selected institutional rail direction. No route, navigation destination, database, authorization, assignment, scoring, eligibility, certification or explicit-save change. Native TanStack Start, npm, React Query, Supabase and Vercel conventions remain.

## Audit and direction

Compared current Grant dashboard/queue/workspace with Scholarship and the existing architecture audit, Phase E system and October 12 handoff. Both programs already use ReviewQueue and ReviewWorkspace. Keep these mechanics shared. Grant-specific business identity and eligibility belong in the Grant adapter, not a second shell. The earlier architecture audit is historical; current routes call the shared queue loader and personal-work projection. No migration is needed for presentation using the existing returned business details.

Three composition approaches considered within the approved visual identity:

- **Review desk, selected:** task-led dashboard, one compact progress ledger, business-first application register, restrained controls. Fits repeated committee work and reduces time before reaching applications.
- **Stage board:** columns for screening, scoring and completion. Rejected because eligibility and individual review status are separate dimensions; a board would imply a single workflow status.
- **Application dossier:** wide business narrative and document-first landing workspace. Useful inside a record, but unsuitable as the program entry point where users need to choose work.

Preserve the black institutional rail and mobile navigation because the role-dependent destinations already support the review journey. Improve page hierarchy rather than change IA. Keep Inter, Justice League tokens, Lucide, white reading surfaces and semantic status colors. No imagery or decorative motion is required for private review work.

## Findings

### 1. Dashboard composition

Severity: medium. Element: GrantDashboard, `/`, loaded reviewer/admin, desktop and mobile. Observed: four independent metric cards and utility rows precede the application register; application rows emphasize applicant identity and missing email rather than business. Evidence: current JSX and existing October 12 dashboard-1440 fixture, cross-checked against current tokens. Exact change: compact definition-list ledger; task guidance beside the reviewer register; business name first, applicant second. Reason: the user selects a business to review. Expected outcome: clearer task priority with less repetitive card chrome. Verification: synthetic reviewer/admin render and six-width reflow; preserve raw counts and unknown states.

### 2. Queue hierarchy

Severity: medium. Element: GrantList, `/grants`, loaded desktop. Observed: scope precedes the page title; desktop advanced filters are always expanded and duplicate compact-screen controls. Evidence: current queue JSX. Exact change: title first, scope/refresh utility grouping, one native More filters disclosure at all widths, with active count and visible reset. Reason: common search/status tasks should precede optional business attributes. Expected outcome: shorter route to the register and consistent filtering across widths. Verification: search/filter URL behavior, keyboard disclosure, active-filter feedback and reflow.

## Screen and state specification

Dashboard: title and queue action, compact scope/refresh toolbar, existing admin screening section or reviewer guidance, compact progress ledger, business register. Reviewer guidance explains conflict declaration, eligibility, rubric and explicit saving without bypassing gates. Ready/held counts remain personal and use existing personalGrantWork. Read failures show unknown; do not present stale counts as authoritative. Loading uses dashes, empty uses existing queue message, partial reads keep warnings and fallback identity. Practice names/badges remain explicit.

Queue: heading identifies the work, toolbar groups scope/refresh, screening remains admin-only, search/status remain visible, optional attributes use native details/summary at every width. Reset clears search/filter URL fields while retaining scope. Do not change filtering predicates, source rows, authorization or personal/overall status semantics. Table/mobile rows remain the shared ReviewQueue.

Mobile: 320px minimum; ledger is two columns, task guidance precedes rows, scope controls wrap, optional filters stack. Desktop ledger has four columns and application rows use available width. Existing shell scroll containment stays intact. All action targets at least 44 CSS px; visible focus, labels and text status remain. No new persisted state.

Workflow: dashboard -> filtered queue -> existing workspace -> documents/conflict/eligibility -> rubric -> Save draft -> certification -> Submit -> queue. Admin additionally screens and manages distribution through existing destinations. Existing loading/error/empty/held/submitted states and dirty-departure protections stay in their current owners.

## Verification

- PASS: 165 existing Node tests, TypeScript, scoped ESLint, production build and whitespace checks. Existing dependency annotation/bundle warnings remain.
- Source review: separate Impeccable reviewer identified degraded business identity and stale row-status feedback. Added a business-details warning/refresh feedback without invalidating reliable scoring counts; failed work refresh now labels row status unavailable. Mobile guide precedes rows and moves to the right at desktop width. More filters has an explicit Lucide disclosure indicator.
- NEEDS RENDERED VALIDATION: synthetic browser navigation failed with ERR_NETWORK_ACCESS_DENIED; a local fixture transport attempt also failed with Node EACCES. No current screenshots, reflow, axe results or successful browser journey are claimed. The older dashboard fixture was baseline evidence only. Temporary transport fixture removed.
- NEEDS MANUAL VALIDATION: reviewer/admin at 320, 375, 390, 768, 1024 and 1440 CSS px; active filters/reset, long names, detail-read recovery, failed-refetch status, keyboard/focus, loading/empty states and hosted fonts.
- Impeccable context/detector engine unavailable due to cache permissions/network. Separate documenter confirmed the extension uses incumbent tokens and system; no duplicate DESIGN.md authority introduced.

Hosted RLS, real accounts and device/screen-reader checks are outside local code-check evidence. No production mutation, deployment or release performed.
