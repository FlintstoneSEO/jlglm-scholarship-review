# Review Distribution: audit and implementation specification

Authorized by the detailed 2026-10-06 user specification on business-growth-grant-brand-refresh. Preserve the existing visual system and compact rail shell; this is workflow organization, not a new art direction. The user specifies the three-tab IA. Shared route /assignments remains; Grant heading and program-aware navigation become Review Distribution, Scholarship remains Reviewer Assignments. Existing uncommitted disclosure/workspace changes are preserved.

## Current behavior and findings

- Severity: high. Element: _app.assignments.tsx. State: real Grant admin. Observed problem: application-first manual assignment competes with saved-group allocation. Evidence: Add Reviewer precedes allocation inside workload disclosure. Exact change: put groups/allocation/progress first, hide manual creation for real Grants, retain records in collapsed administration. Reason: reinforce the authorized paired workflow. Expected outcome: real distribution starts with groups. Verification: source regression, unit tests, authenticated browser journey.
- Severity: medium. Element: GrantCommitteeAllocation. State: administrator. Observed problem: groups, progress, preview and conflicts appear together. Evidence: sequential sections with no tab selection. Exact change: organize the same component under URL-backed Radix tabs; persistent attention alert and native Needs Attention disclosure. Reason: lifecycle clarity. Expected outcome: predictable refresh/back and exception access. Verification: parser/projection tests and keyboard browser review.
- Severity: high. Element: resolve_grant_conflict. State: replacement. Observed problem: access/history/participant constraints exist but no explicit banned-account check. Evidence: current RPC membership and assignment predicates. Exact change: admin-only candidate RPC and matching resolution check, retain original transaction. Reason: UI filtering must match authoritative enforcement. Expected outcome: unavailable accounts rejected. Verification: synthetic database denial tests.

## Roles, data, shared mechanics and migration boundary

Program/global admins operate distribution under existing current_user_has_program_role rules. Reviewers report only their own active assignment; viewers receive no administration. Keep native React/TanStack Start, Query, Radix, Lucide, npm/Vercel conventions. Keep allocation RPCs, scoring, rubric, eligibility, assignment identities, test/real isolation and frozen snapshots. Grant and Scholarship share assignment storage/client; their native review persistence differs. No duplicate engine or Scholarship migration. Add the admin-only candidate and read-only pool-summary RPCs; amend only replacement account validation in the existing resolution RPC. Conflict notifications are in-app only. No production mutation or deployment is authorized.

## Screen specification

Header: compact H1, program and lifecycle description. Scope remains explicit Real/Test. Real Grant gets the primary distribution workspace; Test keeps selected application, single-reviewer assignment and Guided Testing links. Groups tab: existing saved data/edit controls, eligibility and overlap diagnostics, continue action. Allocation: choose three saved groups, confirm identities, balanced distribution first, advanced fixed capacity with unallocated consequences, frozen pool/coverage and explicit preview/apply. Preserve confirmations and error/retry states. Progress: program totals derived from applied snapshot slots, frozen group/reviewer summaries, remaining count, affected application and replacement identities. Pending previews never count. Multiple applied allocations remain separate and aggregate only actual scoped entries.

Needs Attention alert appears above tabs on every selection; opens Progress and the native focusable disclosure. Each unresolved report has a focusable anchor identified only by opaque report ID in search. It shows application/group/reviewer, private explanation, candidate workload, reason and clear/replace actions. Resolved history stays collapsed. Administrative records/reset/deactivation stay collapsed by default, with existing confirmation dialogs. Native details avoids drawer focus complexity. Tabs use Radix keyboard semantics, three equal flexible columns, wrapping text and 44px minimum controls. Names wrap; summary bands use intrinsic grids. Loading/error states must not advertise readiness or zero completed issues.

In-app attention links use the existing protected route with program, progress tab, attention and opaque conflict ID only. The existing safe login-next mechanism preserves protected destinations. No private explanation or scores are stored in search. No synthetic client facts or permanent roster names. User removed conflict email delivery from scope; no worker, outbox, scheduler, SMTP secrets or provider configuration is included.

## Verification plan

Node projection/search and in-app regression tests, TypeScript, changed-file lint, build, isolated PGlite migrations and transactional committee/test/auth regression fixtures. Authenticated role journeys and six-width browser QA are separate evidence.

## Scope revision

User instruction: scrap conflict email sending for now and retain the notification in the app. Removed the local email worker, templates, provider dependencies/configuration, delivery tables/functions/trigger, scheduler and email-only tests/setup documentation. The not-yet-deployed local migration is now 20261006162317_grant_review_distribution.sql and contains only replacement eligibility/resolution checks and the pool-summary RPC. No hosted migration or cleanup operation was performed.
