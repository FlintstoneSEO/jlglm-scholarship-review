# Phase E — Justice League portal visual system

Date: 2026-09-27. Scope: presentation in the existing TanStack Start portal, explicitly authorized by the Phase E request. Phase D review, rubric, assignment, score, submission, route, and authorization behavior is the preservation boundary. The selected navigation destinations and queue → workspace flow remain the Phase C/D design. Phases A–D are complete; [Phase D status](phase-d-live-verification.md) distinguishes tested functional/database behavior from production-release-only checks. Those release checks do not block Phase E.

## Visual audit and decision

The login's black panel, white text, and restrained brand accents are the strongest existing brand reference. Before Phase E, `src/styles.css` used cream backgrounds (`#f7f6f1`, `#eeede5`, `#efeee8`, `#f8edd0`); the authenticated shell was green, page labels used yellow text on light surfaces, mobile destinations were pills, and queue statuses were all neutral outlines. The shared rubric used one rounded card per criterion. Routes have few direct hex values; most color drift came from semantic tokens and repeated utility choices. The only route-level canonical hex found was the login black panel, now sourced from the shell token. The Recharts selectors in `ui/chart.tsx` contain library stroke selectors (`#ccc`, `#fff`), not portal palette declarations.

Three directions considered for the authenticated shell:

1. **Black institutional rail, green task actions, yellow active marker.** Strongest link to login, with white reading panels. Selected because it clarifies structure without darkening long application content.
2. **Deep green rail with black cap and yellow marker.** Keeps the previous green emphasis but separates the application less clearly from the login's black identity.
3. **White utility masthead with black top band and compact horizontal navigation.** Gives maximum canvas width but changes the Phase C navigation hierarchy and would make long admin destinations harder to scan.

The selected direction keeps the sidebar archetype and every destination. Desktop has a black rail, white logo area, program context selector, muted links, green active surface with a yellow marker, and a quiet identity/sign-out area. Mobile has a black brand header, a full-width program selector, and horizontally scrollable underlined task tabs. The selector switches context through the existing handler. The active state has both text/surface change and a marker.

At desktop widths (768 px and above), the left rail is anchored to the viewport. Only its navigation list scrolls if necessary; the account and sign-out area stays visible. The right `main` region owns vertical scrolling. Mobile keeps normal single-column document scrolling.

## Tokens and use

| Role             | Value or token          | Use                                                                        |
| ---------------- | ----------------------- | -------------------------------------------------------------------------- |
| Canonical red    | `--jl-red: #d71920`     | Exceptions, validation, destructive actions                                |
| Canonical green  | `--jl-green: #006633`   | Primary action, completion, navigation state                               |
| Canonical yellow | `--jl-yellow: #f4b400`  | Active marker and contained emphasis                                       |
| Canonical black  | `--jl-black: #050505`   | Structural shell                                                           |
| Canonical white  | `--jl-white: #ffffff`   | Cards and high contrast text                                               |
| Workspace        | `--background: #f7f7f5` | Neutral page canvas                                                        |
| Card             | `--card: #ffffff`       | Application, form, queue, and admin reading surface                        |
| Secondary/muted  | `#f0f2f0` / `#f2f3f2`   | Table headers, subtotal bands, low emphasis panels                         |
| Border/input     | `#d9dedb` / `#b7c2ba`   | Separation and field edges                                                 |
| Primary text     | `#171a18`               | Content and headings                                                       |
| Secondary text   | `#59615c`               | Supporting content                                                         |
| Warning text     | `#795600`               | Readable warning copy on light surfaces; yellow remains the accent surface |

`primary`, `success`, and `brand-green` refer to canonical green in the default theme. `destructive` and `brand-red` refer to canonical red. `gold` is canonical yellow; `warning` is a dark derivative for text. `ring` is green on light surfaces and yellow in the black rail. `accent` is a restrained green tint. The base radius is `0.5rem`; cards use subtle shadow, border, and surface separation. Inter remains the typeface. Small uppercase labels orient users; application content uses normal case.

Button meanings: default is green Submit/primary, outline is white/neutral Save Draft and secondary tasks, accent is yellow when emphasis has a specific purpose, destructive is red, and dark is structural. Reopen is an administrative task and should use secondary treatment. Status meanings: neutral for not started/retired, yellow tint and dark warning text for in progress/draft, green for completed/active, red for errors and unavailable states. Every state retains a text label. Program names have a neutral badge and no invented program color.

## Screen specifications

