# Phase E — Justice League portal visual system

Date: 2026-09-27. Scope: presentation in the existing TanStack Start portal, explicitly authorized by the Phase E request. Phase D review, rubric, assignment, score, submission, route, and authorization behavior is the preservation boundary. The selected navigation destinations and queue → workspace flow remain the Phase C/D design. The request describes Phase D as verified, while `docs/phase-d-live-verification.md` still records outstanding database behavior and release checks; this visual implementation does not resolve or certify those checks.

## Visual audit and decision

The login's black panel, white text, and restrained brand accents are the strongest existing brand reference. Before Phase E, `src/styles.css` used cream backgrounds (`#f7f6f1`, `#eeede5`, `#efeee8`, `#f8edd0`); the authenticated shell was green, page labels used yellow text on light surfaces, mobile destinations were pills, and queue statuses were all neutral outlines. The shared rubric used one rounded card per criterion. Routes have few direct hex values; most color drift came from semantic tokens and repeated utility choices. The only route-level canonical hex found was the login black panel, now sourced from the shell token. The Recharts selectors in `ui/chart.tsx` contain library stroke selectors (`#ccc`, `#fff`), not portal palette declarations.

Three directions considered for the authenticated shell:

1. **Black institutional rail, green task actions, yellow active marker.** Strongest link to login, with white reading panels. Selected because it clarifies structure without darkening long application content.
2. **Deep green rail with black cap and yellow marker.** Keeps the previous green emphasis but separates the application less clearly from the login's black identity.
3. **White utility masthead with black top band and compact horizontal navigation.** Gives maximum canvas width but changes the Phase C navigation hierarchy and would make long admin destinations harder to scan.

The selected direction keeps the sidebar archetype and every destination. Desktop has a black rail, white logo area, program context selector, muted links, green active surface with a yellow marker, and a quiet identity/sign-out area. Mobile has a black brand header, a full-width program selector, and horizontally scrollable underlined task tabs. The selector switches context through the existing handler. The active state has both text/surface change and a marker.

## Tokens and use

| Role | Value or token | Use |
|---|---|---|
| Canonical red | `--jl-red: #d71920` | Exceptions, validation, destructive actions |
| Canonical green | `--jl-green: #006633` | Primary action, completion, navigation state |
| Canonical yellow | `--jl-yellow: #f4b400` | Active marker and contained emphasis |
| Canonical black | `--jl-black: #050505` | Structural shell |
| Canonical white | `--jl-white: #ffffff` | Cards and high contrast text |
| Workspace | `--background: #f7f7f5` | Neutral page canvas |
| Card | `--card: #ffffff` | Application, form, queue, and admin reading surface |
| Secondary/muted | `#f0f2f0` / `#f2f3f2` | Table headers, subtotal bands, low emphasis panels |
| Border/input | `#d9dedb` / `#b7c2ba` | Separation and field edges |
| Primary text | `#171a18` | Content and headings |
| Secondary text | `#59615c` | Supporting content |
| Warning text | `#795600` | Readable warning copy on light surfaces; yellow remains the accent surface |

`primary`, `success`, and `brand-green` refer to canonical green in the default theme. `destructive` and `brand-red` refer to canonical red. `gold` is canonical yellow; `warning` is a dark derivative for text. `ring` is green on light surfaces and yellow in the black rail. `accent` is a restrained green tint. The base radius is `0.5rem`; cards use subtle shadow, border, and surface separation. Inter remains the typeface. Small uppercase labels orient users; application content uses normal case.

Button meanings: default is green Submit/primary, outline is white/neutral Save Draft and secondary tasks, accent is yellow when emphasis has a specific purpose, destructive is red, and dark is structural. Reopen is an administrative task and should use secondary treatment. Status meanings: neutral for not started/retired, yellow tint and dark warning text for in progress/draft, green for completed/active, red for errors and unavailable states. Every state retains a text label. Program names have a neutral badge and no invented program color.

## Screen specifications

| Screen | Task and hierarchy | States/actions | Responsive treatment |
|---|---|---|---|
| Dashboard | Program heading, direct route to queue, metrics, then decision support | Metric accent follows meaning; red only on missing/failed data. Existing counts and actions are unchanged. | Metrics reflow; labels and values stay readable. |
| Scholarship and Grant queues | Filter/context, neutral table header, applicant, status, progress, labeled Open action | Loading, empty, partial error, unavailable, and retry text remain. Status color supplements labels. | Table scrolls within its panel; 44 px action target. |
| Shared workspace | Applicant identity and status above a white application panel; review progress and action rail stay distinct | Tabs, documents, rubric, notes/comments, Save Draft and Submit preserve existing behavior. Unsaved/partial/error states retain text. | Application content and rail stack; tabs scroll horizontally; inputs remain touch friendly. |
| Rubric | Criterion title/description, score, maximum, validation, subtotal | Criteria are rows separated by rules; invalid values have red text plus an error message. Arbitrary criterion counts/maxima stay dynamic. | Score control and label wrap without reducing target size. |
| Assignments, users, rankings, imports, contact, and scoring summary | Page title, operational controls, then white tables/forms | Shared cards, buttons, inputs, and neutral tokens carry the system into these routes. Route-specific status text uses readable warning color. | Existing responsive table and form behavior remains; release QA must inspect real data and long names. |
| Grant rubric management | Version list, selected version, draft editor or read-only summary, criteria | Active green, Draft yellow, Retired neutral; labels remain explicit. Activation and criteria behavior is unchanged. | Columns stack and version controls wrap. |
| Login | Existing black reference panel and light sign-in form | No auth behavior change. | Existing mobile form remains. |

## Accessibility and validation boundary

Calculated WCAG contrast ratios for the default tokens: white/green **7.12:1**, black/yellow **11.04:1**, white/black **20.38:1**, white/red **5.19:1**, green/white **7.12:1**, red/white **5.19:1**, muted text/workspace **5.95:1**, warning text/white **6.68:1**, sidebar text/green active surface **10.95:1**. Yellow text on white is avoided. Buttons and mobile tabs use visible two-pixel focus rings; queue/document actions have text labels and keyboard focus. Default light mode is the exposed experience; `.dark` token mappings are retained for compatibility, with no mode switch introduced.

Code checks and contrast calculations do not prove rendered QA, role-scoped behavior, or deployed Phase D database state. The release review should inspect authenticated Dashboard, both queues and workspaces, Assignments, Users, Rubric, Rankings, and Imports at 375, 390, 768, 1024, and 1440 CSS pixels using representative long records. Phase F QA has not begun.
