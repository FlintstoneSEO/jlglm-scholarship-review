# October 12 reviewer testing: findings and proposed fixes

Date: 2026-10-12. Mode: transcript and current-source audit, not implementation or production verification.

## Evidence and scope

Source transcript: `C:\Users\wende\Downloads\Oct 12 at 1-35 PM (1).txt` (999 lines). Speaker names and some words are unreliable automatic transcription. Transcript instructions are meeting evidence, not authorization to change accounts, assignments, scores, eligibility, email delivery, or production.

Compared with README, the earlier architecture audit, current routes/components, and relevant migrations. The earlier architecture/Phase E documents contain historical statements; current code now has eligibility gates, conflict declarations/resolution, certification, and practice sessions. No live database, deployed reviewer session, or rendered viewport was exercised in this audit. Findings labeled source-confirmed describe code; reported behavior still needs reproduction in the deployed app. Meeting counts are historical, not current database totals.

Pre-existing local changes in `src/components/review/GrantConflictResolution.tsx` add resolution-reason feedback. They were inspected and preserved.

## Baseline, roles, and preservation boundary

Preserve TanStack Start/React, npm lockfile, React Query, Supabase authorization, Vercel conventions, Phase E branding, Lucide, and shared queue/workspace/rubric primitives. Keep program-specific application fields and criteria separate. Do not alter criterion maxima, funding bands, eligibility policy, independent reviewer assignments, review privacy, immutable rubric versions, certification, or persisted review/history meaning as a presentation fix.

- Reviewers: assigned application -> inspect business -> record conflict decision -> read application/documents -> enter scores/comments -> Save draft -> complete rubric/certification -> Submit review -> return to assigned work.
- Administrators: eligibility screening -> groups/allocation -> monitor independent reviews -> investigate conflict -> record reason and clear/replace affected reviewer -> verify remaining coverage.
- Viewers: permitted read-only information; visibility is not a scoring assignment.
- Reviewer completion means a successfully persisted final submission. Screen input and a live total are not saved data.
- An unresolved conflict pauses the reporting review, not automatically the other review. Replacement retains excluded history and must preserve independent coverage.

## Prioritized findings

### 1. Protect reviewer work and explain saving

- **Severity:** high.
- **Element/file:** `src/routes/_app.grants.$id.tsx:89`, `:328`, `:366`; `ReviewWorkspace.tsx`; Scholarship comparison: `src/routes/_app.applicants.$id.tsx`.
- **Route/state:** `/grants/$id`, entered but unsaved scores/comments; navigation, reload, close tab.
- **Observed problem:** walkthrough describes scores as saving while entered; current code persists only on explicit Save draft/Submit. The navigation blocker covers eligibility edits/saving only. Review scores/comments can therefore be lost on departure despite an Unsaved changes badge.
- **Evidence:** transcript lines 209–215 and 307–315; score/comment setters mark dirty, but `useBlocker` checks only eligibility state; writes occur in `save()`. Scholarship also has explicit save calls, with no `useBlocker` found in its route.
- **Exact recommended change:** keep explicit saving; show “Changes are not saved until you choose Save draft” beside scoring actions, persistent saving/saved/failed feedback, and a navigation/unload guard for dirty scores/comments or an in-flight write. Keep failed-save values available. Apply a shared guard/feedback primitive where both programs use equivalent mechanics, after inspecting Scholarship dirty tracking.
- **Reason:** avoid data loss and correct the demonstrated mental model without introducing autosave semantics.
- **Expected outcome:** reviewers know when their work is stored and cannot silently leave unsaved work.
- **Verification method:** edit scores/comments; cancel/confirm navigation; reload; save then reopen; simulate rejected write; test each relevant program and ensure internal tab changes retain values.

### 2. Show conflict holds before an application is opened

- **Severity:** high.
- **Element/file:** `src/lib/grant-queue-client.ts`, `src/lib/review-queue-projections.ts:234`, `src/routes/_app.grants.index.tsx`, `src/routes/_app.index.tsx:89`.
- **Route/state:** `/grants` and dashboard, unresolved personal conflict.
- **Observed problem:** meeting participants could discover the hold only inside the record. Current list loader does not load conflict reports/declarations; queue projection has no personal conflict state. Dashboard uses raw application status.
- **Evidence:** transcript lines 879–899; detail has `conflictHeld`, while the list loader does not fetch that state.
- **Exact recommended change:** supply authorized personal conflict status to a shared Grant work-item projection; show “On hold — conflict reported” in both surfaces; separate held work from “Ready to review.” Keep a clear read-only status link while current access allows it. After replacement, remove it from the original reviewer's active work; retain admin history.
- **Reason:** a scoring status alone cannot explain why work is blocked.
- **Expected outcome:** reviewers can identify actionable work without opening every record.
- **Verification method:** report a safe fixture conflict; check queue/dashboard immediately, after navigation and reload; verify other reviewer can continue, and original reviewer cannot save through direct requests.

