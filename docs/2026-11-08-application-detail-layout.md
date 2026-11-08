# Application detail organization — November 8, 2026

## Scope and baseline

User requests less scrolling and better organization on individual applications, with Mobbin and Apple design guidance. This is a focused Phase E presentation increment within the existing visual direction. No release or production mutation.

Current source: React/TanStack Start, Tailwind, npm lockfile, Vercel preset. Both `/grants/$id` and `/applicants/$id` use `ReviewWorkspace`; it owns identity, progress, keyboard tabs, retained visited panels and navigation. Grant adds a two-pane evidence/rubric layout and places all administration in `notice` before the tabs. Scholarship already keeps its content in sections; its fixed score semantics and header flag controls differ. The historical architecture audit predates these shared components and current migration constraints.

Primary journey: queue → identity/status → overview/application/documents → conflict decision → rubric/comments → Save draft or certification/Submit → queue. Admin journey also includes screening, assignments, decision correspondence and confirmed transfer/duplicate dialogs. Viewers read authorized content only.

## Findings

1. Severity: high. Element: Grant route notice slot. State: loaded administrator, supplied desktop screenshot. Observed problem: decision email, transfer/duplicate actions and reviewer history precede application tabs. Evidence: screenshot and route JSX. Exact change: move these intact into task-specific local tabs. Reason: reading the application is delayed by secondary tasks. Expected outcome: application tabs follow identity and applicable warnings. Verification: render default and new sections, keyboard navigation, responsive screenshots.
2. Severity: medium. Element: Grant conflict disclosure. State: unassigned administrator/viewer. Observed problem: full inactive guidance occupies the entry view. Evidence: route always renders disclosure for nonduplicates. Exact change: retain active-assignment or held-conflict guidance above content; place unassigned guidance under Reviewers. Reason: keep actionable gates visible without making inactive controls dominate. Expected outcome: required decisions remain visible; inactive explanation stays reachable. Verification: assigned, unassigned, held and duplicate fixture states.

## Preservation and shared ownership

Preserve all queries, RPCs, roles, data, eligibility, rubric values, private-score access, certification, dirty-state blockers and explicit saves. No migrations required. Existing child components retain their internal forms and confirmation flows. Native tabs retain visited panels so switching does not discard drafts. Keep errors, test/practice labels, duplicate exclusion, submission confirmation and review readiness visible.

Improve the shared workspace with an optional per-section `showRubric` presentation flag, defaulting to existing behavior. Grant-specific content remains in the route. Scholarship receives no visual change. No parallel review engine, new dependency, font, palette, shell or route.

## Direction and reference

Considered three structures within the approved Phase E visual language: (A) existing task tabs with secondary work moved into sections; (B) a permanent administrative rail; (C) stacked collapsible administrative panels. Select A: it reuses the existing keyboard/state primitive, gives long forms the full width, and removes the administrative stack from the initial view. B competes with the existing evidence/rubric split; C leaves a second navigation layer above it. This is organizational refinement, not a new material art direction.

Mobbin anchor, inspected image: [Square record details](https://mobbin.com/screens/c2189054-bf67-41c9-98d3-95d887d46cbf). Its compact identity followed by Overview/Payroll/Documents tabs is one example of task-specific record sections. Borrow structure only, not its drawer, theme or domain. Other search results were consumer reviews, referral modal, job description and metadata sidebar; none supports this direction. Reference strength is one product, not multi-product precedent.

Apple skill: `references/hig/layout.md`, Visual hierarchy: “Order content by relative importance” and “Use progressive disclosure to make layouts cleaner and easier to interact with.” Apply foundations to this web app, not native Apple conventions. Retain native HTML, tokens and existing focus styling.

Move: administrative stack → Reviewers and Manage application tabs, based on Square's task-section structure. Exact labels, role placement and conflict placement are project judgment. No content or actions removed.

## Implementation-ready screen specification

Preserve shared sidebar, return navigation and existing identity/progress header. Align email/phone in a wrapping contact row on wider screens, stacking naturally on narrow screens. Preserve 44 CSS pixel contact targets and long-text wrapping.

Keep current Overview default and Application, Documents, Rubric tabs. Append Reviewers for all authorized readers, containing the existing assignment summary/history and unassigned conflict guidance. Append Manage application only under the existing `canScreen` permission: existing decision/email component keeps all original visibility guards; transfer/duplicate components keep current guards and confirmations. For excluded applications show explanatory empty state in management and retain exclusion warning above tabs.

Only overview/application/documents pair with the rubric at desktop widths. Reviewers/management use full width. Narrow tabs wrap in the existing two-column layout; no hidden overflow menu or horizontal page scrolling. Required conflict decision remains above tabs for active assignments; held state remains visible regardless of assignment. Submitted/test/practice/duplicate notices remain unchanged. Summary loading/error/retry remains in Reviewers while progress continues to expose unknown/error state in the header.

Verification: npm tests, TypeScript, production build, formatting/diff checks; local fixture render and keyboard/panel retention checks at 320, 375, 390, 768, 1024, 1440 CSS pixels. Record limits instead of claiming authenticated production acceptance.

## Verification evidence

- Existing suite: 196 tests passed. TypeScript and production build passed; build reports existing large-chunk and dependency annotation warnings.
- Headless Edge rendered the actual route's presentation JSX and existing child components using fictional local data. Data transport and letter download were stubbed; external network requests blocked. This checks presentation and local interaction, not authentication or database enforcement.
- At 320, 375, 390, 768, 1024 and 1440 CSS pixels: no horizontal page overflow; Reviewers and Manage application suppress the companion rubric; Home/End keyboard navigation works; a typed decision-reason draft survives a tab round trip. No browser runtime errors.
- Local states checked: admin, viewer, assigned reviewer, held conflict, submitted, duplicate and assignment-summary failure. Active/held conflict guidance remains visible. Viewer has no Manage application tab. Assignment-summary failure has a visible header action opening the retry section. Duplicate exclusion remains visible.
- Same 1440-pixel fixture before/after: application tabs move from y=1282.5 to y=450 CSS pixels. These measurements apply to this fixture only; actual content and the authenticated shell affect placement.
- Visual review: responsive wrapping and the existing mobile tab grid retained. The long eligibility checklist itself remains unchanged; this increment addresses the administrative stack before the application, not eligibility form redesign.
- Browser evidence and self-contained before/after board are under ignored `.layout-check.local/`. Neither fixture nor preview routing enters the shipped application.
- Not performed: authenticated production verification, live saves/submissions, email sending, real transfers, duplicate designation, database tests or deployment. Full assistive-technology acceptance remains a release check; keyboard and DOM checks are not a claim of complete WCAG conformance.
