# Reviewer usability implementation handoff

Date: 2026-10-12. The initial handoff authorized Apple Design Skill and the eight items below. Local implementation has now proceeded in order; the completion checklist records current evidence and remaining validation.

## Completion checklist — local implementation

Specification and access analysis: `docs/2026-10-12-usability-implementation.md`. Changes remain uncommitted alongside the preserved pre-existing work.

- [x] 1. Shared dirty/pending departure guard and persistent explicit-save feedback in Grant and Scholarship. Visited panels remain mounted so Scholarship tab changes retain edits. Sign-out/program changes consult the guard before changing context. Grant refresh preserves dirty input and its original optimistic-lock version. Failed writes keep input. Successful screening Save & Next bypasses only already-saved eligibility work, never dirty review input.
- [x] 2. Personal conflict holds appear in Applications and dashboard; suspended assignments are excluded from a reviewer's active work. Missing reads report unknown availability. No new SELECT grants.
- [x] 3. Dashboard and Applications use the same viewer/program/scope cache key, explicit scope controls, local invalidation and 30-second foreground/focus revalidation. Screening continuation retains scope. Refresh reports pending/error state.
- [x] 4. Reviewer status/progress is explicitly personal; overall coverage is labeled unavailable. Administrative coverage remains separate. Scholarship detail also labels reviewer-only progress as personal. No partner-summary endpoint, migration or private peer access introduced.
- [x] 5. Score/funding summary is reachable from the workspace header. Existing bands, tier, provisional/submitted meaning and committee decision-support limits are explained before criteria. Thresholds remain unchanged.
- [x] 6. Persistent submitted confirmation, queue return and caller-filtered next-ready Grant navigation. Next lookup excludes held, suspended, submitted, undeclared, ineligible (without exception) and unavailable-rubric work; lookup failure/no matching work has explicit feedback. Scholarship has persistent confirmation/return. Previous save feedback clears on application change.
- [x] 7. Preserved the original local reason counter/helper improvement. Added complete unmet prerequisites, current candidate validation, duplicate-submit protection and result feedback without changing the resolution RPC or exclusion policy.
- [x] 8. Added practice preparation checklist, exact workspace blockers and reviewer-first Help. Administrative distribution/import/testing/rankings sections are shown only to admins. Guidance retains conflict declaration, eligibility and certification gates.

### Validation evidence

- **PASS:** 163 Node tests, including new personal-work and departure-state coverage; existing password/invitation recovery and funding-boundary tests remain passing.
- **PASS:** TypeScript, scoped lint (zero errors; three existing fast-refresh warnings), production build and diff whitespace checks. Initial restricted build failed with dependency-read EPERM; the permitted unchanged build passed. Existing dependency annotation/large-bundle warnings remain.
- **PASS — synthetic browser only:** `supabase/tests/reviewer-usability-browser.mjs` blocks external requests and intercepts local provider APIs. Grant dirty route/sign-out/reload cancellation, tab retention, rejected write retention, pending-write departure, explicit save, certification/submit confirmation, safe next link, queue hold display, dashboard consistency, reviewer-first Help, and Scholarship tab/departure/failure/save paths passed.
- **PASS — automated rendered reflow:** Grant rubric, Applications, dashboard and reviewer Help at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Grant rubric main-region axe scan returned zero violations for the requested WCAG tags. Selected desktop/mobile screenshots were inspected; a text-encoding defect was fixed. This is not a portal-wide accessibility certification.
- Browser evidence is in ignored `supabase/.temp/reviewer-usability/`. Preview uses loopback Supabase URL `http://127.0.0.1:54329` and a synthetic key; browser origin defaults to `http://127.0.0.1:4174`. The harness uses the same existing ignored Playwright/axe dependencies as other repository browser tests. No dependency manifest was changed.

### Administrator/practice local follow-up — 2026-10-12

Detailed findings, fixes, fixture commands and evidence boundaries: `docs/2026-10-12-admin-practice-validation.md`.

