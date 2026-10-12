# Invitation and password recovery investigation

## Authorized implementation specification

The user authorized implementation after reviewing the investigation. Preserve the
current auth shell, typography, public routes, mobile form layout, existing role
model, and own-profile RLS/password requirement. No navigation redesign or schema
change is needed. Primary task: establish a password and finish existing invited
account setup, then enter the authorized portal.

Recovery must save a new password first, read the caller's setup flag, complete it
only when false, then refresh provider state and invalidate routes before showing
success. Missing/inaccessible profiles fail closed. Preserve password-save state
for retry after profile/refresh failure; do not ask for another password update.
Invitation setup may proceed past the SDK's explicit `same_password` error only;
the existing database password-presence policy remains authoritative. All other
password failures stop setup. Invalid-link screens offer a keyboard-accessible
link to `/forgot-password` using the current button treatment. Do not automatically
send email or modify existing accounts. Validate orchestration with regression
tests, TypeScript, and production build. Real delivered-email/browser verification
and deployment remain separate.

Original read-only investigation on October 12, 2026. Local branch:
`business-growth-grant-brand-refresh`, HEAD `e2e949faf2c2190e1b249badfa653b8a12342ba7`.
Existing staged changes were preserved. No application code, accounts, passwords,
roles, memberships, policies, hosted settings, or deployments were changed; no
emails were sent. This document records findings and a proposed repair boundary.

## Evidence and limits

Inspected README, architecture audit, current authentication source, setup migration,
existing login-stall investigation, live Supabase Auth/profile/access records,
live profile policies and password-presence helper, and the last 24 hours of Auth logs.
Project `vkbjvoltuecfvedhedbu` is the connected Justice League database.
Logs identify `https://review.justiceleagueglm.org` as the application origin.
Names below are existing account labels; no password hashes or tokens were retrieved.

The local branch is confirmed. Remote Git verification failed because this shell
could not resolve GitHub. Vercel project inspection succeeded, but deployment
listing returned 403 for the Flintstone team; the deployed commit is not verified.
The historical architecture audit is not current deployment proof. Database audit
table queries returned no recent rows; event evidence comes from Auth logs instead.
No affected person's browser session was reproduced. A link verification login
does not prove that a human reached the portal or finished setting a password.

## Account snapshot

| Account | Confirmed email | Has password | Portal setup complete | Interpretation |
| --- | --- | --- | --- | --- |
| Betty Sanford | Yes | Yes | No | Authenticated account remains behind setup gate |
| Tony Willis | Yes | Yes | No | Authenticated account remains behind setup gate |
| Willye Bryan | Yes | Yes | No | Authenticated account remains behind setup gate |
| Courtney Minor | No | No | No | Invitation not accepted in current Auth state |
| Sean Holland | No | No | No | Invitation not accepted in current Auth state |
| Prince Solace | Yes | Yes | Yes | Setup gate satisfied |
| Wendell Thompson | Yes | Yes | Yes | Setup gate satisfied; this alone does not prove portal use |
| Existing Flintstone administrator | Yes | Yes | Yes | Setup gate satisfied |

Every listed reviewer has Business Growth Grant reviewer membership. Missing stored
program access does not explain the three confirmed-but-pending accounts.

## Finding 1: Recovery does not finish pending invitation setup

- **Severity:** high.
- **Element/file:** `src/components/PasswordSetupForm.tsx`, recovery submit branch;
  `src/routes/_app.tsx`; `src/lib/auth-lifecycle.ts`.
- **Viewport/route/state:** all widths; `/reset-password` followed by portal access
  for an invited user whose `account_setup_completed` is false.
- **Observed problem:** recovery updates the Auth password and reports success,
  but only the invitation branch saves profile completion and refreshes the auth
  context. Protected routes send the still-pending account to `/accept-invite`.
- **Evidence:** recovery calls only `updatePassword(password)` before success;
  invitation calls `finishInviteSetup`, `refreshAccountSetup`, and route invalidation.
  Live Betty, Tony, and Willye records have a password but false setup flags.
  Auth logs show Betty's successful recovery verification at October 11, 9:17:01
  p.m. EDT and Tony's at October 12, 1:34:07 p.m. EDT. These establish Auth sessions,
  not completed setup or human browser access.