| Screen                                                              | Task and hierarchy                                                                                           | States/actions                                                                                                                                         | Responsive treatment                                                                                   |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Dashboard                                                           | Program heading, direct route to queue, metrics, then decision support                                       | Semantic color belongs to icons, status markers, progress, or readable labels, never decorative card edges. Existing counts and actions are unchanged. | Metrics reflow; labels and values stay readable.                                                       |
| Scholarship and Grant queues                                        | Filter/context, neutral table header, applicant, status, progress, labeled Open action                       | Loading, empty, partial error, unavailable, and retry text remain. Status color supplements labels.                                                    | Table scrolls within its panel; 44 px action target.                                                   |
| Shared workspace                                                    | Applicant identity and status above a white application panel; review progress and action rail stay distinct | Tabs, documents, rubric, notes/comments, Save Draft and Submit preserve existing behavior. Unsaved/partial/error states retain text.                   | Application content and rail stack; tabs scroll horizontally; inputs remain touch friendly.            |
| Rubric                                                              | Criterion title/description, score, maximum, validation, subtotal                                            | Criteria are rows separated by rules; invalid values have red text plus an error message. Arbitrary criterion counts/maxima stay dynamic.              | Score control and label wrap without reducing target size.                                             |
| Assignments, users, rankings, imports, contact, and scoring summary | Page title, operational controls, then white tables/forms                                                    | Shared cards, buttons, inputs, and neutral tokens carry the system into these routes. Route-specific status text uses readable warning color.          | Existing responsive table and form behavior remains; release QA must inspect real data and long names. |
| Grant rubric management                                             | Version list, selected version, draft editor or read-only summary, criteria                                  | Active green, Draft yellow, Retired neutral; labels remain explicit. Activation and criteria behavior is unchanged.                                    | Columns stack and version controls wrap.                                                               |
| Login                                                               | Existing black reference panel and light sign-in form                                                        | No auth behavior change.                                                                                                                               | Existing mobile form remains.                                                                          |

Grant uses four neutral white operational metric cards with a normal border, open semantic icons, neutral numeric values, and readable labels. Scholarship has eight metrics in one grouped statistics panel: the first four application/review counts receive larger values; the secondary four share a quieter lower band separated by an internal rule. Neither dashboard uses repeated colored icon squares or decorative card stripes. The Scholarship help message uses a light yellow surface, open book icon, text, and a guide action without an edge stripe.

## Anti-template composition rule

Do not use decorative colored left-edge accent borders on KPI, metric, feature, service, testimonial, informational, or summary cards as a default composition device. Do not introduce colored card-edge stripes merely to manufacture visual variety. Prefer hierarchy through typography, whitespace, iconography, surface contrast, grouping, internal dividers, meaningful semantic indicators, and layout composition. An edge accent is permitted only when it represents a specific persistent state, selection, relationship, or navigation context that cannot be communicated more clearly another way.

The focused anti-template review also checked repeated colored icon squares, equal-card grids, nested cards, eyebrow/heading/body repetition, decorative gradients, excessive pills, and empty padding. The repeated KPI icon boxes and eight separate Scholarship cards were removed. Program-choice icon squares identify two selectable programs; status badges carry explicit state labels; ranking circles identify rank. Those uses serve specific tasks and were retained. The existing ranking gradient was present before this Phase E correction; it can be reassessed in Phase F rendered QA if it distracts from ranking data.

## Accessibility and validation boundary

Calculated WCAG contrast ratios for the default tokens: white/green **7.12:1**, black/yellow **11.04:1**, white/black **20.38:1**, white/red **5.19:1**, green/white **7.12:1**, red/white **5.19:1**, muted text/workspace **5.95:1**, warning text/white **6.68:1**, sidebar text/green active surface **10.95:1**. Yellow text on white is avoided. Buttons and mobile tabs use visible two-pixel focus rings; queue/document actions have text labels and keyboard focus. Default light mode is the exposed experience; `.dark` token mappings are retained for compatibility, with no mode switch introduced.

Code checks and contrast calculations do not prove rendered QA or real browser role-token behavior. The release review should inspect authenticated Dashboard, both queues and workspaces, Assignments, Users, Rubric, Rankings, and Imports at 375, 390, 768, 1024, and 1440 CSS pixels using representative long records. Phase F QA has not begun.

## Committee-approved Business Growth Grant rubric — 2026-09-27

The committee's `Evaluation Rubric.docx` is the source for the seven competitive criteria. Live Grant v2 was created as a draft with `create_rubric_version`, populated, checked for order and maxima, and activated with `activate_rubric_version`. Live readback shows v2 active with **15 + 15 + 15 + 20 + 15 + 10 + 10 = 100** and the former empty v1 retired. The operational transaction is in `supabase/scripts/configure_approved_grant_rubric.sql`. No schema migration or Phase D submission change was made.

Eligibility and compliance are **pass/fail and separate from the 100-point score**. The Grant overview groups owner/program eligibility, LARA standing, required documentation, and 2024/2025 P&L availability. It presents source answers and document presence for human screening; it does not assert an automated pass or prevent submission. A formal eligibility gate would require a separate workflow/data decision.

