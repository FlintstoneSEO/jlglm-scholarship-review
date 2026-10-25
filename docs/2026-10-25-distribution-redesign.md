# Review Distribution workspace redesign

Authorized October 25, 2026 following the four-view proposal. Implementation uses the current TanStack Start, React Query, Radix and Justice League visual system. No database migration or release is required or authorized by this visual change.

## Audit and decisions

- High; GrantCommitteeAllocation; /assignments progress desktop; conflict forms occur after every application and workload card; prior rendered inspection located Needs Attention roughly 8,500 CSS pixels below the top; move reports to a dedicated Conflicts tab with list/detail selection; administrators can reach resolution immediately; verify direct links and keyboard navigation.
- Medium; progress view; all widths; expanded individual progress repeats across every application; source renders all per-reviewer blocks; use searchable rows with status, group/reviewer filters and disclosure for details; improve scanning without hiding access to details; verify incomplete, held and replaced assignments.
- Medium; GrantReviewerGroups; groups view; creation form always consumes space below roster; source renders form unconditionally; open an editor on demand and show member workload/readiness in compact rows; reduce scrolling; verify create/edit/cancel and unavailable membership.
- Medium; allocation view; all widths; configuration, preview and history share one long surface; source mixes all three; provide Choose groups, Review assignments, Confirm steps and separate saved history; clarify pending versus finalized; verify preview does not apply, stale previews fail, confirmation is explicit.

Preserve shell, tokens, account/scope selectors, route authorization, grant-only distribution, RPCs, eligibility pool, three distinct pairs/six authorized identities, balanced/fixed algorithms, server revalidation, saved revisions, immutable applied allocations, original review history, conflict replacement candidates, required reasons and locked success/retry feedback. Scholarship remains on its existing assignment screen. No scoring or privacy changes. Existing progress links with attention/conflict parameters open Conflicts.

## Screen specification

Selected direction: compact operational workspace, informed by Front's Mobbin inbox/list-detail and workload screens, plus Better Stack's incident list. Retain the existing app shell because it already provides program and role context. A sticky four-tab strip provides Conflicts (count), Review progress, Reviewer groups and Random allocation. Two-column tabs on phones; no horizontal page overflow.

Conflicts: unresolved queue first, one selected detail alongside on wide screens; compact labeled queue and detail below on small screens with a return-to-list action. Keep mounted report forms while switching selection/tabs to retain drafts. Resolved history stays separate. Loading/error state must not imply zero reports. Resolve preserves existing candidate access checks and refresh recovery.

Progress: compact completion summary, search by application/reviewer, status and group/reviewer filters. Labeled responsive rows show both reviewers and completion; expand to inspect assignment lifecycle/replacement. Resolve action navigates to the corresponding report. Group workload is a disclosure so it does not delay the application queue. Filters persist across tabs.

Groups: compact roster with active workload per member and pair/overlap/access feedback. Add/edit uses an on-demand editor. Save retains existing revision/RPC checks and makes clear that existing assignments do not change. Reuse current field controls and validation.

Allocation: balanced default; choose three groups with selected/overlapping options unavailable elsewhere. Identity confirmation remains required. Review generated proposal with total, eligible, excluded, covered and unassigned counts, both reviewers and group counts. Confirm on a separate step; never apply on navigation. Saved allocations are separately disclosed; finalized and superseded records cannot be confirmed again. Returning to configuration retains choices. Server errors stay visible with retry context.

Shared primitives: existing tabs, buttons, cards, native selects/details, progress projection, conflict form and group roster. Add a pure progress filtering helper for testable status/search behavior. No unification of Scholarship allocation semantics is attempted: its manual assignment workflow has no matching three-pair contract. Existing shared progress projection continues to own completion semantics.

Validation: typecheck/build, repository unit suite and targeted navigation/filter/duplicate-group regression tests; browser inspect all four views, deep links, keyboard and responsive widths using read-only live data or synthetic fixtures. Hosted writes and production role verification are not implied by local checks. Record limitations and manual follow-up after implementation.

## Implementation and verification

Implemented: sticky four-view navigation; legacy attention links open Conflicts; queue/detail conflict resolution with preserved drafts across tabs; searchable/filterable progress rows with expandable individual progress and direct Resolve action; compact member workloads and modal group editor; balanced allocation default, duplicate/overlapping group options disabled, choose/review/confirm stages, explicit finalized/preview labels, zero-available guard and separate saved history. Current pool counts are separated from dated preview counts. Header and scope selector share a row when space allows.

Already working and retained: server-side eligibility/exclusion rules, balanced odd-count allocation, assignment history preservation, authorized replacement candidates, required resolution reasons, locked resolution-success and refresh-retry handling, stale group revision checks, admin-only route access, independent-review privacy and Scholarship assignment mechanics. No persistence contracts, migrations, rubric calculations or role policies changed.

PASS: 172 repository unit tests, TypeScript no-emit check, targeted ESLint, production build, and git diff whitespace check. The build retains a large-chunk warning. Added behavioral tests cover duplicate group choices, overlapping members, missing access, not-started/partially completed reviews, conflicts, group filters and replacement-reviewer filters.

PASS: read-only browser inspection at 1086 x 812 for all four views; legacy progress/attention URL opened Conflicts; Add group modal opened/cancelled with focus on its name input; selecting group 1 disabled it in slots 2 and 3; finalized allocation had no confirmation action; Needs Attention filtered the progress list to its unresolved report; Resolve navigated directly to Conflicts; keyboard ArrowRight moved between tabs. A temporary unsaved resolution reason survived a tab round-trip and was then cleared. No group, preview, assignment or resolution was submitted. Desktop overflow measurement was false.

