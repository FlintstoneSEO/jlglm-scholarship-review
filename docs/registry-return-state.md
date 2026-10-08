# Review state after returning from the business registry

- Severity: high.
- File: `src/lib/auth-context.tsx`; affected screens include Grant eligibility and both programs' mounted review forms.
- State: signed-in user opens an external evidence link, then returns to the portal tab.
- Observed problem: the user reports verification selections reverting to Pending verification.
- Evidence: the registry link opens a new tab and has no save/reset handler. The installed Supabase client recovers its session on visibility change and can emit SIGNED_IN for the same user. Previously AuthProvider processed that event as a fresh login, clearing authorization and setting loading. AppLayout then replaced AppShell and its route with the loading screen, discarding local form state. Grant eligibility edits are local until explicitly saved; successful saves use the existing transactional RPC and query refresh. Returning to a tab contains no eligibility write. Actual production persistence has not been inspected.
- Exact change: update session/user for repeated same-user SIGNED_IN without clearing authorization or setting loading. Continue the existing same-user token/user refresh handling; initialize authorization for identity changes, initial login, sign-out, and recovery.
- Reason: a session notification for the existing user should not unmount an active review workspace. User identity transitions must still clear previous access and drafts.
- Expected outcome: verification selections, notes, scores, and active tabs survive external-tab round trips. Explicit Save progress and final eligibility decisions retain their current persistence semantics.
- Verification method: regression tests for same-user recovery, refresh, sign-out/re-login, account switches, and recovery; TypeScript, scoped lint, full local tests, and production build. Authenticated external-tab reproduction and saved-record reload verification remain pending because no browser surface is available.

No schema, eligibility rule, assignment, score, or database write changes are required. This fix preserves local state while the same session is active; it does not add automatic saving or persistence across a full browser reload. RLS and server authorization remain authoritative.

Local validation: PASS, all 150 tests including four new session-transition regressions; TypeScript; scoped ESLint with zero errors and one existing fast-refresh warning; diff whitespace check; Vercel/Nitro production build with dependency warnings. Deployed browser and database-record verification: NEEDS MANUAL VALIDATION. No deployment or production mutation was performed.
