# Concept B verification — October 20, 2026

Branch: `business-grant-concept-b`.

## Implemented scope

Grant-only horizontal masthead, primary navigation and administrator navigation; compact native destination selector on mobile. Existing permitted routes and program/sign-out departure guards are retained. The Scholarship shell remains on its existing path.

The shared review workspace accepts an opt-in evidence layout. Above 1200 CSS pixels, the selected application/overview/document pane sits beside the existing rubric instance. Both panes scroll independently. Below that width, section tabs remain the navigation mechanism. Rubric inputs remain mounted and use the existing score/comment/certification state and persistence handlers. Application section scoring remains available in the compact presentation. No rubric, eligibility, certification, funding-band or submission rules were changed.

The Grant-scoped visual layer covers dashboard, applications, rankings, rubric management, imports, testing, distribution, user access, help and application detail. It standardizes flat surfaces, typography, table treatment, controls and task headers. The import chooser is now keyboard-accessible. Existing dashboard/queue edits were preserved.

## Evidence

- **PASS:** 165 unit regression tests.
- **PASS:** TypeScript without emission and production build.
- **PASS:** Targeted lint; one existing `react-refresh/only-export-components` warning for the shared workspace utility export, no errors.
- **PASS:** Synthetic reviewer journey: tab input retention, dirty route/sign-out/reload guards, failed-save retention, pending-save departure, successful draft save, certification/submission confirmation, next-work navigation and queue holds.
- **PASS:** Synthetic Scholarship regression: retained tab input, departure guard, failed-save retention and explicit draft save.
- **PASS:** Synthetic admin journey: conflict decision prerequisites, rejected-write retention, replacement feedback, duplicate prevention, failed/empty candidates, practice cancellation/reset/end, assignment navigation, unassigned-admin/declaration/rubric/eligibility gates, authorized exception, seven-criterion draft/certification and archived assignment save lock.
- **PASS:** Concept B fixture: score and comment continuity across 320, 375, 390, 768, 1024 and 1440 CSS pixels, then explicit draft save.
- **PASS:** All nine Grant destinations have exact-heading readiness checks, six-width overflow checks, screenshots and automated WCAG-tagged scans. Workspace also has a whole-page automated scan. No violations in the tested scan states.

## Reproducible local checks

Use `npm test`, `npx tsc --noEmit`, and `npm run build`.

Run the local preview with synthetic Supabase URL `http://127.0.0.1:54329` and a synthetic publishable key. The browser fixture intercepts backend calls, blocks external hosts and unexpected writes, and keeps permitted fixture writes in memory.

`supabase/tests/reviewer-usability-browser.mjs` supports the original reviewer journey, `--admin-practice`, and the new `--concept-b` presentation/state audit. Set `USABILITY_PREVIEW_ORIGIN` to the loopback preview and `PLAYWRIGHT_BROWSERS_PATH` to the installed browser location when necessary.

Ignored local evidence: `supabase/.temp/concept-b/` (screenshots, route scan JSON, unit and build logs); earlier reviewer/admin journey evidence remains under `supabase/.temp/reviewer-usability/`.

## Limits

These are local synthetic results, not hosted RLS, real-account, production data, email, invitation, import or deployment proof. No migration, deployment, live assignment or account mutation was performed. The route audit verifies presentation of fixture states; it does not re-execute every administrator mutation. Rankings include pending-review fixture records, while ranking calculations and tie/exception logic are covered by the existing unit suite.

The fixture blocks Google Fonts, so screenshots use the existing font fallback; production-font rendering remains to be reviewed in the normal authenticated preview. Automated accessibility scans are not a complete WCAG certification; screen-reader and real-user acceptance remain manual.

## Resolved visual findings

- Severity: medium. Element: wide review workspace. State: long rubric at 1440px. Observed problem: scrolling the full page moved short evidence out of sight. Evidence: initial fixture screenshot. Exact change: independently scrollable evidence/evaluation regions with retained keyboard focusability. Reason: keep source material available while evaluating. Expected outcome: side-by-side reading throughout a long rubric. Verification: final split-pane screenshot and resize/state fixture.
- Severity: medium. Element: import file chooser. State: keyboard input. Observed problem: file input used `display:none`. Evidence: original import JSX. Exact change: visible native file control with focus-within treatment. Reason: keyboard users need the same import entry point. Expected outcome: focusable file selection. Verification: source inspection, rendered mobile screenshot and automated scan.