- **PASS:** Administrator clear/replace prerequisites, rejected-write retention, empty/failed candidate reads, success feedback and duplicate prevention. Successful resolution now stays locked; parent refresh failure has a separate read-only retry.
- **PASS:** Practice start/reset/end and round arguments, unassigned admin, declaration/rubric/eligibility blockers, explicit exception, fictional document opening and read-failure recovery, seven-criterion save/certify/submit, archived-assignment save blocking. Corrected practice destinations and test-scoped assignment link. Failed document reads now show the existing load-error state instead of false empty/readiness.
- **PASS:** Four isolated PGlite SQL suites (conflict resolution, practice sessions, certification, eligibility), including seven-criterion practice fixtures and self-contained certification setup. Existing reviewer/Scholarship synthetic regression, six-width reflow, scoped rubric axe, 163 Node tests, TypeScript, scoped lint, build and whitespace checks pass.
- **NEEDS MANUAL VALIDATION:** Hosted roles/RLS/storage and actual rubric/session configuration; concurrent changes; full device/keyboard/screen-reader and administrative visual testing. Synthetic evidence does not certify practice readiness in production. No real records/accounts changed and no deployment performed.

### Remaining hosted/device inputs

- Hosted role/RLS behavior with two safe reviewer accounts plus admin: externally reported/cleared/replaced conflict, original/replacement access, direct save denial and refresh across browsers. Synthetic UI fixtures do not establish hosted policy enforcement.
- Hosted administrator conflict resolution and practice-run readiness with the configured seven-criterion rubric, active/ended rounds, documents, eligibility/exception states and administrator without a scoring assignment. The corresponding local paths are validated above; hosted evidence remains separate. Existing real/practice data must remain separate.
- Browser/device-specific close-tab warnings, program-switch cancellation, keyboard/screen-reader task testing, full visual/typography review of all changed administrative states and supported widths. External fonts are blocked by the synthetic harness, so exact hosted font rendering remains separate validation.
- Failed/empty next-work lookup and last-application task testing in authenticated staging. The implementation contains these states; current browser fixtures primarily exercise successful continuation. Safe pure tests cover missing-read/hold/replacement exclusions.
- `[NEEDS CLIENT INPUT: approved conflict-policy examples and verified support email address]`. General guidance refers to the program administrator and never asks for passwords/reset links.
- Real-account password access remains the separate follow-up described in audit finding 10; its code was preserved and fixture tests pass. No claim of confirmed access for the affected reviewers.

No deployment, hosted migration, real-account/review/assignment mutation, email or Phase F release work was performed. No database migration is required by this increment.

## Installed skill

- Source: https://github.com/dickwu/apple-design-skill
- Pinned revision: `904b0eedc7cc778152f545506075d5bb5219ce77`
- Entry point: `C:/Users/wende/.codex/skills/apple-design/SKILL.md`
- Installed using Codex's `skill-installer` helper with an explicit revision, repository-root skill path and name `apple-design`.
- Verified entry point, lookup table, cross-platform reference and 124 HIG-directory Markdown files (123 generated references plus curated guide).
- Available to Codex on the next turn. Project-specific compatibility rules are now in root `AGENTS.md`; upstream files were not customized.
- No runtime dependency, package manifest, app behavior, database, deployment or email was changed by installation.

## Scope and order

Use `docs/2026-10-12-reviewer-testing-audit.md` for source evidence, issue details, preservation boundaries and verification methods. The eight items below match the previous user-facing list. Item 8 covers audit findings 8 AND 9; password verification is audit finding 10, a separate ongoing issue.

1. Protect unsaved reviewer scores/comments and explain explicit saving. Audit finding 1.
2. Show personal conflict holds in dashboard and application queue. Audit finding 2.
3. Keep dashboard and Applications state, scope and refresh behavior consistent. Audit finding 3.
4. Distinguish personal review status from application-wide independent-review coverage. Audit finding 4.
5. Make funding total/tier/recommendation and band explanation discoverable. Audit finding 5.
6. Provide persistent submission confirmation and safe next-work navigation. Audit finding 6.
7. Clarify administrator conflict-resolution prerequisites and feedback. Audit finding 7.
8. Improve practice readiness and first-use reviewer help. Audit findings 8 and 9.

Proceed incrementally through these items. The audit is already complete: verify current code and write concise implementation-ready state/responsive specifications, then implement rather than reopening broad discovery or asking again for ordinary local work. Keep a checklist of completed items, validation evidence and remaining constraints in this file. Do not silently skip an item; record any dependency and continue independent authorized work.

