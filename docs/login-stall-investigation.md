# Password sign-in stall investigation

## Existing behavior and preservation boundary

The reported symptom is an error notification for an incorrect password, no visible
progress for a correct password, and successful access through password recovery.
The user confirmed that the button returns to Sign In after correct credentials.
The deployed URL is not yet confirmed.

`login.tsx` awaits password authentication, reads `profiles.account_setup_completed`,
then navigates to invitation setup or the requested protected route. The auth
provider independently loads the same setup flag, global roles, program access,
and programs. The protected route repeats the session/setup checks and renders
only after the provider finishes. Recovery establishes a session through the link
and updates the password; invitation setup additionally persists explicit setup
completion. These checks remain authoritative.

This repair changes account-read scheduling and return navigation only. Password validation, invitation
completion, destinations, roles, program membership, RLS, and persisted records
retain their existing meaning. No schema migration or hosted mutation is required.

## Finding

### Return navigation reloads an unauthenticated server

- **Severity:** high
- **Element/file:** `src/routes/login.tsx`
- **Route/state:** `/login?next=...`, successful password authentication; all viewports
- **Observed problem:** the return-address branch uses `window.location.assign`,
  reloading the application on the server after the browser saves the session.
- **Evidence:** Supabase's client persists the session in browser storage; there
  is no cookie/session transfer to the server. `_app.tsx` calls `getSession` in
  `beforeLoad`, including SSR, and redirects missing sessions to login. The reload
  loses access to the browser session during that guard. Recovery's Continue
  action uses client-side navigation and avoids this path.
- **Exact change:** use `await nav({ href: target, replace: true })` for the
  validated local return address.
- **Reason:** run the existing guards in the browser, where the newly persisted
  session is available, while retaining the requested path, query, and fragment.
- **Expected outcome:** successful password login opens the requested portal
  screen instead of returning to login through SSR.
- **Verification method:** real TanStack Router location building preserves
  the return path, query, and fragment;
  source assertions prevent reintroducing a document reload. Deployed account
  validation remains pending.

### Account-read scheduling

- **Severity:** high
- **Element/file:** `src/lib/auth-context.tsx`; `src/components/PasswordSetupForm.tsx`
- **Route/state:** sign-in, restored sessions, invitation setup; all viewports
- **Observed problem:** the provider schedules Supabase reads with a promise
  microtask; invitation setup starts a read directly in its auth listener.
  Neither guarantees waiting until the SDK has finished its auth-event task.
- **Evidence:** installed `@supabase/auth-js` 2.104.1 documents exclusive-lock
  deadlock risks for auth callbacks. The scheduling test demonstrates that the
  old microtask runs before the callback's remaining microtasks. However, the SDK
  fixture completes password sign-in with both schedulers; the reported live
  stall has **not** been reproduced and this is not a confirmed root cause.
- **Exact change:** share `deferAuthWork`, using `setTimeout(..., 0)`, and check
  component/session validity before starting deferred account reads.
- **Reason:** keep Supabase requests outside the auth-event task and discard stale
  provider work before it starts.
- **Expected outcome:** account reads begin after event processing, removing this
  scheduling risk while preserving the account and authorization gates.
- **Verification method:** SDK tests with in-memory session storage and mocked
  network responses exercise session restoration, rejected/accepted passwords,
  authenticated profile reads, and subsequent route-guard session access.
  A separate test verifies task ordering and both listener call sites.

## Verification

- PASS: 140 local tests, including three auth-scheduling tests and two
  return-navigation tests.
- PASS: TypeScript check (`npx.cmd tsc --noEmit`).
- PASS: production build (`npm.cmd run build`); sandbox directory resolution
  required running the build with approved elevated access.
- NEEDS MANUAL VALIDATION: deployed normal login, sign-out/sign-in, reloading a
  protected route, invite setup, and password recovery with an authorized account.
  Confirm the deployed version and inspect browser requests/console if the stall
  persists. Do not share passwords or session tokens in diagnostic output.
- No deployment was performed.

Reference: [Supabase auth-state listener documentation](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