The shared rubric row remains compact. Grant criteria receive a criterion-specific expandable **View scoring guidance** disclosure from `src/lib/grant-rubric-guidance.ts`, using the document's five score bands per criterion. The Grant reviewer panel also offers collapsed reviewer questions, red flags, funding tiers, and consistency/conflict guidance. Red flags do not automatically deny an application. Funding tiers are decision support; score never assigns an award. The source's Strongly Recommend / Recommend / Consider / Do Not Recommend options are shown as guidance only. `program_reviews` has no approved structured Grant recommendation field; adding persistence requires a separate schema and workflow decision, and `reviewer_comments` is not used as a substitute.

Local tests and build verify configuration shape and rendering code, while live SQL readback verifies the active version and stored criteria. Deployed UI, real reviewer tokens, eligibility screening practice, and a final submission against v2 still need browser validation. Phase F remains separately gated.

## Responsive reviewer workflow pass

The shared queue now uses a full-row applicant link below 1024 px. Grant items lead with the business name, followed by applicant identity, review status, completed/assigned progress, and a clear View application affordance. Secondary Grant filters collapse behind More filters on narrow screens. Desktop keeps the data table. Scholarship uses the same compact queue mechanics without changing its program-specific columns, filters, or review rules.

The Grant workspace now starts with a concise applicant, eligibility/compliance, and business summary. Record indicators say **Needs review** or **Missing** and do not claim that an applicant passed eligibility. Long answers are grouped into seven native disclosure sections; Business & Market starts open, while the others start closed. Content remains available in the complete imported response disclosure. Sections use dividers and readable long-form text instead of a card for each answer group. The shared workspace tab strip stays within the scrolling content area and supports arrow, Home, and End keyboard navigation. The desktop left shell remains fixed with right-side scrolling; mobile retains normal document scrolling.

Grant rubric scores remain visible with their existing numeric controls. Criterion-specific score bands, reviewer questions, red flags, funding tiers, and the pre-submit consistency/conflict reminder use collapsed disclosures. The funding tiers use a stacked definition list on narrow screens. These are presentation aids only: eligibility is still pass/fail outside the 100-point score, red flags are not automatic deductions or denials, and tiers do not set award status.

Intentional horizontal scrolling remains on the mobile portal navigation and workspace tab strips. Desktop queue tables and true comparison/operational grids (rankings, assignments, users, and import previews) retain their contained table overflow. The applicant queue has a usable mobile alternative and does not require horizontal scrolling to open an application.

Rendered checks at 320, 375, 390, 428, 768, 1024, 1280, and 1440 px found no page-level horizontal overflow on the authenticated Grant queue, Grant detail, Grant rankings, assignments, users, Grant rubric management, Grant import, Scholarship applicants, or Scholarship import. The queue showed its compact list through 768 px and its table from 1024 px; mobile applicant links exceeded 44 px in height. Seven rubric inputs fit at all checked widths. The Overview, Application, Documents, and Rubric tabs were reachable at 375 px; criterion guidance opened and closed, and the application disclosures began with only Business & Market open. The program selector switched between Grant and Scholarship. The Scholarship queue was empty in this session, so populated Scholarship rows were not visually exercised.

The rendered sweep exposed a 320 px overflow on Assignments caused by an absolutely positioned screen-reader-only label inside a table action. The action now uses an accessible button name and a 44 px target. It also exposed a 320 px Grant rubric management grid whose implicit minimum column exceeded the viewport; that grid now uses a zero-minimum single column on mobile. Both routes were retested without page overflow.

The admin session confirmed the active Grant detail displays seven criteria totaling 100 points and the eligibility summary. A full reviewer flow, including the enabled score controls and Save Draft/Submit actions, still requires a reviewer account. No review submission or application data mutation was performed during this QA pass.

## Follow-up navigation and Grant reading layout — 2026-09-27

The user requested that navigation and record opening never require horizontal scrolling. Mobile portal destinations now use one labeled native selector. Workspace tabs wrap into a two-column grid on narrow screens and a wrapping row above that. The shared review queue now presents every record as a full-card link, with metadata in a responsive grid and Scholarship selection/actions outside the link. The desktop table was removed because its Grant columns overflowed the available reading width. These are presentation changes; queue membership, filters, routes, role checks, and stored review data are unchanged.

The Grant workspace uses the full available content width when it has no separate action rail. Overview applicant, eligibility/compliance, and business summary groups have distinct panels. Eligibility source indicators have explicit **Needs review** or **Missing** labels and stronger surfaces; neither label is an automated eligibility determination. The Application view uses a section selector on the left at desktop widths and a two-column selector above the reading panel on narrow screens. Each section shows one set of long-form answers at a time, including the complete imported response as its own selectable section. This changes disclosure/navigation only and does not modify imported answers.