- **Exact recommended change:** after a successful recovery password update, read
  the authenticated user's own setup state; if pending, complete it through the
  existing own-profile update boundary, refresh auth context, and invalidate route
  state before reporting completion. Keep a retry state if profile completion fails
  after password persistence, so retry does not write the same password again.
- **Reason:** recovery is a valid opportunity to establish a password for an
  existing invited identity, but the application currently leaves its separate
  setup requirement unsatisfied.
- **Expected outcome:** successful recovery completes pending setup and opens the
  user's existing authorized program without another password-creation prompt.
- **Verification method:** regression tests for pending/active/missing profiles,
  password failure, profile failure and retry; real authorized recovery followed by
  normal sign-in, protected navigation, and verification that existing RLS/roles
  still apply.

## Finding 2: Re-entering the newly saved password can block setup completion

- **Severity:** high.
- **Element/file:** `src/lib/auth-lifecycle.ts:finishInviteSetup` and
  `src/components/PasswordSetupForm.tsx`.
- **Viewport/route/state:** all widths; `/accept-invite` after a password was already
  saved through recovery or an interrupted setup, especially after reloading.
- **Observed problem:** setup always attempts a password update before completing
  the profile unless the current component remembers `passwordSaved=true`. That
  memory is lost on reload. Supabase rejects an identical password and the setup
  completion call is never reached.
- **Evidence:** Auth logs contain `same_password` / HTTP 422 at October 12,
  1:38:34 and 1:40:28 p.m. EDT. Source awaits password update before profile
  completion. The errors lack actor identity in the selected records, so they
  cannot be assigned conclusively to one reviewer.
- **Exact recommended change:** provide a bounded way for an authenticated pending
  account to finish setup when it already has a password, retaining the live
  database password-presence check. Design explicit handling for `same_password`
  in invitation completion; do not treat unrelated password failures as success
  or weaken recovery password-change validation. Preserve retry after partial save.
- **Reason:** requiring another password change is unnecessary for an already
  established password and can prevent the final setup write.
- **Expected outcome:** established invited accounts can finish setup without
  inventing another password; passwordless invite sessions remain blocked.
- **Verification method:** tests for interrupted/reloaded setup, `same_password`,
  other update failures, and passwordless denial, then an authorized browser flow.

## Finding 3: Expired/used links have an incomplete recovery path

- **Severity:** medium.
- **Element/file:** `PasswordSetupForm.tsx` invalid-link state;
  `src/lib/invite-user.server.ts` existing-email branch.
- **Viewport/route/state:** all widths; invalid `/accept-invite` or `/reset-password`.
- **Observed problem:** invalid links show text without an immediate recovery action.
  Invite text asks for another invitation, but the normal admin invitation code
  tells administrators that existing emails already have accounts.
- **Evidence:** logs explicitly report `email link has expired` at October 11,
  8:13:15 p.m. EDT and October 12, 1:33:02 p.m. EDT; other attempts report
  `One-time token not found`. The latter can mean already-used or superseded links
  and does not establish how long a person waited. Courtney and Sean were invited
  October 5 EDT and remain unconfirmed. Actual configured expiry and mail-scanner
  involvement were not verified.
- **Exact recommended change:** offer a direct request-new-reset-link action from
  invalid-link states and an explicit recovery path for existing invited accounts.
  Verify deployed redirect allowlisting, templates, SMTP and expiry before changing
  hosted settings. Preserve neutral email-existence messaging.
- **Reason:** stale links are real, but repeating an old link or trying to recreate
  an existing account does not repair setup state.
- **Expected outcome:** users can obtain a fresh link and complete the corrected
  setup flow with their original identity and program access.
- **Verification method:** expired/reused-link browser cases and a separately
  authorized real email test; confirm redirect target and completed setup.

## Preservation and migration implications