Initial validation gap (subsequently addressed below): the in-app browser exposed no viewport resizing capability. The follow-up used the repository's isolated automated browser harness to complete the mobile matrix and synthetic write workflows. No deployment was performed.

Visual review: task hierarchy and density improved at the inspected desktop width; conflict resolution no longer follows the full progress list. Mobile uses a two-column tab strip, stacked labeled progress rows, and a bounded queue with return-to-list focus. Existing Justice League shell, tokens and typography remain recognizable.

## Follow-up: mobile and test-data workflows

User authorized mobile checks and group/allocation/reassignment testing with test data, without deployment.

### Issues fixed

- Medium; GrantCommitteeAllocation allocation list; review step at 320px; scrollable list lacked a keyboard focus target; axe reported `scrollable-region-focusable`; added `tabIndex=0`, an accessible name and visible focus outline; keyboard users can enter and scroll the list; rerun scoped axe at 320/1440 and six-width reflow.
- Low; assignments heading and allocation summaries; 320/390px; large heading, duplicate group summaries and persistent success text delayed the current task; screenshot review showed the repeated content above the form; reduced mobile heading size, omitted redundant mobile subtitle, disclosed allocation record metadata, removed duplicate group counts, shortened success feedback and cleared it when changing views; useful content begins earlier; verify the resulting phone captures and rerun workflows.

### PASS: isolated browser evidence

`supabase/tests/distribution-redesign-browser.mjs` runs against a separate loopback Vite instance configured with a synthetic API URL/key. All API responses and writes are in memory. External network requests and unexpected writes are blocked. The admin distribution route is exercised with fictional real-scope records; these are not hosted applications. Browser contracts do not substitute for SQL authorization tests.

- Eight states at 320, 375, 390, 768, 1024 and 1440 CSS pixels: group editor, populated groups, allocation choose/review/confirm, progress, conflicts and replacement selection. No document or main horizontal overflow. Each state has scoped WCAG axe checks at 320 and 1440: zero violations after remediation (16 scans). Screenshots are retained for all 48 state/width combinations.
- Actions between matrices run at 390 x 844: create three two-member groups; edit with revision; reject duplicate selection; require identity and assignment confirmation; preserve inputs between views; create a five-application balanced preview (2/2/1); fixed capacity one leaves two unassigned; pending-screening and prior-history applications stay out of the pool.
- Changed group revision disables confirmation; simulated stale eligibility rejects apply without mutation; successful apply preserves the pre-existing assignment/review. Preview/reopening performs no implicit apply or reshuffle; finalized allocation cannot be confirmed again.
- Conflict replacement requires candidate and reason, preserves a draft across tabs, suspends only the affected assignment, preserves its review and the unaffected partner, shows replacement in progress, and records resolved history. Exactly one resolution write occurs.
- Existing `reviewer-usability-browser.mjs --admin-practice` passes failed-write retention, unavailable/empty candidates, clear/replace feedback, duplicate prevention, practice reset/end and readiness/certification/archived-round gates.
- Existing reviewer/Scholarship browser suite passes dirty navigation/reload/signout guards, failed-save retention, personal holds, submission continuation, Scholarship tab retention and explicit saving. Its reflow/axe checks also pass.

### PASS: local database and code checks

All migrations apply to a fresh in-memory PGlite database. Six rollback-only suites pass: `grant_reviewer_groups.sql`, `growth_grant_committee.sql`, `grant_conflict_resolution.sql`, `grant_practice_sessions.sql`, `multi_program_authorization.sql`, and new `grant_distribution_odd_counts.sql`. The new test verifies actual SQL 2/2/1 allocation, test/pending/history exclusions, two fixed-capacity leftovers, preservation and idempotent finalized replay. Existing tests cover rejected roles, authorized replacement candidates, peer privacy, stale group/member/eligibility checks, atomic failure, and history preservation. PGlite uses Auth/Storage shims; this is not hosted Supabase evidence.

172 unit tests, TypeScript no-emit check, scoped lint and production build pass. Existing large-bundle warnings remain.

### Reproduce and inspect

Use the existing ignored dependencies under `supabase/.temp/committee-test/node_modules` (Playwright, axe, PGlite). Launch a separate development process with `VITE_SUPABASE_URL=http://127.0.0.1:54329`, `VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-local-test-key`, host `127.0.0.1`, port `4176`, and `--strictPort`. Run `node supabase/tests/distribution-redesign-browser.mjs`. For existing browser suites set `USABILITY_PREVIEW_ORIGIN=http://127.0.0.1:4176` and run `node supabase/tests/reviewer-usability-browser.mjs` with and without `--admin-practice`. No production configuration file is edited.

Run local SQL with `node supabase/tests/run-committee-local.mjs` followed by the six test paths above. Screenshots, axe results, fixture mutation evidence and preserved assignment/review records are under ignored `supabase/.temp/distribution-redesign/`; earlier regression screenshots are under `supabase/.temp/reviewer-usability/`.

### Remaining evidence limits

No hosted records, assignments, reviews, accounts or migrations were changed. No deployment. External fonts were blocked in isolated tests, so screenshots use fallback fonts. Full screen-reader/device testing, hosted role/RLS/storage behavior, concurrent real administrators and the parent-refresh-rejection branch still require separate validation; the existing local fixture does not force React Query invalidation to reject. These limits do not invalidate the completed local mobile and synthetic workflow checks.
