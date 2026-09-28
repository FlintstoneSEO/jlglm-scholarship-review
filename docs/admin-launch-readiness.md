# Admin launch readiness: review reset and access visibility

## Existing behavior verified against code and migrations

- `/_app/assignments` already combines applications, reviewer assignments, review status, and reviewer progress. Scholarship review rows live in `reviews`; Grant rows live in `program_reviews` with `review_scores`. The Phase D write path uses submission RPCs, lifecycle events, and idempotency keys.
- Grant score rows cascade when their review is deleted. Lifecycle events and Grant certifications restrict deletion. Scholarship lifecycle events also restrict deletion. Idempotency rows have no review foreign key, so reset matches the reviewer, program, application, and (for ambiguous historical Scholarship duplicates) the review's request keys or response review ID.
- Existing triggers recompute Scholarship applicant totals and statuses and Grant application counts, averages, and statuses after review changes. Rankings read those derived values and Grant certification rows.
- `/_app/users` previously fetched profiles and global roles but filtered program access to `selectedProgram`. Its global-role change used two separate browser requests. The account setup flag is stored on `profiles`; the migration grandfathered preexisting profiles as complete.

## Authorized implementation boundary

The existing TanStack routes, Supabase authorization helpers, review submission RPCs, scoring rules, rubric versions, assignment identity, and invitation lifecycle remain in place. This change adds one admin-only per-review reset operation and a scoped admin access projection. No navigation or information architecture change is needed.

## Reset behavior and data preservation

`admin_reset_review(review_id, reason)` checks the current Auth user and current program-admin authorization. It locks the selected review and assignment, writes an audit event with identity and reason only, then removes operational activity in one database transaction. The UI uses `test_data`; the function also accepts `entered_in_error` and `administrative_reset`.

For Grant, it removes that review's certification, lifecycle, idempotency, score, and review rows. For Scholarship, it removes that review's lifecycle and review rows and its related idempotency keys. It does not remove the applicant/application, reviewer, assignment, user role, or program access. Existing recompute triggers then remove the review from completion counts, scores, and rankings. A preserved active assignment can start a fresh review.

The admin action appears on the existing Reviewer assignments screen only when a review exists. Its dialog shows applicant, program, reviewer, and current status. Submitted reviews receive a stronger title. Confirmation is required before the RPC runs, and all React Query caches are invalidated after success.

## Users & Program Access screen specification

- **Primary task:** inspect one person's global role, setup state, and every program role available to the current administrator, then change only authorized access.
- **Global admin:** one scoped RPC returns all profiles crossed with all active programs, including programs with no membership. The screen shows total, active, pending, and global-admin counts from that complete projection.
- **Program admin:** the same RPC returns only members of programs they administer and those administered programs. It does not expose unrelated program memberships or global-role editing. Direct program-access writes retain RLS enforcement.
- **Reviewer or viewer:** the RPC returns no rows and the route presents an access-denied state.
- **Loaded state:** compact user cards show name, email, Global Role, Account Status, and a grouped program list. Manage Access opens a dialog with the global role and each permitted program selector. The layout uses the existing neutral surfaces and responsive card pattern.
- **Other states:** loading, empty, and load-error states are explicit. Selectors are disabled while their mutation is pending, show an error toast on failure, and refetch after success.
- **Account status:** `account_setup_completed=false` means Setup Pending; `true` means Active for the stored lifecycle flag. Grandfathered pre-migration profiles are not evidence of historical invite acceptance.
- **Global admins without a program membership:** the card says "No program record · Global Admin" because current database authorization gives a global admin program-wide authority even without a membership row. Stored membership and effective global privilege are explained separately.

## Release verification

Apply `20260928190000_admin_review_reset_and_access_safety.sql` before deploying the matching UI. On 2026-09-28, the migration and `supabase/tests/admin_review_reset_and_access.sql` passed together inside one explicitly approved `BEGIN`/`ROLLBACK` transaction on the connected project. The fixture covers authorized and denied callers, drafts and submitted reviews, Grant certifications/scores, lifecycle and idempotency cleanup, projection changes, preserved identity, audit rows, and fresh review identity reuse. A separate read-only check confirmed zero fixture users, zero fixture applications, no reset audit table, and no migration-history entry remained afterward. The rollback test validates the proposed migration against the current database schema; it does not install the migration or prove the deployed UI.

After the migration was applied externally on 2026-09-28, read-only inspection found the audit table and all three admin RPCs present. The same SQL fixture then passed against the installed objects under `BEGIN`/`ROLLBACK`. A follow-up query found zero fixture users, applications, or audit rows; authenticated clients can execute the reset RPC and cannot directly delete `reviews` or `program_reviews`. The SQL function bodies matched the checked-in migration. The migration had been applied without a history entry, so `npx.cmd supabase migration repair --status applied 20260928190000 --linked` recorded it without rerunning SQL. `supabase migration list --linked` then showed matching local and remote versions for `20260928190000`; function-body hashes remained unchanged. The live SQL test does not prove the deployed UI.

Verify role-specific dialogs and 375/390/768/1024/1440px layouts with authenticated browser sessions before launch. No production review data was reset during implementation.