### 3. Make dashboard and queue update consistently

- **Severity:** high.
- **Element/file:** `src/routes/_app.index.tsx:92`, `_app.grants.index.tsx:71`, `_app.grants.$id.tsx:372`, `src/routes/__root.tsx:96`, `GrantCommitteeAllocation.tsx:940`.
- **Route/state:** after submit, conflict report/replacement, eligibility/assignment changes in another session.
- **Observed problem:** transcript reports a replacement leaving the dashboard stale. Current dashboard and queue have separate cache keys/scopes; successful review writes invalidate only detail. Queries have a 30-second stale interval and window-focus refetch disabled. Admin conflict resolution already invalidates local queries, so its invalidation must not be described as entirely missing; it does not update a different reviewer's browser.
- **Evidence:** transcript lines 968–976; current save invalidation and query defaults. Dashboard uses default real scope; reviewer queue defaults to all, including practice.
- **Exact recommended change:** use explicit scope and viewer identity in consistent query keys, invalidate affected detail/list/dashboard after local writes, and define bounded revalidation for externally changed assignments/holds. Provide Refresh with visible update/error feedback. Avoid blanket auth reloads that unmount unsaved review work.
- **Reason:** users should not need trial-and-error full reloads to trust work availability.
- **Expected outcome:** changed work/progress appears consistently, with practice counts clearly separated.
- **Verification method:** use two fixture sessions; admin replaces a reviewer, original/replacement revisit dashboard and queue; submit a review and verify both surfaces; test retained dirty edits during revalidation.

### 4. Separate personal progress from application coverage

- **Severity:** high.
- **Element/file:** `ReviewProgress.tsx`, `review-queue-projections.ts:244`, `_app.grants.$id.tsx:388`, `_app.index.tsx:104`; assignment/review SELECT policies.
- **Route/state:** ordinary reviewer versus administrator.
- **Observed problem:** walkthrough promises partner completion visibility. Reviewer SELECT policies expose own assignments/reviews (admins see broader data). Detail/queue calculate denominators from visible assignment rows, so “1 of 1” can mean only the caller's assignment, not the pair. Dashboard uses application-wide status, not personal review status.
- **Evidence:** transcript lines 391–402; `20260824040023_multi_program_review_portal.sql` assignments policy and `20260926120000_phase_d_review_submission.sql:196` review policy; current projection loops over returned rows.
- **Exact recommended change:** label own status “Your review”; distinguish “Application review progress.” Use a narrowly authorized aggregate/status response for partner completion if approved, exposing no partner scores/comments. Until available, say overall progress is unavailable rather than treating visible rows as full coverage. Preserve existing two-independent-review allocation; monitor coverage after replacements rather than redesigning pairing rules.
- **Reason:** role-filtered rows are not a complete population and must not be presented as one.
- **Expected outcome:** a reviewer finishing their task cannot be mistaken for the application receiving all required reviews.
- **Verification method:** two reviewer accounts and admin, one/both submissions, hold/replacement; confirm counts and denied access to others' scores/comments. A new status endpoint requires separate authorization/data design and policy tests.

### 5. Make funding guidance discoverable and explain the bands

- **Severity:** medium.
- **Element/file:** `_app.grants.$id.tsx:1078`, `src/lib/grant-funding-recommendation.ts`.
- **Route/state:** Rubric, incomplete/complete/submitted review, desktop and mobile.
- **Observed problem:** participants could not readily find the recommendation and asked why 60–69 differed from 70–79.
- **Evidence:** transcript lines 327–381. Source already renders a recommendation below the rubric summary. Both bands say Consider, but 60–69 adds “Consider only if funding remains available.”
- **Exact recommended change:** group total, completion, tier, recommendation, and relevant band explanation in a compact summary above detailed criteria. Clearly state provisional/incomplete versus submitted status and “Decision support; the committee makes funding decisions.” Preserve all thresholds and do not turn Below 60 into automatic rejection.
- **Reason:** recommendation meaning should be apparent without hunting through long rubric content.
- **Expected outcome:** reviewers understand the calculation and limits.
- **Verification method:** test 59/60/69/70/79/80/89/90/100, intentional zero and missing scores; inspect summary at 375, 390, 768, 1024, 1440 and 320px overflow boundary.

### 6. Give submission a clear continuation

