# Phase B audit: shared queue, progress, and capability presentation

Date: 2026-09-26. Audit-only review of the Phase B request against this checkout at `bda840d1dcf2431be9a805a948a0613b68b4ba00`. No application code, routes, database objects, policies, assignments, or persisted data were changed. No live Supabase connection or role-scoped test accounts were available; this document makes no claim about production rows, deployed RLS, or effective authorization.

## Scope and evidence

Reviewed `README.md`, `docs/architecture-audit.md`, `docs/application-redesign-audit.md`, `docs/review-workflow-unification-plan.md`, `docs/review-workflow-decisions.md`, `docs/phase-a-baseline.md`, `src/lib/review-domain.ts`, `src/lib/review-adapters.ts`, their tests, the Scholarship and Grant queue routes, `/assignments`, `AppShell`, `auth-context`, and relevant local migrations.

The request names `docs/phase-a-baseline-evidence.md`; that file is absent. This checkout contains `docs/phase-a-baseline.md`, which reports a local code/migration inventory and explicitly says production state was not checked. The pasted baseline claims should therefore be treated as unverified beyond the files present here.

## Current workflow and data flow

| Surface | Query and projection | Status / progress | Filters and actions | Destination / access presentation |
|---|---|---|---|---|
| Scholarship `/applicants` | Reads `applicants` directly; non-global-admin rows are filtered to `eligible_for_review`. Client calculates rank, missing documents, and filters. | Uses native `application_status` and `review_status` labels; score is legacy `total_score / 90`. No per-reviewer queue progress projection. | Search name/email, school, college, application status, review status, score range, missing essay/transcript/signature; global admin can change screening in bulk and toggle finalist/selected flags. | Links to `/applicants/$id`; admin checks use global `role === "admin"`. Query errors are not rendered distinctly from empty results (`data` defaults to `[]`). |
| Grant `/grants` | Reads `portal_applications` for selected program, then Grant detail rows; detail query error is currently discarded. | Uses native `review_status`; shows `completed_review_count` and `average_score`, which are assignment-relative Grant aggregates. | Search applicant/business/email; filter review status, LARA status, operating model, and business age. | Links to `/grants/$id`; queue enabled only when selected program slug is Grant. Assignment-aware visibility is described in copy, while Supabase RLS remains the source of access. Main query errors are not presented separately from no rows. |
| Reviewer Assignments `/assignments` | Reads program applications, reviewer access, `reviewer_assignments`, and `program_reviews`; the query can return data arrays that default to empty. | Completion is looked up by assignment ID in `program_reviews`. This works for Grant records but does not represent Scholarship legacy `reviews`. Cards show completed/outstanding per assigned reviewer. | Admin assignment creation/removal and reviewer/application selection. | Table lists reviewer, application, assigned date, status and remove action. Uses existing program admin selection logic; failed reads can resemble empty data. |
| Shared shell | `auth-context` loads global role and `user_program_access`, then joins accessible programs; selected program is stored locally. | Global role is `admin`, `reviewer`, or `viewer`; selected program has `admin`, `reviewer`, or `viewer` access role. | Desktop sidebar includes program destinations and, for an admin, Reviewer Assignments and Users & Access. | Mobile header renders program selection and horizontal program navigation only. Shared admin destinations are absent at mobile widths. Admin program options come from membership rows; global-admin selector behavior remains an open decision. |

Phase A `ReviewQueueItem` and `ReviewProgress` are read-side shapes, but neither adapter currently projects queue collections. `ReviewWorkspaceData` is built for a single application. `ReviewProgress` can represent fixed-five Scholarship progress and assignment-relative Grant progress; capabilities currently project to `unknown` because authorization/business decisions are unresolved. Normalized `reopened` exists as a vocabulary value, but no distinct persisted reopened state is evidenced and it must not be presented as an available transition.

## Audit findings

### B1 — Assignment monitoring omits Scholarship legacy completion

- **Severity:** high
- **Element or file:** `src/routes/_app.assignments.tsx`; Phase A adapters in `src/lib/review-adapters.ts`
- **Viewport, route, or state:** `/assignments`, with Scholarship assignments and legacy drafts/submissions
- **Observed problem:** Assignment progress is keyed from `program_reviews` by assignment ID. Scholarship review records are in legacy `reviews`, so Scholarship can appear not started or outstanding after work has begun or completed.
- **Evidence:** The assignment query reads `program_reviews`; the Scholarship adapter reads `reviews`; no read bridge is present in the route. Existing audit finding A1 reaches the same conclusion.
- **Exact recommended change:** In an authorized implementation phase, build program-specific assignment progress projections from each program's native review source, then pass normalized counts and anomaly state to shared presentation. Keep Scholarship fixed denominator 5 and Grant denominator equal to current assignment count. Do not create or infer `program_reviews` for Scholarship.
- **Reason:** The monitor must reflect source records and preserve distinct completion rules.
- **Expected outcome:** Admins see source-backed started/completed/remaining counts and discrepancies rather than fabricated parity.
- **Verification method:** Fixture comparisons for zero, draft, completed, duplicate/orphan review, and assignment-count mismatch cases; production claims require role-scoped database validation.

