# Grant eligibility screening — October 5, 2026

The [October 7 preliminary-screening refinement](grant-screening-refinement.md) supersedes the four-check bulk action and default-decision behavior described below. LARA now requires independent verification, and unscreened drafts have no selected final decision.

## Authorized increment

The user approved grouping documents and compliance, group verification with individual exceptions, one Save progress action and one Save & mark eligible action. Preserve the existing Phase E visual direction, shell, routes, role checks, six persisted requirement keys, eligibility decisions, scoring gate and historical scores. Scholarship screening remains distinct; do not introduce Grant requirements into it. No navigation or visual identity replacement is needed for this focused workflow improvement.

## Existing behavior and migration implications

`GrantOverview` has six independent radio forms and six Save verification actions. Each invokes `set_grant_requirement`; the operation records actor/time, resets the final decision and revokes an existing scoring exception. `confirm_grant_eligibility` requires six verified items for Eligible and a meaningful reason for clarification/ineligibility. These are current migration/code facts, superseding the earlier Phase E document's pre-gate description.

Preserve these functions. An additive batch RPC locks the existing parent, rejects a stale expected update timestamp, writes changed items through the existing function, then optionally confirms through the existing function in one transaction. Failure rolls back all changes. No schema/data backfill or scoring-semantic migration. Rollback: restore the prior frontend and remove only the new batch RPC; retain all screening records.

## Screen specification

Task: an authorized Grant administrator reads evidence, records verification and explicitly confirms eligibility. Keep business summary above screening and competitive progress below it. Owner and business eligibility remain separate. Group LARA standing, both P&Ls and document completeness under Documents & compliance; present document links once beside their specific checks, with other document types under completeness. Each requirement retains all five states and expandable notes. A group action sets all four document checks to Verified in the local draft, with explicit text naming its scope; it is a human attestation, never triggered by file presence. Individual edits remain available.

One action area shows verified count, unsaved state, Save progress and Save & mark eligible. Keep clarification/ineligibility decisions with required reasons. Save progress persists changed checks; decision actions persist changes and decision atomically. Group/individual choices are editable until save. Preserve drafts on failures and tab switches; block leaving the application with unsaved changes. Refresh cannot silently overwrite a local draft. Disable duplicate writes and show accessible saved/error feedback. At 320–1440px controls wrap, maintain 44px targets and document names break safely.

## Proposed admin entry workflow — awaiting selection

Before this increment, the Grant dashboard queried application competitive statuses, not eligibility. The queue already displayed eligibility and kept its eligibility filter outside More filters. Missing eligibility rows mean not_reviewed; this includes initial screening and requirements changed since final confirmation, so do not call every such application never reviewed.

The user authorized implementation with "implement" after reviewing the proposal. Add an admin-only Eligibility screening section above competitive progress with counts, a Start screening link to the existing not_reviewed URL filter, and a Needs clarification link. Give the queue visible count-bearing views: Needs screening, Needs clarification, Eligible, Ineligible and All. Retain an All view and reviewer role experience. Each unscreened row uses a Review eligibility action leading to Overview. Rename competitive Not started to Scoring not started so the two processes are distinguishable. No automatic assignment or eligibility decisions. Counts use real non-practice records and saved human decisions; failed eligibility queries show unavailable rather than zero. Save & next can use the current filtered queue after a successful save and handle an exhausted queue.

Selected approach: dashboard plus prominent queue views within existing routes. The shared queue loader supplies dashboard, queue and next-applicant navigation. Filters for eligibility, search, competitive status, LARA, operating model and business age are URL-backed and preserved through detail/return navigation. Applicant ordering is submission date descending with ID ascending for ties. Save & next refreshes saved decisions, skips the current applicant, continues from their position and wraps once to other matching applicants; an exhausted view returns to the filtered queue. This action is unavailable for practice records or when score/comment/certification edits would be lost. It is admin-only through the existing screening controls, and writes still use the eligibility-gated RPC. No schema or permission change is added for dashboard/queue entry.

## Focused audit finding

