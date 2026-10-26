# Review Progress layout proposal

Status: Direction A approved and implemented locally. October 25, 2026.

## Brief and verified baseline

Administrators need to see overall completion, compare reviewer-group workload, and find outstanding applications without scrolling through the application list or opening basic summary disclosures. Combine applied allocation batches in the workload presentation. Retain Justice League's Phase E / Concept B visual language, Inter, Lucide, native browser semantics and existing navigation.

The user supplied screenshots from `/assignments?scope=real&tab=progress` showing a collapsed/expandable workload region below applications, repeated finalized batch headings, and low visual separation between filters and their surrounding surface. Current checked-out `GrantCommitteeAllocation.tsx` differs: it renders a summary, then workload, then applications, with three workflow tabs. Its workload still maps each applied allocation to separate `GrantGroupWorkload` cards. Browser access timed out; the origin's code version has not been established. Verify the running preview's source before claiming the updated screen is available there.

Stack: TanStack Start, React, React Query, Tailwind, npm scripts and Supabase browser queries. README identifies both programs; architecture-audit.md is an earlier baseline, not the current schema. Current code has program-aware assignments and grant allocation snapshots. Existing uncommitted Concept B and reviewer usability work must be preserved.

## Scope and preservation

- Primary role: administrator monitoring Business Growth Grant reviews. Current route-level admin checks and data access remain authoritative. Reviewer-only private progress is outside this change.
- Preserve real/practice isolation, application scope, applied-only workload, expected independent-review denominators, assignment lifecycles, conflict holds, replacement chains, completion rules, score privacy, explicit mutation confirmations and all existing action handlers.
- No schema, query permission, scoring, assignment or persisted-data change. Phase F deployment remains separate.
- Shared primitives: a read-only completion summary, workload row and clearly bounded filter toolbar. Grant allocation grouping stays in a grant adapter; `ReviewProgress` continues serving both programs without importing grant-specific rules.
- Route/tab destinations remain unchanged. This is a local screen composition change, not new navigation architecture.

## Findings

| Severity | Element | Viewport / state | Observed problem and evidence | Exact recommended change | Reason and expected outcome | Verification |
| --- | --- | --- | --- | --- | --- | --- |
| High | Review Progress hierarchy | Supplied 1086×812 page, real applications | Workload follows the application list and uses an expander in the screenshot. Current checkout already places it earlier. | Place a compact overall summary and combined workload immediately below workflow tabs, before filters/application rows; no disclosure on either summary. | Completion and bottlenecks are visible on entry. | Screenshot at supplied viewport and required widths; inspect content order. |
| Medium | GrantGroupWorkload / applied allocation rendering | Multiple applied batches | Current component renders three cards per applied allocation with repeated applied-date headings. | Aggregate across batches into one workload register by stable source-group identity; preserve provenance in application details. | Compare overall group workload without interpreting allocation history. | Multi-batch fixtures including reused pair numbers and group revisions. |
| Medium | Filter surface | Supplied screenshot, default state | Fields and panel have nearly matching pale surfaces; labels do most of the grouping work. | Use existing pale-green accent toolbar, white fields, explicit labels, stronger scoped field outlines and a visible Clear filters action. | Controls are distinguishable and feel part of a coherent task area. | Measure actual rendered text/control contrast, keyboard focus and reflow. |
| Medium | Summary disclosures | Progress and attention states | Screenshot uses a default disclosure for primary workload; checked-out progress also nests conflict/history disclosures. | Keep primary information visible; use labeled View applications and View reviewers actions for secondary details. Keep conflict resolution and history behavior intact in this increment. | Fewer ambiguous expanders without hiding important state or redesigning unrelated tabs. | Keyboard activation, detail dismissal/return focus, conflict deep-link regression. |

## Three layout directions

All preserve the existing global shell because role/program access, departure protection and Phase E branding are constraints. Their local screen architecture differs deliberately.

### A — Progress register (recommended)

Horizontal overview with a prominent completion fraction and bar; compact supporting counts. A single full-width workload register below it uses aligned columns: group, allocated applications, completed/expected reviews, remaining, and explicit View applications/View reviewers actions. Filters and application results follow. Hierarchy comes from aligned numeric comparisons and restrained green progress marks, not repeated cards. Moderate density, compact section spacing, no decorative media or animation. Current type scale and surfaces remain recognizable. Mobile becomes labeled group rows with completion and remaining first, then secondary counts/actions. Best fit for comparing three groups; low visual risk and moderate aggregation implementation risk.

