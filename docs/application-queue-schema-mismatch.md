# Application queue schema mismatch — October 5, 2026

## Finding

- Severity: blocker
- Element or file: `src/routes/_app.grants.index.tsx` application query; `src/components/review/GrantPracticeSessions.tsx` session query.
- Route or state: Business Growth Grants `/grants/`, administrator, applications failed to load and practice sessions failed to load. Viewport-independent database failure.
- Observed problem: the frontend requires practice schema absent from the live Supabase project `vkbjvoltuecfvedhedbu`.
- Evidence: live `grant_practice_sessions` relation is absent; `portal_applications.practice_session_id` column is absent. Reproducing the queue predicate yields PostgreSQL `42703: column "practice_session_id" does not exist`. Live migration history ends at `20260928190000_admin_review_reset_and_access_safety`. There are 40 Grant applications. A rollback-only transaction selecting the screenshot account's JWT subject and using `SET LOCAL ROLE authenticated` sees all 40 through existing RLS. This establishes database-role access, not a browser login or PostgREST roundtrip.
- Exact recommended change: apply the three existing pending migrations in order after explicit production approval, then reload and verify the deployed queue. Do not bypass the practice predicate, weaken RLS, recreate applications, or reset reviews.
- Reason: the matching frontend has advanced beyond the production database schema. Removing the predicate would lose real/practice separation after the schema is installed.
- Expected outcome: the queue query and practice-session query resolve against matching schema; the 40 real applications remain available to the authorized administrator.
- Verification method: compare live migration history and schema; repeat the role-scoped real-application count with `practice_session_id IS NULL`; verify practice sessions select without error; reload the authenticated browser queue and check real/practice separation. Validate actual reviewer declaration and conflict states separately.

## Concrete production update proposed

1. `supabase/migrations/20261005211902_growth_grant_committee_increment.sql`: allocation previews, conflict reports, authorized RPCs and conflict write guards.
2. `supabase/migrations/20261005221213_grant_reviewer_groups.sql`: saved reviewer groups and group-aware allocation.
3. `supabase/migrations/20261006001032_grant_practice_and_conflict_resolution.sql`: practice session schema and separation; assignment-specific no-conflict declarations required before competitive writes; authorized conflict resolution/replacement and exclusion of replaced review scores from aggregates.

These scripts define functionality beyond a missing column. Existing application/review history is retained. Installing them does not itself start practice sessions, allocate reviewers, report/resolve conflicts or send invitations. Existing reviews require a reviewer declaration before subsequent competitive edits; no historical declaration is fabricated. See `growth-grant-committee-increment.md` and `grant-practice-sessions.md` for preservation and rollback constraints. Retain history, markers and conflict protections on rollback; do not casually drop guards.

## Current verification

PASS: all checked-in migrations apply to an isolated PGlite PostgreSQL database, followed by these five rollback suites:

```powershell
node supabase/tests/run-committee-local.mjs supabase/tests/grant_practice_sessions.sql supabase/tests/grant_reviewer_groups.sql supabase/tests/growth_grant_committee.sql supabase/tests/multi_program_authorization.sql supabase/tests/phase_d_scholarship_transactional.sql
```

PASS: read-only live schema/history inspection and rollback-only authenticated-role count; 40 existing real Grant applications are visible under the screenshot account's database role.

NEEDS MANUAL VALIDATION: hosted migration application, PostgREST roundtrip, authenticated browser queue, full-provider concurrency and real-account workflow checks. PGlite uses provider compatibility stubs and does not establish those outcomes.

The initial investigation made no production changes. The user subsequently explicitly approved the proposed update with "apply db updates" on October 5, 2026.

## Approved production application

PASS: all three existing scripts applied successfully through Supabase `apply_migration`, in dependency order, to `vkbjvoltuecfvedhedbu`. Live migration history now records:

| Repository version | Live version | Name |
| --- | --- | --- |
| 20261005211902 | 20261006012909 | growth_grant_committee_increment |
| 20261005221213 | 20261006012917 | grant_reviewer_groups |
| 20261006001032 | 20261006012931 | grant_practice_and_conflict_resolution |

Supabase MCP generated the live timestamps; match these migrations by name and script rather than assuming repository timestamps were used. UTC execution occurred on October 6, during the evening of October 5 in America/New_York.

PASS: PostgREST schema reload notification succeeded. The authenticated-role real queue predicate and practice-session query now execute without the missing-schema errors. Existing application count remains 40, assignment count remains 1, and program review/score counts remain 0. Pre/post row fingerprints match exactly for all four tables after excluding the two newly added null application fields (`practice_session_id`, `practice_round`) from the application comparison.

Security advisors were checked after migration. They report two existing RLS-without-policy internal ledger tables, authenticated SECURITY DEFINER RPC warnings, and disabled leaked-password protection. The RPC exposure is intentional and requires explicit actor/role checks; the isolated authorization suites cover the new workflow. Advisor references: [RPC exposure](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [RLS ledger notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [password setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No unrelated Auth configuration or grants were changed.

NEEDS MANUAL VALIDATION: reload the user's authenticated browser and verify the queue, provider API roundtrip, and real-account review workflow. No application deployment, practice session creation/reset, invitation, conflict action or live assignment change was performed.