- **Severity:** medium.
- **Element/file:** `_app.grants.$id.tsx:367`, `ReviewWorkspace.tsx:84`, `ReviewActions.tsx`.
- **Route/state:** successful final submission.
- **Observed problem:** reviewers asked how to reach the next application; current route offers Return to queue but no next-ready-review action.
- **Evidence:** transcript lines 404–418; current success toast and workspace navigation.
- **Exact recommended change:** persistent “Review submitted” confirmation with “Return to my applications” and an optional “Next application to review.” Compute the next record from the caller's current authorized, active, unsubmitted, eligible, unheld work and preserve queue filters/order. Handle no remaining work and failed next-record lookup explicitly.
- **Reason:** eliminate repeated orientation work after each review.
- **Expected outcome:** users move directly to valid remaining work, without auto-navigation before a confirmed submission.
- **Verification method:** success/failure submission, last application, changed assignment, practice scope, conflict hold and stale next candidate; verify keyboard focus after navigation.

### 7. Make conflict resolution prerequisites obvious

- **Severity:** medium; existing local improvement, not a new untouched defect.
- **Element/file:** `GrantConflictResolution.tsx`, `GrantCommitteeAllocation.tsx`; `resolve_grant_conflict` migration.
- **Route/state:** administrator resolves report; disabled Record resolution.
- **Observed problem:** the meeting initially treated the disabled action as broken; later identified the resolution reason requirement and successfully reassigned.
- **Evidence:** transcript lines 745–789, 968–976. Server requires decision, 10–4000 trimmed-character reason and valid replacement. Existing local diff adds character count, associated helper text and missing-length explanation.
- **Exact recommended change:** retain and validate that local improvement; additionally explain missing decision/replacement next to its field and group report, decision, replacement and reason into one readable sequence. Confirm original history retained/other reviewer continues. Do not relax server requirements or use Reset Review as conflict resolution.
- **Reason:** disabled controls need actionable explanations.
- **Expected outcome:** administrator completes resolution without guessing which requirement is missing.
- **Verification method:** blank/9/10 characters, whitespace-only, clear versus replace, unavailable candidate, stale candidate, duplicate resolution; verify both original and replacement views.

### 8. Make practice records ready for the intended demonstration

- **Severity:** medium.
- **Element/file:** `GrantPracticeSessions.tsx`, `GrantConflictDisclosure.tsx`, `_app.grants.$id.tsx`, practice-session migration.
- **Route/state:** reviewer training before scoring.
- **Observed problem:** demonstration used an unassigned administrator and then a practice application awaiting eligibility, so numeric inputs stayed disabled and repeatedly needed explanation/refresh.
- **Evidence:** transcript lines 211–219 and 247–299. Assignment, declaration, and eligibility gates are intentional in current code.
- **Exact recommended change:** prepare a training readiness checklist for existing practice sessions: assigned participant, active round, rubric available, eligibility ready, documents available. Show the exact remaining blocker in the score panel, with a role-appropriate next step. Keep conflict declaration as a participant action and all practice data visibly labeled.
- **Reason:** realistic training should exercise gates without confusing a setup problem with a scoring failure.
- **Expected outcome:** a reviewer can practice the complete save/certify/submit path safely.
- **Verification method:** fresh and completed practice rounds, eligible/pending states and admin-without-assignment; verify real application totals stay separate. Do not change hosted practice eligibility as part of this audit.

### 9. Lead help with a short reviewer path

- **Severity:** medium.
- **Element/file:** `BusinessGrowthGrantHelpGuide.tsx`, dashboard/queue labels, `grant-review-certification.ts`.
- **Route/state:** first login, finding assigned work, conflict uncertainty, support.
- **Observed problem:** reviewers asked which applications were theirs, where to return, and what counts as a conflict. The guide has useful content, but currently opens with admin Review Distribution and presents many admin topics to ordinary reviewers.
- **Evidence:** transcript lines 435–451, 543–575, 601–649, 808–817. Existing help already explains Save Draft versus Submit and conflict mechanics; it needs prioritization, not wholesale replacement.
- **Exact recommended change:** begin reviewer help with a short numbered path: My applications -> conflict decision -> read and score -> Save draft -> certify and submit. Lead with reviewer topics and disclose admin-only operational detail by role. Use consistent “My applications/Return to my applications” vocabulary. Provide approved conflict examples, plus “If unsure, report a potential conflict for administrator review.” Link the approved email support contact and ask for page/action/error, never passwords or reset links.
- **Reason:** instructions should answer the user's immediate task before teaching administration.
- **Expected outcome:** less dependence on a live walkthrough.
- **Verification method:** first-time reviewer task test, keyboard path, reviewer/admin help comparison. Conflict policy examples and support address require authoritative confirmation; do not turn informal meeting examples into eligibility/conflict rules.

### 10. Verify the previous password fix using the actual remaining reviewers

