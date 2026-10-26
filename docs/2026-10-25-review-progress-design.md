# Review Progress layout proposal

Status: Direction A approved and implemented in the existing checkout serving the browser preview. October 25, 2026. Implementation and verification notes: [preview-checkout specification](C:/Users/wende/.codex/worktrees/4e17/jlglm-scholarship-review/docs/2026-10-25-review-progress-design.md). This file retains the original planning baseline; application code changes are in that preview checkout.

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