### B2 — Queue failures can look like legitimate empty results

- **Severity:** high
- **Element or file:** `src/routes/_app.applicants.index.tsx`, `src/routes/_app.grants.index.tsx`, `src/routes/_app.assignments.tsx`
- **Viewport, route, or state:** queue loading, denied/failed reads, secondary Grant-detail failure, empty filter result
- **Observed problem:** Scholarship and Grant queues default missing query data to empty arrays and do not render explicit errors. The Grant secondary detail query ignores its error. Assignment data similarly defaults to empty arrays. Users cannot reliably distinguish no matching applications from a failed source read.
- **Evidence:** Query result destructuring uses `data = []` / `data ?? []`; Grant detail result destructures only `data`; no queue-level error presentation is rendered.
- **Exact recommended change:** Project query outcomes into Phase A read states and provide distinct loading, ready, empty, partial-error, error, and unavailable views with safe retry guidance. Do not reveal whether denied records exist.
- **Reason:** Empty and failed data have different meanings and recovery paths.
- **Expected outcome:** Users can distinguish valid empty results from failed or unavailable data without sensitive existence leaks.
- **Verification method:** Component/route state fixtures for each normalized read state, including partial Grant details and denied access; test accessible announcement and retry behavior.

### B3 — Capability presentation cannot safely authorize new queue actions yet

- **Severity:** high
- **Element or file:** `src/lib/review-domain.ts`, `src/lib/review-adapters.ts`, queue routes, `src/components/AppShell.tsx`, `src/lib/auth-context.tsx`
- **Viewport, route, or state:** Admin/reviewer/viewer; global role combined with program role; direct URL and mobile navigation
- **Observed problem:** Phase A intentionally returns `unknown` capabilities. Current routes instead use differing predicates, and client program options derive from `user_program_access`. Hiding a control or selecting a program does not establish database authorization. Open decisions include global-admin program selection and Scholarship screening revocation.
- **Evidence:** `capabilityProjection(true)` marks all capabilities unknown; Scholarship list actions use global role; shell combines global and program admin differently by program; auth selector uses membership rows; audit findings A4/A5 and decisions D3/D7 remain open.
- **Exact recommended change:** Before enabling capability-driven actions, resolve D3 and D7 and validate a role/program matrix against deployed RLS. Until then, do not turn unknown into allowed or introduce actions. Keep existing route behavior only where it is already established and retain backend authorization as authoritative.
- **Reason:** UI affordances must not imply access that is unverified or unavailable to an authorized role.
- **Expected outcome:** Queue and navigation controls communicate only validated capabilities while preserving the current security boundary.
- **Verification method:** Safe role-scoped tests for global admin, program admin, reviewer, viewer, cross-program roles, no access, screening transitions, and direct protected routes; no production claim without those tests.

### B4 — Shared admin destinations are absent from mobile navigation

- **Severity:** medium
- **Element or file:** `src/components/AppShell.tsx`
- **Viewport, route, or state:** mobile widths below `md`, authorized program admin
- **Observed problem:** Mobile navigation shows program links but omits Reviewer Assignments and Users & Access, which appear in the desktop sidebar.
- **Evidence:** `/assignments` and `/users` links are rendered inside the desktop `<aside>`; the mobile navigation maps only the selected program's `nav` array. Program-specific Scoring Summary, Grant Rankings, and Rubric remain in those arrays according to their existing predicates.
- **Exact recommended change:** In a separately authorized implementation, expose shared admin destinations in mobile navigation under the same established role/program predicates; preserve existing program-specific destinations. First settle any global-admin selector and effective-role rules that alter those predicates.
- **Reason:** Authorized administrators need parity for shared operational tasks on touch devices.
- **Expected outcome:** Authorized admins can reach shared tasks on mobile and other roles do not gain new task links.
- **Verification method:** Role-aware navigation assertions and rendered checks at 375, 390, 768, 1024, and 1440 CSS pixels, including keyboard/touch access.

### B5 — Queue-specific projections and program columns are not yet defined