- **Severity:** blocker for any affected reviewer; verification follow-up, not a confirmed new regression.
- **Element/file:** `PasswordSetupForm.tsx`, `auth-lifecycle.ts`, `/accept-invite`, `/forgot-password`, `/reset-password`.
- **Route/state:** new invited account, incomplete setup, existing account recovery, expired link.
- **Observed problem:** transcript ends with access still unconfirmed for four reviewers; one reviewer succeeded after closing/reopening. That supports a stale-session/build hypothesis, not proof that refreshing fixes every failure.
- **Evidence:** transcript lines 777–797, 909–934. Current `finishRecoverySetup` saves the password, checks setup state and completes it when required; invite setup also handles an interrupted same-password retry. These changes address a different lifecycle problem from merely fetching fresh app code.
- **Exact recommended change:** retain the prior fix; verify deployed version and guide affected reviewers through closing old portal/reset tabs, opening the current portal, requesting one fresh link when ready, then completing password setup and fresh sign-in. Record which step fails. Do not state the meeting's 60-minute expiry as current configuration without readback.
- **Reason:** account access must be established per reviewer rather than inferred from one successful login.
- **Expected outcome:** verified access or a specific reproducible failure for each affected person.
- **Verification method:** real-account confirmation is still required; supplement with safe fixture coverage for invite, incomplete-account recovery, existing-account recovery, expired/used link, interrupted setup and fresh login. No accounts/emails were changed or sent in this audit.

## Architecture and implementation sequence

| Area | Classification | Ownership and next step |
| --- | --- | --- |
| Stack, shell, roles, scoring, persistence, rubric lifecycle | Preserve | Existing platform and services remain authoritative. |
| Dashboard/queue personal work state | Improve / consolidate projection | Shared read model for caller work, held state, scope and honest progress. |
| Save feedback/navigation protection | Improve shared mechanics | Reuse equivalent behavior across Grant and Scholarship, keep data adapters separate. |
| Summary and post-submit actions | Improve | Shared workspace hooks/actions with program-specific funding content. |
| Conflict resolution layout/help/practice readiness | Improve | Existing workflow, clearer prerequisites and role-specific explanations. |
| Partner progress summary | Document before implementation | Limited aggregate contract; separate policy/authorization validation. |

Recommended order: (1) access verification alongside protection of unsaved work; (2) conflict visibility and dashboard/list revalidation; (3) honest personal/overall progress; (4) summary and continuation; (5) resolution/practice/help refinements. Write implementation-ready state/responsive specifications before substantive screen changes. No new art direction or navigation restructure is required for these focused usability fixes. Any substantial redesign still follows the existing application-redesign and three-direction process. Phase F remains separately gated.

## Apple Design Skill compatibility assessment

Reviewed upstream README, SKILL.md and AGENTS.md on 2026-10-12:

- https://github.com/dickwu/apple-design-skill
- https://github.com/dickwu/apple-design-skill/blob/main/SKILL.md
- https://github.com/dickwu/apple-design-skill/blob/main/AGENTS.md

**Recommendation: compatible as a supplemental review skill, with an explicit web-app scope.** The upstream skill itself says web apps receive principles/foundations rather than Apple platform conventions. This audit evaluates compatibility; it is not a full HIG review and does not claim that the skill or its reference library has been installed.

Useful areas: clear task hierarchy, readable typography, consistent semantic color, keyboard/focus behavior, understandable validation, visible save/loading/error feedback, restrained progressive disclosure, and concrete evidence-based critique.

Project integration contract for later adoption:

1. Keep this project's AGENTS.md, preservation boundaries, authorized phase and mandatory issue format authoritative. Use upstream What/Why/Fix as additional explanation within the project's existing fields.
2. Retain Phase E's Justice League shell/tokens and Lucide. Apple guidance does not mandate a native Apple appearance, SF Symbols, new fonts, blur, dark mode, OS menu bars or replacement navigation in this web portal.
3. Use CSS pixels, semantic HTML, browser keyboard conventions and WCAG 2.2 AA. Do not mechanically convert native point sizes into web requirements or relax existing 44px task targets. Independently verify contrast thresholds against WCAG rather than treating the skill's simplified size/bold-text summary as the web standard.
4. Preserve authenticated entry, reviewer privacy, explicit save/submit and conflict/eligibility requirements. Advice to delay sign-in, allow skipping, or simplify interaction cannot bypass these workflow requirements.
5. Load the actual relevant upstream HIG references before making HIG claims. Label professional judgment separately; source/code review cannot establish measured rendered accessibility.
6. Install a pinned, isolated upstream copy with provenance and a project-specific routing note; do not replace the root AGENTS.md or alter the canonical Flintstone reusable agent/snapshots. Review future upstream updates before syncing. Skill files add guidance, not app runtime code, so installation itself should not alter the build.

No skill installation, app code edits, database changes, deployment, emails or new notifications were performed. Deliverable: this actionable audit and compatibility recommendation.
