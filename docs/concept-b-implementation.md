# Concept B implementation specification

Authorized October 20, 2026: redesign all Business Growth Grant sections using the written Evidence & Evaluation direction and supplied concept image. This supersedes the earlier rail-preservation presentation scope. The image contains fictional content; none is application data.

## Current audit and preservation boundary

Current code uses TanStack Start, React, npm, Tailwind, shared ReviewWorkspace/ReviewRubric and program-aware AppShell. Scholarship and Grant share mechanics but retain distinct application content and scoring adapters. Preserve these primitives; introduce an opt-in evidence layout rather than a second review engine. No database, query, mutation, eligibility, conflict, certification, scoring, assignment, authentication, route or program-access changes.

Reviewer journey: dashboard → filtered applications → conflict declaration / eligibility readiness → evidence and documents → scores/comments → explicit draft save → certification → submit → completion. Admin journeys: screening, ranking comparison, rubric lifecycle, import validation then explicit import, practice administration, grouped allocation then explicit application, conflict resolution, and user invitations/access. Existing error, partial, loading, empty, disabled and completed branches remain authoritative.

## Findings and choices

- Severity: medium. Element: AppShell. State: all Grant routes, desktop. Problem: a wide permanent rail consumes evidence space. Evidence: current 256px sidebar and nested review panes. Change: Grant-only black masthead, primary horizontal navigation, separate admin navigation row. Reason: accommodate evidence and rubric. Outcome: broad usable workspace. Verify: all role-visible destinations and program/account controls at 320–1440px.
- Severity: medium. Element: ReviewWorkspace. State: Grant application detail. Problem: full rubric and narrative occupy separate tabs. Evidence: sections array in Grant detail. Change: opt-in split layout showing the existing rubric next to selected evidence at wide widths, retaining tabs below 1200px. Reason: reduce context switching. Outcome: read and assess together with the same state and write handlers. Verify: score continuity across tabs/resizing, gates and draft/submit fixtures.
- Severity: medium. Element: shared Grant route presentation. State: admin and reviewer. Problem: nested elevated panels and uppercase headings compete with task hierarchy. Evidence: route Card/heading classes. Change: scoped flat white surfaces, sentence-case headings, ruled tables and consistent action/control rhythm. Reason: coherent operational presentation. Outcome: records and actions dominate decoration. Verify: route inventory, responsive screenshots and keyboard/contrast checks.

## Screen specifications

| Screen | Dominant task / composition | States and actions retained | Compact adaptation |
| --- | --- | --- | --- |
| Dashboard | Business-first work register and compact progress ledger | Current counts, scope, refresh, screening, review links | Ledger wraps, labeled record rows |
| Applications | Search/filter toolbar over ruled register | Search/status/advanced filters, scope, reset, screening | Existing record cards and filter disclosure |
| Application detail | Record identity, section tabs, broad evidence plus narrower evaluation | Overview/checklist, narrative navigation, documents, rubric, comments, funding guidance, conflict and certification | Single mounted tab panels; explicit Application/Rubric switching |
| Rankings | Comparison ledger with aligned numeric columns | All completeness, exception, certification, tie and pending indicators | Labeled records, original values and links |
| Rubric | Version controls and criterion register | Draft creation, activation, retirement and immutability | Controls wrap; criteria remain readable |
| Import | File/source tools followed by validation ledger | Preview before explicit import, errors and results | Full-width controls and labeled records |
| Testing | Practice controls and session register | Seed/reset/end confirmations and test labeling | Stacked controls and records |
| Review Distribution | Existing ordered group/allocation/progress stages | Attention, history, conflict resolution and explicit apply | Existing disclosures, wrapping tools |
| Users & Access | User register with invitation/edit dialogs | Role/program gates, validations and explicit actions | Stacked user records and original dialogs |
| Help | Readable reference with indexed sections | All authoritative guidance and role-specific content | Single reading column |

Masthead is static within the shell, main content scrolls. Reviewer navigation contains Dashboard, Applications and Help. Admin row contains existing administrative destinations only. At narrow widths a labeled native navigation selector contains all permitted destinations. Preserve departure guards on program changes and sign-out. Keep Justice League tokens, Inter and Lucide. No ornamental motion, new fonts, fabricated content or decorative edge stripes.

## Verification boundary

Run unit regression, TypeScript/build and synthetic reviewer/admin browser journeys. Test 320, 375, 390, 768, 1024 and 1440 widths, including split-pane score continuity. Local fixtures do not prove hosted authorization, real-account writes or production behavior. No deployment is authorized by this implementation.