- Severity: medium
- Element/file: `src/routes/_app.index.tsx`, GrantDashboard
- Route/state: `/`, Grant administrator, eligibility work outstanding; viewport independent
- Observed problem before this increment: competitive progress dominates and screening workload has no first-step entry/count.
- Evidence: query reads portal_applications only; metrics derive review_status; recent rows show competitive statuses.
- Exact recommended change: admin-only screening summary/counts above competitive metrics linked to saved eligibility filters.
- Reason: administrators need to identify and complete the prerequisite before competitive review.
- Expected outcome: one visible entry takes the administrator to applications needing a screening decision.
- Verification: admin/reviewer rendering, missing/partial/confirmed states, real/practice separation, denied writes, keyboard/mobile checks and navigation back to the selected queue.

## Validation

PASS: TypeScript, targeted ESLint (zero errors; three existing component-export fast-refresh warnings) and local Vercel/Nitro production build. All 117 library tests pass, including screening counts, filter parsing/matching, record exclusion, next-applicant wrap/exhaustion and removal of a saved applicant from Needs screening. The new batch suite plus existing eligibility-screening and multi-program authorization suites pass against isolated PGlite with all checked-in migrations applied. These test denied reviewer writes, six-check confirmation, atomic rollback, stale versions, invalid keys, progress reset and decision reason validation.

NEEDS MANUAL VALIDATION: authenticated browser interaction/responsive review at 320, 375, 390, 768, 1024 and 1440px; real provider multi-admin concurrency; authenticated provider RPC roundtrip. The batch migration was subsequently applied with explicit authorization as recorded below. Application deployment remains pending. The local PGlite harness has provider compatibility stubs and is not live Supabase proof.

Browser inventory returned no available browser or app sessions during this increment. Required manual cases: admin-only dashboard/views/action labels; reviewer queue unaffected; initial/missing/changed confirmations; loading and failed eligibility queries (Unavailable, never zero); all URL filters preserved through detail/return; failed saves retain drafts; successful Save & next enters Overview; exhausted views return to the queue; practice records and unsaved competitive edits do not offer Save & next. Controls wrap with 44px minimum targets, and unavailable counts use smaller wrapping text for narrow screens, but this is code inspection rather than rendered proof.

Implementation uses the existing RPC architecture, supported by [Supabase database functions documentation](https://supabase.com/docs/guides/database/functions). The changelog markdown endpoint could not be fetched through the web reader; no new SDK or provider feature is introduced.

## Authorized production migration — October 5, 2026

The user explicitly requested "apply migration". Applied only `20261006022242_grant_eligibility_batch_save.sql` to linked project `vkbjvoltuecfvedhedbu` (`jlglm-scholarship-review`) using Supabase apply_migration. Live history records version **20261006025234**, name **grant_eligibility_batch_save**. The provider generated the live timestamp; match by name/content rather than assuming the local version is the live version. UTC execution was October 6, during October 5 in America/New_York.

PASS: project ACTIVE_HEALTHY and both existing requirement/confirmation RPCs present before application. New function absent before application and present afterward. Installed function body matches the checked-in script after newline normalization. Return type is timestamp with time zone, SECURITY DEFINER is enabled, search_path is empty, authenticated execution is granted and anonymous execution is denied. A rollback-only live check with the authenticated database role and no authenticated identity was rejected with `Program administrator access is required`. No screening decision or verification was changed by that check. PostgREST schema reload notification succeeded.

PASS: pre/post full-row fingerprints and counts matched for portal_applications (80, including practice), application_eligibility_reviews (2), eligibility_review_items (12), eligibility_scoring_overrides (0), program_reviews (0), and review_scores (0). These are snapshots at migration time, not permanent application counts.

Security advisors checked before and after. The expected new notice is [authenticated SECURITY DEFINER RPC execution](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) for this administrator-gated endpoint; the explicit actor/program-admin check and denied-identity test are retained. Existing [two internal RLS ledgers without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) were unchanged. No unrelated permissions or Auth settings were modified.

No application deployment or real applicant eligibility decision was performed. Authenticated browser/RPC workflow and real multi-admin concurrency remain pending.
