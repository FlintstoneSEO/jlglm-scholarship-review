# Grant results visibility — November 8, 2026

## Authorized increment and audit

User requests that recipients and finalists be easier to discover from Overall Rankings and more prominent on the results tab. This is a Phase E presentation increment, not authorization to change selections or release production code. Preserve earlier application-detail changes in this worktree.

Inspected `/grant-rankings` in the current browser and its owning route, `GrantSelections`, `useGrantSelection`, generated database types and `20261030200000_grant_selections.sql`. The current view has a finalized decision. The ranking table already contains plain-text selection labels; one recipient has no completed ranking reviews, so rank order must never determine winners. The finalized tab still renders disabled checkboxes and a small recipient-link list.

Architecture: TanStack Start/React, existing Radix tabs/dialogs and Tailwind brand tokens. Admin-only route and selection reads; exactly three saved finalists, two recipients on finalization, revision-checked RPC and immutable finalized decision. Scholarship uses separate legacy flags; do not alter those. No migration, query, authorization, mutation, ranking calculation or selection-rule change is required.

Primary tasks: administrator opens rankings → immediately identifies recorded recipients → opens the complete finalist/results view or application; before finalization, administrator selects three finalists → saves → selects two recipients → confirms the locked decision. Preserve that editing journey intact.

## Findings

- Severity: high. Element: rankings route summary/table. State: finalized decision, all viewports. Observed problem: a generic count and plain table text hide recipient identities among ranked and pending applications. Evidence: browser and route JSX. Exact change: show the saved recipients by name above the ranking tabs with a visible results action; use labeled recipient/finalist badges and a light recipient-row surface. Reason: identify committee outcomes independently of score position. Expected outcome: recipients visible on entry even if unranked or filtered from the table. Verification: finalized recipient with pending reviews, table filtering, mobile and keyboard checks.
- Severity: medium. Element: GrantSelections finalized branch. State: locked selection. Observed problem: names are small links and finalized records remain disabled checkboxes. Evidence: screenshot and component. Exact change: use prominent equal-weight recipient panels and a read-only finalist roster with application links and existing group metadata. Reason: display an outcome after editing has ended. Expected outcome: clear recipients, separate finalist recognition, visible finalization date. Verification: locked branch contains no selection inputs; unlocked workflow and confirmation remain unchanged.

## Direction and composition

Keep the existing Phase E visual system. Considered: A, result summary above ranking tabs plus named recipient panels; B, make results the default tab; C, highlight table rows alone. Choose A: visible outcomes without changing the existing default work view or depending on ranking/filter position. B makes ongoing score comparison harder to find; C still hides recipients lower in the table. This is hierarchy refinement, not a brand redesign.

Improve the existing navigation label to Rankings & results; retain its route, icon and admin visibility. Page heading becomes Business Growth Grant rankings & results. Keep the tab order and Overall Rankings default. A labeled button opens the existing Finalists & recipients tab and places focus on its trigger.

Summary above tabs: compact green-tinted result region, heading, saved finalization date, two equal recipient panels using business name as dominant text, applicant name, explicit Grant recipient label and application link. No 1st/2nd-place treatment, guessed award amount, confetti or invented facts. Show all saved interview finalists as a quieter linked line with a direct View finalists & recipients action. Hide this duplicate summary while the full results tab is selected.

Full results tab: use the same recipient presentation primitive, followed by all three saved finalists as a read-only divided list, preserving owner and committee-group context. Mark recipient members explicitly; do not describe the third finalist as rejected. No disabled checklist once finalized. Before finalization retain the exact checklist, optimistic revision handling, save actions and confirmation dialog; show a quiet saved-finalist summary rather than recipients.

Mobile: single-column recipient panels, wrapping business names and links, 44px link/button targets, wrapping tab labels. Desktop: equal two-column recipient panels; no decorative edge stripes. Preserve existing mobile table transformation and add text status badges so color is supplemental. Loading, absent decision and errors are explicit; do not present cached selection data as current after an error. Missing row names use an unavailable-name explanation and the saved application link rather than substituting another business.

Shared primitives: `GrantRecipientResults` renders saved results and `GrantSelectionBadge` consistently labels persisted designation across table and roster. No query ownership or write behavior moves into presentation primitives.

## Reference and foundation notes

Apple skill already loaded in this chat: layout → Visual hierarchy supports placing important information first and grouping related content; accessibility/color foundations require explicit labels as well as color. Apply web conventions and Justice League tokens.

Mobbin searches inspected: competition results winners; recruiting candidates status. [Uxcel candidate list](https://mobbin.com/screens/84e3ee01-fb0d-43a9-bb84-d72f79ef1cb2) offers one example of highlighting meaningful table rows. It informs row emphasis only, not the grant outcome or score semantics. Other results did not match this administrative task. Recipient-panel composition is project judgment, not a claimed Mobbin precedent.

## Validation plan

Run existing tests, TypeScript, targeted lint/format and build checks. Render actual presentation components with safe local fixtures for finalized, saved finalists, no decision, loading and errors. Confirm recipient visibility with unranked rows, unchanged rank order, correct links, filter independence, tab focus, finalized read-only state and unchanged draft/confirmation flow. Check 320, 375, 390, 768, 1024 and 1440 widths. Do not mutate hosted data to verify styling.

## Verification completed

- 196 existing tests passed; TypeScript, targeted ESLint and production build passed. Existing build dependency/chunk warnings remain.
- Actual authenticated local preview: verified saved recipient names, applicant names, finalization date, links and finalist group metadata. The earlier plain-text table and locked checklist were observed before editing. Only tab navigation and viewport inspection were performed against real data.
- Isolated fixture loads the actual rankings route and selection components with aliased local data transport. Verified an unranked recipient stays in the prominent results region when Ranked filters its table row out; rank order remains unchanged. Recipient application links match saved IDs. Results CTA selects and focuses the existing Radix tab; accessible tabpanel naming is preserved.
- Finalized fixture has no checkboxes. Unfinalized saved finalists show no winner heading. Choosing two recipients disables a third; Keep editing preserves both choices; named confirmation transitions the local fixture to read-only results. Empty-state Choose finalists reaches the existing form, selecting three disables a fourth, and Save three finalists opens the recipient step without announcing winners.
- Selection read failure shows Retry results and no recipient heading. No real RPC writes, email, finalization or deployment occurred.
- Browser reflow checks: no page overflow at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Captured mobile and desktop results show natural name wrapping, equal recipient prominence, and a separate roster. Temporary viewport overrides were reset.
- Evidence: ignored `.selection-check.local/` contains responsive fixture screenshots and `grant-results.jpg` from the authenticated local preview. Runtime fixtures are outside application routes and do not ship. Full screen-reader and production-release acceptance are not claimed.
