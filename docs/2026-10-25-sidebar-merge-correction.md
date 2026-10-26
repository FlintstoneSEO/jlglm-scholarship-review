# Restore the portal sidebar after the main merge

## Verified cause and scope

The production domain review.justiceleagueglm.org resolves in Vercel to deployment dpl_6MtpRjsuEHu3hfMTub4pkih1fSV1, READY, production, commit e09eb372d93bdf90beee2619c841736b93e055c4 on main. This is the merge of PR #17. Git fetch confirmed that commit is current origin/main during this investigation. Vercel is serving the expected main revision.

Commit 36268b4 introduced a Grant-only early return in AppShell that renders GrantShell. Its black masthead and separate horizontal administration row match the user's production screenshot. The sidebar branch remains below the early return, so Grant pages never render it. The separate local preview checkout at C:/Users/wende/.codex/worktrees/4e17/jlglm-scholarship-review renders the shared sidebar instead. The difference is in source code, not a claim about browser caching or screen width.

The approved combined progress dashboard and original-group reviewer attribution were still uncommitted in that preview checkout and absent from origin/main. The correction branch codex/restore-portal-sidebar starts at current origin/main and incorporates those completed changes without replacing other merged content/workflow improvements. The preview checkout's existing files were read, not reset or moved.

## Issue and implementation specification

- Severity: high. Element: AppShell's Business Growth Grant shell selection. Route/state: authenticated Grant pages on production at desktop widths. Observed problem: navigation appears in a top masthead instead of the reviewed left sidebar. Evidence: supplied production screenshot, AppShell early return in 36268b4, production commit/alias metadata. Exact change: remove the Grant-only shell early return and use the existing shared sidebar for both programs. Retain Grant content wrappers, skip link and scoped evidence/content styles, overriding only the shell's flex direction. Reason: restore the reviewed navigation while preserving useful content improvements. Expected outcome: desktop shows the existing collapsible sidebar and mobile retains the existing program/navigation controls. Verification: synthetic admin sidebar visibility and collapse/expand assertions; reviewer content continuity across widths; role-filtered navigation, all administrative destinations, progress and conflict regression; scoped automated accessibility and reflow checks.

This is a presentation correction. Preserve program/role filtering, authentication, sign-out/program-switch departure guards, routes, real/practice separation, scoring, assignment and conflict semantics, browser data queries and persisted records. No database migration or data access change is needed. GrantShell remains unused historical source; removing its unrelated markup/CSS is not necessary for the fix.

## Validation and release boundary

Local checks and evidence are recorded below on completion. All browser provider records and writes are intercepted synthetic fixtures, with external hosts blocked. Local browser evidence does not establish hosted role/RLS behavior or a complete screen-reader audit. No production deploy, main push or hosted mutation is part of this correction preparation. Existing Phase F release gates remain unchanged.

## Completed local validation

- PASS: 178 Node tests, TypeScript, scoped ESLint, formatting and diff whitespace checks; production build completed. Existing dependency annotation / bundle warnings remain.
- PASS: restored desktop sidebar is visible at 1440px, collapses to 80px and expands to 256px; top masthead is absent.
- PASS: Concept B synthetic browser suite: evidence/rubric score and comment continuity across resize, explicit draft saving, and Dashboard, Applications, Rankings, Rubric, Import, Testing, Distribution, Users and Help at 320, 375, 390, 768, 1024 and 1440 CSS px. No page/main horizontal overflow or automated WCAG-tagged scan violations in tested regions.
- PASS: distribution browser suite: group revision/editing, stale allocation rejection, exclusions, explicit confirmation, conflict replacement/history, retained drafts, combined batches, original-group membership and overall/filter totals. Existing review and assignment records are preserved in its synthetic fixture.
- Visual inspection: desktop dashboard, split evidence/evaluation workspace, and the combined progress view at the supplied 1086px width show the sidebar and retained content design. Screenshots and JSON reports are under ignored supabase/.temp/concept-b and supabase/.temp/distribution-redesign.

The browser fixture's initial cold-start page load exceeded its old 12-second timeout; it now permits 60 seconds for initial navigation and waits for DOM content. The full unchanged interaction paths then passed. External fonts remain blocked in synthetic checks. Production has not been changed by this work.