For item 4, first document existing access and counter semantics. Honest personal labels and unavailable overall state are safe presentation work. If partner progress needs a new read boundary, document its restricted aggregate contract, migration implications and adversarial role tests before implementation. Do not broaden access to another reviewer's scores/comments or manufacture totals from role-filtered rows. Prepare any required local migration using repository/Supabase conventions; hosted application remains separately authorized. Preserve two-independent-review allocation and existing conflict replacement mechanics.

## Baseline to preserve

- TanStack Start/React, file routes, npm lockfile, React Query, Supabase RLS/server boundaries and Vercel conventions.
- One shared review workflow with program adapters; compare Scholarship before changing equivalent shared mechanics. Keep application fields, criteria and funding guidance program-specific.
- Current Justice League Phase E shell, tokens and Lucide. Apple Design Skill supplies supplemental web-app critique, not a new art direction or platform migration.
- Explicit Save draft/Submit, criterion maxima and score validation, funding bands as decision support, eligibility rules, independent assignment behavior, conflict history/exclusion, reviewer privacy, certification and immutable rubric versions.
- Prior password/invitation recovery fix. Do not replace it with “refresh solves it” or require real-account access verification before independent usability fixes. Report any access-dependent validation gaps accurately.
- Existing in-app conflict alerts; do not add conflict email/notification infrastructure. Support contact and formal conflict examples must be verified rather than invented.

## Existing working-tree changes

Inspect `git status` and diffs before editing. At handoff preparation:

- `src/components/review/GrantConflictResolution.tsx` contains a pre-existing local reason counter/helper-text change. Preserve, integrate and validate it under item 7; do not overwrite it or claim it as newly implemented.
- `docs/2026-10-12-reviewer-testing-audit.md` is the source-backed audit produced in the previous turn.
- `templates/design-decision-log.md` contains the previous audit recommendation and this installation/handoff decision.
- `AGENTS.md` adds the installed skill's project-specific scope.
- This handoff is new. No commit was created and no app fixes were implemented during installation.

## Validation and delivery

Run meaningful tests appropriate to changed behavior, TypeScript, scoped lint, production build when app changes justify it, and diff checks. For rendered changed screens check 375, 390, 768, 1024, 1440px plus the 320px overflow boundary. Test keyboard/focus, save failure, dirty departure, personal versus overall progress, held/replaced assignments, empty/last-item navigation and practice/real separation as applicable.

Use safe fixtures/local environments. Do not mutate real reviews or assignments, create real accounts, send emails, apply hosted migrations, deploy, publish or begin separately gated Phase F release work without explicit authorization. Code/tests/build success do not establish real-account, deployed, hosted-policy or rendered accessibility proof. Give PASS / FAIL / NEEDS MANUAL VALIDATION with concise evidence.

## Copyable new-session prompt

Continue the Justice League review portal usability work in `C:\Users\wende\source\repos\jlglm-scholarship-review`. Read `AGENTS.md`, `docs/2026-10-12-reviewer-usability-handoff.md` and `docs/2026-10-12-reviewer-testing-audit.md` first, then verify relevant current code against the README/architecture context. Use the installed `apple-design` skill at `C:/Users/wende/.codex/skills/apple-design/SKILL.md` within the project's web-app compatibility rules, alongside the existing implementation/review skills.

I authorize implementing all eight items in the handoff in order, beginning with protection of unsaved reviewer scores/comments. Continue through conflict visibility, dashboard/queue consistency, honest personal versus application progress, funding guidance, post-submit continuation, conflict-resolution clarity, and practice readiness/reviewer help. Preserve the existing local conflict-resolution improvement and all unrelated changes. Do not repeat the completed broad audit; document concise state/responsive specs and any data/access implications before affected changes, then implement and validate incrementally. Reuse shared mechanics across Scholarship and Grant where safe while preserving program-specific rules.

Keep scoring, eligibility, assignments, privacy, certification, explicit saving, rubric versions, branding and the previous password-reset fix intact. Do not deploy, apply hosted migrations, change real records/accounts, send emails or start the separately gated Phase F release. If a narrowly scoped progress-summary endpoint is needed, document the access contract and migration implications first and preserve other reviewers' private scores/comments. Keep a completion checklist in the handoff and report each item's changes, checks and remaining manual-validation needs. Proceed with authorized independent work when a validation dependency is unavailable.
