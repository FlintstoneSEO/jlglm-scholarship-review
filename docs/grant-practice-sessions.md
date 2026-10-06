# Grant practice sessions and conflict resolution

User approved local implementation on October 5, 2026. No hosted migration, deployment, invitations or live-data reset is performed.

Screen plan: preserve the existing shell and Grant workspace. On Reviewer Assignments, an admin starts a named practice session selecting 2-20 existing Grant reviewer/admin accounts. It seeds 40 clearly fictional applications and same-portal sample documents. Select a session to screen, allocate and review its current round. Three saved pairs still require six distinct accounts; two testers can rehearse manual paired assignments. Participants use the same workspace and their own accounts. No shared credentials or account impersonation.

Practice sessions are marked in the database, separated in queue/dashboard/rankings and allocation scope, and restricted to their participants plus program administrators. The active Grant rubric remains unchanged. Reset requires an explicit confirmation and current round, archives all old round records/holds/scores/allocations, suspends its assignments and seeds 40 fresh unreviewed records. End archives the round without reseeding. No real row is relabeled, deleted, cleared or reallocated. Stored history remains auditable; a reset clears active practice work rather than erasing historical records.

Early declaration: each assigned reviewer records No known conflict identified before scoring, drafting or submission. It is owner-only, assignment-specific, timestamped and database-enforced, separate from final-submit certification. No old declaration is fabricated. Existing reviews stay readable but cannot be changed without clearance. A later conflict remains reportable.

Conflict policy: administrators record a reason and either clear the report or replace only that reviewer with another existing authorized account not already assigned to the application. Both old assignment and review remain; the old assignment is suspended and its submitted score is excluded from aggregates/rankings. The unaffected reviewer continues. Replacement receives a fresh assignment and must declare independently. Practice replacements must belong to the session. Approved replacement history cannot be removed by the generic reset. Cleared reports unlock only after the reviewer records their declaration; they do not automatically certify anything.

Migration is additive, with RLS/read-only grants and authorized security-definer RPCs. Apply it before the matching frontend. Rollback must retain session markers, history and conflict holds; removing frontend controls is safe, dropping guards/exclusions is not a routine rollback. Verify provider API roles, private links and concurrent requests in an isolated full Supabase stack before release. Local PostgreSQL and intercepted browsers do not establish live-provider proof.

## Walkthrough with Prince

After the matching migration and frontend are released:

1. Use existing individual accounts with Business Growth Grant reviewer/admin access. Invitations and account setup use the existing Users & Program Access flow.
2. As administrator, open Reviewer Assignments → Start a new practice run. Name it and select the participating accounts. Start Practice Run creates 40 fictional applications and three sample documents per application.
3. Open Applications → Practice applications, choose the run and open an application. As administrator, check the fictional evidence, record all six eligibility checks and confirm eligibility. Repeat for the pool you want to allocate. Eligibility is not automatically confirmed.
4. Return to Reviewer Assignments and select the practice run under Review scope. Use individual assignments for two testers, or select three saved pairs with six distinct participating accounts and preview/apply random allocation. Forty eligible applications in balanced mode distribute 14/13/13; fixed capacity of 13 leaves one explicitly unassigned. Confirm capacity and the saved roster before applying.
5. Each participant signs into their own account, opens an assigned practice application, records No known conflict identified, saves a draft and submits with the existing final certification. Reviewers cannot see individual peer scores.
6. Include at least a third participating account to rehearse conflict replacement: report a conflict, verify the reporter's scoring hold, then resolve it as administrator with a reason and replacement. Confirm the original history remains, the partner can continue, and the replacement must declare and submit independently.
7. On Reviewer Assignments, select the run and click Reset Practice Run, then confirm. The previous round is archived and 40 fresh unreviewed applications appear. Re-screen and reassign the new round as needed. End Practice Run archives without creating another round. Both buttons leave real reviews intact.

Two testers can rehearse the review workflow; six distinct accounts are required to exercise three-pair allocation. Accounts are not impersonated or created automatically. Practice tests invitations through the normal account flow; resets do not revoke accounts or clear invitation/setup history.

## Verification

- PASS: all migrations load in isolated local PGlite PostgreSQL; eight rollback suites pass, including new practice start/reset/end, 40-record seed, scoped allocation, declaration enforcement, holds, single-member replacement, score exclusion, history retention, reset failure rollback, stale requests, archived screening and participant/viewer restrictions. Existing Scholarship, authorization, rubric and account lifecycle suites remain green.
- PASS: 106 unit tests, TypeScript and production build. Scoped lint covers changed source files.
- PASS: intercepted local browser exercise of groups, capacity/stale preview, declaration, conflict resolution/history, practice start/reset/end and same-portal sample document navigation. Body/main overflow checks at 320/375/390/768/1024/1440; scoped accessibility scans of allocation, groups, conflict and practice controls. Screenshots in ignored `supabase/.temp/committee-browser/`.
- NEEDS MANUAL VALIDATION: hosted Supabase/PostgREST/GoTrue/storage policies, simultaneous requests in the full provider stack, real invitation email delivery, real-account roundtrip, private document links and deployed UI. Local browser APIs are synthetic, external font requests are blocked, and local SQL uses provider stubs. No live migration, deployment, invitation or real-data reset has been performed.