- **Severity:** medium
- **Element or file:** `src/lib/review-domain.ts`, `src/lib/review-adapters.ts`, `/applicants`, `/grants`
- **Viewport, route, or state:** queue rendering across programs
- **Observed problem:** The normalized item has applicant name/email, normalized status, progress, and destination, but no queue projection functions, explicit column metadata, or queue-state contract. Scholarship's screening, score/rank and missing-document data and Grant's business/LARA fields have useful but different queue purposes.
- **Evidence:** Existing routes build distinct filters and columns; Phase A adapters return one `ReviewWorkspaceData`, not lists; current `ReviewQueueItem` omits the metadata shown in either route.
- **Exact recommended change:** Specify route-owned Scholarship and Grant projections and a shared presentation API that accepts explicit columns/metadata and normalized read state. Keep native field querying, program-specific filters, score units, screening controls, and selection actions outside generic presentation unless separately modeled as typed extensions.
- **Reason:** Sharing table mechanics should not erase program-relevant information or absorb business-specific actions.
- **Expected outcome:** Consistent state/status/action mechanics with program-appropriate queue content.
- **Verification method:** Projection fixtures assert routes, labels, denominator, progress, metadata, filters, row actions, and safe unknown-capability handling for both programs.

## Preserve / improve / restructure recommendation

| Area | Recommendation | Boundary |
|---|---|---|
| TanStack Start, React, route paths, Supabase clients, Cloudflare conventions | **Preserve** | No route consolidation, platform change, schema/policy change, or data conversion in this phase. |
| Native Scholarship and Grant queries, score/eligibility/assignment meanings | **Preserve** | Scholarship remains legacy `reviews` and fixed-five completed-sum semantics; Grant remains assignment-linked `program_reviews`, dynamic rubric and assignment-relative average semantics. |
| Queue state messaging and mobile navigation | **Improve** | Distinguish empty and failed reads; make currently authorized shared tasks reachable on mobile without changing access rules. |
| Queue/progress rendering mechanics | **Restructure** | Shared presentation consumes normalized route projections; adapters own native query interpretation and program-specific metadata. |
| Review writes, submission, detailed workspace, brand system | **Out of Phase B scope** | No changes or implied approval. D1–D8 remain open where applicable. |

## Unification recommendation and implementation gate

The Phase B architecture is safe in principle if it shares **presentation mechanics only**. Route or program projection functions should query native models and produce queue items, per-source read states, progress with an explicit denominator, anomalies, program-specific metadata, and explicit action capabilities. A shared `ReviewQueue` can own common loading/empty/error presentation, table/list semantics, status labels, progress placement, accessible action labels, and return context. A shared `ReviewProgress` should say assigned, started, completed, and remaining in counts, clearly label Scholarship's target as five, and label Grant's denominator as current assignments. Admin-only anomaly details must be gated by an already verified role; ordinary reviewers should receive no internal IDs or sensitive diagnostics.

Do not use `reopened` as a user-facing workflow state until a native persisted state and approved transition rule exist. Do not expose a new review/manage action when its capability is unknown. Do not replace source statuses or program-specific score/eligibility semantics with a generic value in storage.

The implementation request in the pasted Phase B prompt conflicts with the repository's current `AGENTS.md`, which directs the next phase to audit-only and prohibits application-code changes or visual redesign. This document completes that audit-only deliverable. No implementation, route, component, test, or responsive-render validation was performed. Before implementation, update the repository instruction through the appropriate project decision process and resolve or explicitly carry the D3/D7 authorization gaps; then prepare typed route projections and state/action specifications. Phase B is **not implemented and not ready to advance to Phase C** on this audit alone.

## Required regression evidence when implementation is authorized

- Scholarship and Grant projection fixtures for queue content, filtering, native-to-normalized status mapping, progress denominators, and destination/return behavior.
- Scholarship fixed-five and Grant assignment-relative progress, including zero assignments, duplicates, orphan records, missing reads, partial reads, and over-count anomalies.
- Loading, empty, partial-error, error, and unavailable rendering; failed reads must not render as legitimate zero-result queues.
- `unknown` capability cases do not expose new actions; admin diagnostics do not expose internal anomaly details to ordinary reviewers.
- Assignment monitoring derives Scholarship completion from authorized legacy review reads and Grant completion from its native model; no cross-model writes.
- Mobile shared navigation visibility by verified role/program combination and preservation of Scholarship Scoring Summary and Grant Rankings/Rubric destinations.
- Rendered responsive/accessibility review at 375, 390, 768, 1024, and 1440 CSS pixels, including long names, overflow, keyboard/focus, touch targets, non-color status, and screen-reader labels.
- Local validation commands requested by the eventual implementation task: `npm test`, `npm run build`, and `npm run lint`. These have not been run for this audit.

Writes, schema, RLS, submissions, scoring, eligibility, assignments, selection, and persisted data were untouched.