### B — Monitoring workspace

Persistent narrow overview rail next to the application list; group selection in the rail narrows the adjacent results. Completion stays visible while investigating applications. More simultaneous detail at wide widths, tighter density and stronger vertical grouping. At tablet/mobile widths the rail becomes an above-list overview with explicit group selection; avoid a sticky panel taking most of the viewport. No media or motion; preserve tokens and type. Good for prolonged investigation, but less useful at the user's 1086px viewport and requires more responsive/focus work. Medium fit, higher layout risk.

### C — Group comparison board

Overview followed by one compact column per group, each showing its completion measure, reviewer totals and a View applications action. A separately labeled application-results region follows. Hierarchy comes from group-to-group comparison and more whitespace, with reviewer identity visible by default. Mobile uses a vertical sequence of labeled groups rather than a horizontal carousel. No media or motion; same brand tokens and restrained type. Useful for a small stable roster but longer with many groups and membership revisions. Medium fit, medium density risk.

Choose A: it directly removes repeated finalized-batch cards, keeps the overview near the top, and leaves more room for the actual work list than B or C. This is a proposed choice, not recorded user approval.

## Screen specification for A

Order: existing page title/application scope → existing workflow tabs → overall completion → combined group workload → application filter toolbar → application results → existing attention/history functions.

Desktop sketch (counts are placeholders, not verified live totals):

```text
Review Progress
Overall review completion      [completed / expected]   [percent]
[completion bar]               Applications · Remaining · Conflicts

Group workload                 Across all applied allocations
Group / reviewers    Applications    Completed / expected    Remaining    Actions
Group ...            ...             ... / ...              ...          View applications

Filter applications [Search........................] [Clear filters]
[All] [In progress] [Completed] [Needs attention]   [Group] [Reviewer]
Application results                              [filtered / overall count]
```