Local TypeScript checking passed. In the authenticated admin browser, Grant queue and detail had no page-level horizontal overflow at 320, 390, 768, 1024, and 1440 px. All 20 Grant queue records exposed full-record links at the checked widths. The Application selector and right reading panel were visually inspected at 390 and 1024 px. The initial sandboxed Vite build could not load `vite.config.ts` (`Access is denied` before compilation). The build then completed successfully with filesystem escalation. All 38 local tests passed; TypeScript checking passed; scoped ESLint reported no errors and three pre-existing fast-refresh export warnings. Reviewer-role submission behavior was not exercised during this visual pass.

## Grant application reading and scoring workspace

The reviewer task is to read one application section, score its corresponding active criterion, save a draft, then complete comments and certification on the full Rubric tab. At viewports of at least 1500 CSS pixels, the Application tab uses three content columns: section navigation, answers, and contextual scoring. From 1100 to 1499 pixels, the scoring panel follows the answers in the reading column. Below 1100 pixels, navigation, answers, and scoring follow document order. The existing portal rail remains outside these columns.

The complete imported response is removed from the Application section selector. The seven organized response sections, Overview eligibility/source indicators, and Documents tab remain the normal review path. The raw response stays in imported data for provenance; future or unmapped source questions are not automatically surfaced by this focused reading view. A View full rubric control switches to the existing Rubric tab without changing route or discarding the shared score draft. Both tabs use the same Save Draft handler, assignment/eligibility/rubric gate, canonical write adapter, pending state, and success/error feedback. Submission, comments, and certification remain on the full Rubric tab. Completed reviews show scores read only.

Local verification for this change: TypeScript passed, all 80 Node tests passed, scoped ESLint had no errors and one existing Fast Refresh export warning, and the Vercel/Nitro production build passed with filesystem escalation after the sandbox could not read `vite.config.ts`. No authenticated browser or reviewer-role Save Draft check was available in this session, so the three-column rendered layout and live reviewer write remain unverified.

## Collapsible portal rail and independent Grant reading scroll

The desktop portal rail keeps its vertical destinations and can be collapsed to an icon rail. Hovering or focusing the collapsed rail temporarily reveals the full labels in an overlay so the application width does not jump. The toggle restores a permanently expanded rail. Program switching and sign-out remain present in both states, and icon-only controls have accessible names. The mobile program and destination selectors are unchanged.

The Grant Application section selector is a vertical list at every viewport, avoiding compressed multi-column labels. At 1500 CSS pixels and above, the answer panel and the contextual scoring content each scroll independently within a 65dvh workspace. Selecting another section resets both panel scroll positions so its heading and criterion are visible. The scoring actions stay below the scoring scroll area. Narrower layouts follow normal document scrolling and the existing stacked panel order. This is a presentation change; scoring and draft persistence still use the same route state and canonical write path.

Local validation: TypeScript, all 80 tests, scoped ESLint, and the Vercel/Nitro build passed. The supplied screenshot identified the compressed section selector; a post-change authenticated screenshot and reviewer-role save check were unavailable in this session.

### Sidebar and scoring scroll correction

A subsequent authenticated screenshot showed the full-width collapse button making the desktop sidebar navigation scroll, and the scoring field overflowing horizontally inside a narrow nested scroll area. The collapse control now sits beside the brand as an icon button, and the brand, program, navigation, and account spacing is compact enough to keep all Grant destinations visible at the supplied desktop height. At wide widths, the entire contextual scoring panel is one vertical scroll area, including guidance, Save Draft, and View full rubric. The inline score field stacks its label and input and stacks guidance bands within this rail; the full Rubric tab retains its existing row layout. The answer panel still scrolls independently.

TypeScript, all 80 local tests, scoped ESLint, and the Vercel/Nitro build passed after this correction. The screenshot predates the correction; a rendered follow-up was unavailable because no authenticated browser was attached to this session.

### Full-width Grant reading panel

The Grant detail route now uses the full width available beside the portal sidebar instead of the general 1400px page cap. Its application grid retains bounded navigation and scoring columns and assigns all remaining width to the answer column. The answer panel itself fills that grid track at every viewport; the existing independent scrolling behavior at wide widths remains.

The wide-screen answer and scoring panels now use the viewport height minus 4rem, replacing the former 65dvh limit. They grow and shrink with the browser height while retaining separate internal scrolling. Narrow layouts still use normal document height so the stacked application remains readable.

### Content-driven Grant workspace height

The viewport-height panel rule above is superseded. The user clarified that the surrounding Application tab should grow to the height of the selected answer section or the expanded scoring guidance, whichever is taller. The section selector, answers, and scoring panel now have natural content height with no internal scroll limit. The page's normal scroll reaches long answers and guidance, while the grid row and surrounding workspace surface expand with the tallest column. Width remains flexible as described above; scoring and save behavior are unchanged.