The proposed repair uses existing profile completion semantics and the existing
RLS boundary: users select/update their own profile, only the setup column is
updatable, and completion requires a password on the caller's own Auth row.
The live policies/helper match that intent. No schema migration, bulk completion,
role change, membership change, user deletion/recreation, or review-data migration
is proposed. Live policy inspection is not impersonated-role behavioral proof.
Any one-time administrative correction of existing setup flags is a separate
hosted data change and requires explicit authorization.

Auth logs also show attempted user deletions rejected by reviewer-group foreign
keys. Those attempts were not made during this investigation. Preserve identities
and assignments when repairing access rather than deleting and recreating users.

## Validation status

- **PASS:** current source demonstrates the recovery/setup mismatch; live records
  demonstrate confirmed password-bearing accounts still pending setup.
- **PASS:** live logs demonstrate expired/used links and same-password failures.
- **PASS:** 16 existing authentication lifecycle/session-transition tests. These
  do not exercise recovery completing pending setup or establish browser success.
- Vercel CLI fallback was unavailable; deployed commit verification remains open.
- **NEEDS MANUAL VALIDATION:** deployed commit, hosted email settings, actual browser
  sequence for each affected person, delivery/scanner behavior, and any future fix.
- The subsequent authorized local repair is recorded below; deployment remains pending.

Reference: [Supabase password recovery documentation](https://supabase.com/docs/guides/auth/passwords)
describes recovery as requesting a link and updating the authenticated user's
password. The profile completion flag is this portal's additional requirement.

## Implemented repair

- `finishRecoverySetup` now saves the password, reads the existing own-profile
  flag, and completes pending setup. It fails closed on a missing profile and
  propagates read/write errors. Already-complete profiles are not rewritten.
- Both form paths refresh the auth provider and invalidate routes before success.
  Password-save state lets a failed final step retry without resaving a password.
- Invitation completion accepts only the SDK's explicit `same_password` result
  as an already-established password; the database policy still validates password
  presence. Recovery continues to reject `same_password` as a failed change.
- Invalid-link screens now offer a direct link to request another reset email.
- Existing own-profile permissions, program access, assignments, schema, and all
  pre-existing staged changes remain untouched. No hosted account mutation or
  email send was performed.

Local verification: all 156 tests pass, including six new regression tests covering
pending/active setup, missing/inaccessible profiles, interrupted saves, retry,
explicit same-password handling, and propagated policy denial. TypeScript passes.
Browser preview initialization timed out; real rendered/email-flow validation is
still pending. Production build initially hit sandbox EPERM while resolving a
TanStack dependency; elevated retry successfully generated the Vercel application
output. Changed-file ESLint and whitespace checks pass. Dependency annotation,
ignored use-client directive, and large-chunk warnings remain non-blocking build
warnings. No deployment was performed.

## Production release, October 12, 2026

The user subsequently authorized deployment. Released commit
`991f21b2dba54974f811668587cb756e746a39fd` on
`business-growth-grant-brand-refresh`; it contains only the three authentication
source/test files. All unrelated staged Grant changes were preserved and excluded.
Remote branch and the prior production deployment both matched base `e2e949f`.

- **PASS:** 22 focused authentication tests immediately before release.
- **PASS:** push triggered Git-connected production deployment
  `dpl_AL1fpLoEG5ztP8YeTw7Kk4ae5svr`, which reached READY with no alias error.
- **PASS:** independent domain lookup maps `review.justiceleagueglm.org` to that
  deployment and exact commit.
- **PASS:** HTTP 200 for `/login`, `/forgot-password`, `/reset-password`, and
  `/accept-invite` on the production domain after release.
- **PASS:** browser rendered the new-password/confirmation form on the production
  reset route using the browser's existing session; no password was entered.
- **NEEDS MANUAL VALIDATION:** affected user requests a fresh link, opens the latest
  email, completes reset, enters the Grant portal, then signs out and signs in.
  No reset email was sent or account changed during release verification.

Vercel build-log retrieval returned a team-scope permission error and no CLI
fallback was installed; successful deployment status and domain readback were
available independently. Earlier statements that deployment is pending describe
the pre-release investigation/implementation only and are superseded here.