- Overall completion remains independent of local application filters, with an explicit Overall label. Show an additional filtered-results count near the list. Program and real/practice scope still change the dataset.
- Workload is visible by default. Group row selection is an explicit View applications action, which applies that group filter and moves focus to the results heading. View reviewers reveals a clearly titled reviewer detail region with a Close reviewer details button and restores focus on close. Avoid making an entire row an unlabeled click target.
- Use labeled buttons for the small status set, with `aria-pressed` when filtering; retain dropdowns where group/reviewer option counts justify them. Search has a visible label and descriptive placeholder. Clear filters resets local filters only, preserving program, real/practice scope and route tab.
- Toolbar background: existing `--accent` (#e8f1eb); fields `--card` (#ffffff); body `--foreground` (#171a18); secondary copy `--muted-foreground` (#59615c); progress `--primary` (#006633). Use a scoped stronger control boundary where required after measurement; do not alter global input tokens incidentally. Final rendered contrast must pass WCAG 2.2 AA, including 3:1 essential non-text control boundaries and 4.5:1 normal text. Do not claim measured results yet.
- Keep typography near current 14–16px utility/body and 20–24px section headings; align numeric columns and use tabular numerals. No new font, oversized hero, gradients, edge stripes, blur or cosmetic charts.
- At 1024/1440 use a semantic workload table where it fits. At 768 and compact widths use equivalent labeled rows. At 320/375/390 prioritize completion and outstanding counts; toolbar uses full-width search, wrapping status buttons and stacked labeled selects. Avoid horizontal page overflow, truncating names or forcing a dense table into a narrow column. Target 44px controls and preserve visible keyboard focus.

## Aggregation contract and correctness

Current `projectGrantAllocationProgress` resolves replacement chains, excludes held/inactive reviews from completion, and supplies slot counts. Reuse those semantics exactly. `GrantGroupWorkload` currently partitions each allocation by pair 1/2/3, which is local to that snapshot; pair number or displayed name alone is not a safe cross-batch group key.

For snapshots with group IDs, combine entries by snapshot source-group ID across applied allocations, using their original group membership for attribution and resolved current reviewer for reviewer workload. Membership revisions remain discoverable in reviewer details; never imply today's membership performed historical assignments. Renamed groups need a consistent latest-applied label. Replacement work counts once and is labeled as replacement work. Legacy snapshots without IDs need a stable reviewer-pair identity scoped to program/session, with pair order normalized; never merge unrelated legacy Pair 1 groups. Preserve source allocation IDs internally for provenance.

Before implementing deduplication, verify the allocation uniqueness invariant in code/migrations and fixtures. If repeated applied snapshots reference the same application/assignment, surface a data anomaly rather than silently choosing a winner or changing overall denominator semantics. Confirm group totals reconcile to the existing overall slot counts on valid data. No new database writes or data migration are proposed.

## States and workflow coverage

- Loading: clearly labeled loading summary/workload, no zero completion claims while reads are pending.
- Read failure: unavailable status and existing read-only Retry action; no success/empty fallback.
- No applied allocations: explain that workload appears after allocation is applied; frozen previews remain excluded. Existing group/allocation destinations remain available.
- No filter matches: retain overview, show clear no-results message and Clear filters.
- Partial completion, fully completed and zero denominator: accurate text/bar; never divide by zero or show 100% for an empty dataset.
- Conflict holds and missing/inactive assignments: labeled attention counts; retain original conflict resolution and deep-link behavior, eligibility/assignment boundaries and history.
- Missing reviewer names: retain existing historical-name failure feedback and Retry names; avoid merging accounts by displayed name.
- Unauthorized access: preserve route gate; no added queries or broader reads.

## Validation plan and handoff

After approval, inspect the active preview source, then implement aggregation/presentation as an incremental Phase E change. Extend meaningful pure fixtures for multi-batch group identity, legacy pairs, changed memberships, holds and replacements; run existing progress/distribution regression tests, TypeScript, scoped lint and build. Use synthetic read-only browser fixtures for filtering, totals, details/focus and conflict navigation. Inspect 320, 375, 390, 768, 1024 and 1440 CSS pixels plus the supplied 1086×812 viewport; check keyboard navigation, actual rendered contrast and overflow. Do not mutate real records to test monitoring UI. No tests or UI changes have been performed for this proposal.

## References consulted

- [ClickUp dashboard](https://mobbin.com/screens/2802e4dc-5a33-4b61-b556-7008bffeeb2f): preview shows summary metrics and overall completion above lower work panels. Borrow the prioritization principle, not its many charts.
- [Wrike task workspace](https://mobbin.com/screens/1d43bb28-b4c3-4481-827c-2f6a5b560630): preview shows aligned task rows and controls grouped immediately above the work. Borrow scanability, not the timeline.
- Mobbin Trello comparison preview was also inspected; its large chart panels devote too much space to this portal's small group roster.
- Local Apple reference guidance: layout visual hierarchy, typography hierarchy, accessibility perceivability, lists/tables, progress indicators and search fields. Applied only as web design principles; browser semantics, project tokens and WCAG govern implementation.


## Implementation and verification record

The browser origin on port 8081 is served by the existing checkout at C:/Users/wende/.codex/worktrees/4e17/jlglm-scholarship-review (business-growth-grant-brand-refresh). That checkout matched the supplied screenshots and already had the four distribution tabs and application filters. Implementation lives there. The initial planning checkout at C:/Users/wende/source/repos/jlglm-scholarship-review has older distribution code; its unrelated, uncommitted Concept B changes were preserved. Temporary implementation edits in that older checkout were removed before continuing.

Replaced the progress tab's summary/application-list/batch-disclosure composition with GrantProgressDashboard. Overall totals and the combined workload table are visible first. Group rows combine stable IDs across applied snapshots; legacy pairs use normalized reviewer IDs. Existing grant projection functions still decide holds, replacement chains, inactive assignments and completion. Duplicate application occurrences are reported without silently altering denominators. Reviewer detail panels attribute replacement work explicitly. Original application-status filter behavior is preserved through matchesDistributionProgress; In progress is an additional option. Resolve conflict still uses the existing four-tab conflict workflow and recorded-resolution handlers.

The filter toolbar uses the existing accent surface, white fields and darker scoped control outlines. Status filters are labeled buttons. View applications filters the list and focuses its heading; reviewer and application dialogs restore focus to their launching buttons. At compact/tablet widths group rows show labeled values, with completion and remaining work first. No query, RLS, schema, scoring, eligibility, assignment, authentication or persisted-data changes were made. Existing conflict, allocation and group-editor behavior is retained.

Validation:

- PASS: 177 Node tests, including five new aggregation tests for multi-batch identity, revisions, legacy pairs, duplicates, holds/replacements and missing assignments.
- PASS: TypeScript, scoped ESLint and production build. Existing dependency annotation and bundle-size warnings remain.
- PASS: distribution-redesign-browser.mjs with isolated loopback provider fixtures. Existing group revisions, allocation exclusions, stale rejection, explicit confirmation, preserved assignment/review records, conflict replacement, retained conflict draft, history and finalized reopening passed.
- PASS: second applied batch combines into three group rows; group application filtering leaves overall totals unchanged; search no-results/clear; reviewer/application details and focus restoration; zero applied workload gives an honest empty state.
- PASS: no page/main horizontal overflow at 320, 375, 390, 768, 1024 and 1440 CSS px; extra visual review at the supplied 1086×812 viewport. Screenshots include the distinct filter surface at all seven widths. Automated WCAG-tagged scans at 320/1440 reported zero violations in the tested regions. Desktop and mobile screenshots were visually inspected. Fixed a broken Applications header wrap discovered at 1086px.
- Calculated token contrast: #171a18 on white 17.54:1; #59615c on white 6.38:1 (also field boundary); #59615c on #e8f1eb 5.54:1; white on #006633 7.12:1. No new global palette tokens.

Evidence: ignored supabase/.temp/distribution-redesign/ screenshots, axe JSON and evidence.json. Synthetic data is explicitly fictional. External fonts are blocked by the harness, so final provider-font rendering remains separate. These checks are not a full screen-reader certification or hosted authorization verification. No deployment, hosted mutation or real-account write occurred.


## Follow-up: original group identity after a conflict replacement

User requested that a reviewer replacing someone in another group must not appear as a member of that group. This supersedes the initial proposal's resolved-reviewer group roster presentation.

- Severity: medium. Element: group row reviewer names and View reviewers dialog. State: a conflict is resolved with a replacement from another group. Observed problem: deriving membership from resolved slot.reviewerId displays that replacement alongside the original group members. Evidence: supplied Group 1 screenshot has four names; GrantProgressDashboard used resolved reviewer IDs for both lists. Exact change: derive group roster and reviewer breakdown by originalReviewerId, keep resolved slots for group totals, and show reassigned completed/outstanding counts separately from each original reviewer's direct counts. Reason: assignment ownership and group membership are distinct. Expected outcome: groups keep their original identity while progress reflects the active review; the original reviewer receives no personal completion credit for replacement work. Verification: cross-group replacement unit test, browser assertions for exactly two original members and no replacement identity in the source-group dialog, existing conflict/assignment regression and responsive scans.

Only group membership presentation and its read-only summary projection changed. Application review details still identify the active reviewer and the original replaced reviewer; the Conflicts tab retains the complete resolution history. Group and overall denominators, active-review completion, actual assignments, permissions and persisted data are unchanged. Historical original memberships from distinct applied snapshots remain represented; this does not rewrite past allocations to today's membership.

Unit validation: 178 tests pass, including a completed cross-group replacement that contributes once to its source group, does not add the replacement to the source roster, and does not credit the original reviewer with a completed personal review. TypeScript and scoped lint pass. Browser/build follow-up evidence is recorded below after completion.

Follow-up validation completed: production build and the full isolated distribution browser regression pass. Source-group row and dialog assertions confirm two original reviewers, no cross-group replacement membership, and a separately labeled reassigned outstanding count. Existing conflict resolution/history, overall totals, filter behavior, six-width reflow and scoped automated accessibility scans remain passing. No actual assignment or live data changed.


## Main integration follow-up

The approved progress implementation has now been copied from the earlier preview checkout into codex/restore-portal-sidebar at C:/Users/wende/source/repos/jlglm-scholarship-review, based on current origin/main e09eb37. Its source checkout remains intact. This prepares the missing progress work together with the navigation correction for review; it is not evidence of a production release. See docs/2026-10-25-sidebar-merge-correction.md.
