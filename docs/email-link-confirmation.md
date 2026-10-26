# Email link confirmation, version 1.0.1

## Authorized scope and existing behavior

The October 17 request authorizes fixing password recovery and updating the app version. Previously Supabase email links went directly to `/auth/v1/verify`, consuming a one-time token on GET before the portal displayed `/reset-password` or `/accept-invite`. October 17 production logs show successful Betty Sanford link redemptions from a recurring cloud IP followed by `One-time token not found` on later attempts. This strongly suggests email prefetching; scanner ownership is not proven.

Severity: high. Element: public recovery/invite email links and password setup. State: opening emailed links. Evidence: the above Auth logs and the existing direct-confirmation template convention in README. Recommended change: land on the existing public route with a token hash in the URL fragment, verify only after explicit Continue, and allow manual email/code verification. Reason: a GET or HEAD must not redeem the token. Expected outcome: ordinary link scanners do not consume a token. Verification: mocked component integration tests plus a controlled live email test after rollout.

## Preservation and migration implications

No database migration, role, RLS, reviewer assignment, scoring, account deletion, or token-expiry change. Existing implicit token and PKCE callbacks remain supported. Setup completion continues to require password persistence and the existing profile policies. The portal remains invitation-only; recovery does not create accounts. Link verification accepts only the route's fixed allowed types and ignores external redirect destinations. Fragments avoid sending token hashes in initial HTTP requests or referrers. They are cleared after successful verification. No tokens or codes should be logged or stored separately.

## Rollout, required hosted configuration

1. Deploy the app commit containing version 1.0.1 first. Existing direct links still work but remain vulnerable to prefetching.
2. In the linked Supabase project `vkbjvoltuecfvedhedbu`, Authentication > URL Configuration, verify Site URL is `https://review.justiceleagueglm.org` and the exact `/reset-password` and `/accept-invite` destinations are allow-listed. Align `APP_URL` and `VITE_APP_URL` with that origin. Review preview/local environments separately.
3. Copy `supabase/templates/recovery.html` to Reset password, `invite.html` to Invite user, and `magic-link.html` to Magic link. Do not leave a direct `ConfirmationURL` link elsewhere in those templates. Preserve SMTP settings and disable mail-provider click tracking. Hosted templates are dashboard configuration, not automatically deployed by committing files or SQL migrations.
4. Send one fresh email to a consenting test account. Loading its link repeatedly, including HEAD/GET and a fresh browser, must not call verifyOtp. Press Continue once: password form appears. Save a new password, then verify normal login and existing program access. Reusing the link must fail.
5. Request a second email and use its code plus the recipient email on the reset page. Confirm wrong/expired codes fail, correct codes work, and code entry never creates an account. Test invite completion separately. A recovery code uses type `recovery`; a magic-link code uses `email`.
6. Retest Betty with a newly requested email after rollout. Old consumed links cannot be repaired. No real emails/accounts were changed during implementation.

The confirmation button blocks ordinary prefetchers; scanners that execute and interact with forms may still require the manual-code fallback.

## Rollback

Restore the prior hosted templates first, then roll back app code if necessary. This restores the old scanning risk. No data rollback is needed.

## Implementation verification

- `npm test`: 170 passing tests, including parsing, type isolation, code fallback, error/missing-session failures, and existing setup/password sequencing.
- `npx tsc --noEmit`: passed.
- ESLint on changed TypeScript/TSX files: passed after formatting.
- `npm run build`: passed, produced the Vercel output; existing dependency directive/chunk warnings remain.
- A jsdom/React component harness with mocked Supabase verification and password form passed: StrictMode mounting makes zero verification calls; duplicate clicks submit once; success clears the credential fragment and reveals password setup; wrong-type and expired links fail closed; legacy route behavior is preserved. This is component-level verification, not a live SMTP/Supabase end-to-end test.
- React checklist: side effects occur in user events, duplicate requests are guarded, effect cleanup is unnecessary for synchronous fragment parsing, initial server/client render agrees, native labeled inputs and buttons retain keyboard semantics, status/errors are announced. No additional production dependencies.

Hosted email template changes, production deployment, and a fresh real email test remain required. The available Supabase connector does not expose Auth configuration/template writes.
