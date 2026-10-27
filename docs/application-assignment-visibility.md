# Application reviewer and reassignment visibility

Authorized October 27, 2026: extend PR #19 into Grant application details. Branch: `codex/application-reviewer-assignment-history`.

## Audit and screen specification

| Severity | Element / state | Observed problem and evidence | Exact change and reason | Expected outcome / verification |
| --- | --- | --- | --- | --- |
| Medium | Grant detail, all widths | Header identifies business and applicant without labels; review badge is personal while progress may be aggregate. | Label Applicant and Your review; label the aggregate Application progress. Preserve the business as H1. | Users distinguish people, businesses and review ownership; browser checks at 320/375/390/768/1024/1440px. |
| High | Grant detail, historical assignment | `currentReview` and `myAssignment` match only reviewer ID. | Select an active assignment first and match its review by assignment ID; never use excluded history for scoring or certification. | Historical submitted reviews cannot control active review readiness; unit and SQL fixtures. |
| Medium | Grant detail, reviewer/admin/viewer | No reviewer roster or resolved conflict history. Hosted SELECT policies expose own rows/admin rows only. | Add an application-scoped summary RPC with explicit authorization and redacted history. Display current names/statuses and expandable chronological assignment/conflict/resolution/deactivation events below header. | Authorized application readers can identify current reviewers and replacement chains without reading scores/comments; SQL role tests and browser journeys. |
| Medium | Grant detail, loading/failure/unassigned | Missing summary could be mistaken for zero assignments; admin warning implies a fault during ordinary viewing. | Independent query, retry/loading/error messages, unknown aggregate on failure, explicit admin/viewer versus assigned-reviewer copy. | A failed request never claims no assignments or no conflicts; browser error and unassigned fixtures. |

## Scope and preservation

Keep the existing Concept B shell, typography, tokens, Lucide and semantic browser controls. This is an incremental information/workflow improvement, not a new visual direction. Keep Scholarship UI behavior and scoring semantics. No assignment, review, score, rubric, eligibility, snapshot, conflict declaration or production record is rewritten. Detailed reasons and resolver identity are returned only to program administrators. Other application readers receive reviewer names, progress statuses, replacement relationships and event dates, never peer scores/comments or private reasons.

The private SECURITY DEFINER helper exists specifically to project a limited cross-reviewer summary across own-row RLS. It checks authentication, Grant program, existing application authorization and practice visibility. The public RPC is SECURITY INVOKER. Both functions revoke public/anon execution and grant authenticated execution explicitly. Existing table policies remain unchanged.

## Composition and states

Task order: business/applicant identity, personal review status and aggregate application progress, current reviewers, history disclosure, existing readiness/conflict controls, application tabs. Use a compact divided list with names and textual statuses; wrap rows at narrow widths. History uses native details/summary and a dated list. Admin links carry application/program/scope to existing assignment administration. Distribution history links open the exact application. No new navigation destination or write action.

Summary is an independent, user/application keyed read, refreshed after saves/conflict reporting and on window focus. Initial loading, failure/retry, empty assignments, no history, held review, cleared conflict, replacement, repeated replacement, deactivated assignment and missing profile names all have explicit states. A summary failure leaves the existing review workflow usable while aggregate progress remains unavailable.

## Rollout

Apply the additive summary migration before deploying the frontend. Do not apply it to production as part of branch development. Validate locally with isolated PostgreSQL fixtures, TypeScript, changed-file lint, unit tests, production build and synthetic browser journeys. Hosted application identity/assignment and policy inspection is read-only. Roll back frontend first, then drop the public RPC and private helper if necessary. Record actual verification below before delivery.

## Verification evidence

- Hosted read-only inspection confirmed the screenshot application has two active reviewers and one suspended historical assignment. No applicant names, reviewer identities, emails or application IDs are embedded in the implementation or test fixtures.
- Hosted assignment/review/conflict policies match the own-row/admin boundaries used in this design. No hosted schema or record was modified.
- New summary SQL suite covers multi-step replacement, cleared and held conflicts, current draft projection, redaction, unchanged peer-review row access, unassigned/replaced/cross-program/anonymous/revoked access, empty roster, administrative deactivation and archived/nonparticipant practice isolation. All fixtures roll back in isolated PGlite.
- Synthetic browser suite: `node supabase/tests/reviewer-usability-browser.mjs --assignment-summary`. Covers reviewer roster, independent aggregate progress, replacement chain, cleared conflict, unknown-progress/error/retry, unassigned admin with retained submitted history, and empty states. Six widths (320, 375, 390, 768, 1024, 1440), keyboard disclosure and scoped WCAG axe scan passed. External hosts, including Google Fonts, were intentionally blocked. Browser uses fallback fonts; production font rendering remains a hosted check. Chromium was supplied through an alternate local test executable after the default Playwright download failed.
- Hosted migration, production deployment and authenticated real-account acceptance remain pending. The branch does not change live assignments or reviews.

### Reproduce local checks

```sh
npm ci
npx tsc --noEmit
npm test
npm run build
npm install --prefix supabase/.temp/committee-test --no-save @electric-sql/pglite playwright @axe-core/playwright
node supabase/tests/run-committee-local.mjs supabase/tests/grant_application_assignment_summary.sql supabase/tests/grant_conflict_resolution.sql supabase/tests/admin_assignment_deactivation.sql supabase/tests/grant_practice_sessions.sql
```

For browser fixtures, start Vite with `VITE_SUPABASE_URL` and `SUPABASE_URL` set to `http://127.0.0.1:54329` and both publishable-key variables set to a synthetic value. Run the browser harness from the same network namespace as Vite. All non-loopback hosts and unexpected writes are blocked by the harness. Install Playwright Chromium, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a local test executable. Screenshots remain under ignored `supabase/.temp/`.

Final checks: TypeScript passed; all 182 unit tests passed; changed-file ESLint passed with the two existing React fast-refresh export warnings; production build and `git diff --check` passed. All checked-in migrations applied in isolated PGlite and all four targeted SQL suites passed. New application summary browser suite, existing reviewer/Scholarship workflow suite and Review Distribution browser suite passed, including six-width screenshots and scoped axe checks. Distribution fixture filtering now recognizes the production `in.(...)` application-details query so business and applicant identities are tested independently.
