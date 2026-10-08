# Preliminary screening refinement — October 7, 2026

Implemented on `business-growth-grant-brand-refresh` under the user's detailed preliminary-screening specification. This increment preserves the Justice League visual system and existing screen hierarchy, routes, shared ReviewWorkspace, queues, assignments, rubric, certification, conflict handling, Scholarship behavior, persisted requirements, and administrator exception semantics.

## Audit and migration implications

Inspected GrantOverview, grant-eligibility-draft, grant-eligibility-display, grant-overview, grant-screening, grant-review-readiness, both Grant routes, current migrations, RLS and SQL tests. README and architecture-audit describe context; current code and migrations establish the actual screening behavior.

The batch RPC calls the existing requirement and confirmation RPCs transactionally. Writes require a program administrator; direct table writes are denied. Confirmation requires every one of the six approved keys verified for Eligible, and trimmed notes of at least 10 characters for Needs Clarification or Ineligible. Changed checks reset the decision and revoke an active scoring exception through an audited event; new exceptions require a documented reason. Scoring triggers and submission RPCs enforce the gate while retaining historical scores. These existing rules satisfy the server requirements. No database migration, RPC, RLS, backfill, scoring change, or production mutation is required or performed. The existing RPC architecture follows [Supabase database functions documentation](https://supabase.com/docs/guides/database/functions); no new provider feature is introduced.

## Findings and exact changes

| Severity | Element / state | Observed problem and evidence | Exact change, reason and expected outcome | Verification |
| --- | --- | --- | --- | --- |
| High | grant-eligibility-draft / unscreened Grant | Both decision and baselineDecision defaulted to eligible. | Use an empty UI selection until the administrator chooses; preserve saved final decisions. Prevent an assumed decision. | Draft tests, walkthrough step 1. |
| High | verifyDocumentGroup / all Grant screening widths | documentRequirementKeys included lara_good_standing. | Exclude LARA from the document bulk action but retain it in the six eligibility keys; verify LARA independently. | Tests across every LARA status and notes, walkthrough steps 2–3. |
| Medium | GrantOverview / overview tab | LARA evidence lacked a registry action and specific business context. | Show submitted business name, unverified applicant status, secure external registry link and independent-verification instructions alongside existing controls. | Source inspection; browser walkthrough steps 2–3 pending. |
| Medium | Grant detail / Save progress after a saved decision | The server resets the saved decision after changed checks, but the local baseline still treated the retained decision as saved. | Reset the local decision baseline after saving changed checks while retaining decision/note edits. Navigation protection continues until final confirmation or discard. | Progress-draft regression test and walkthrough step 4. |

## Screen specification and delivered behavior

Keep Business at a glance → Eligibility & compliance → Saved eligibility decision → Competitive review progress. Add verified count and named outstanding requirements above the six existing checks. Mark applicant evidence as unverified; show human results separately. In the LARA row show the submitted business name, applicant-reported status, registry action (new tab, noopener noreferrer), instructions and existing status/note controls. The bulk action attests only to the two P&L years and document completeness after inspection.

The final select initially displays Choose a decision. Decision actions remain disabled with an explanatory message until a decision and its prerequisites are complete. Save progress remains independent of the final decision. Saved status, confirming identity and time remain separate from the editable draft. Existing success/error toasts and filter-preserving Save & next navigation remain in place. Existing wrapping layouts, minimum touch targets and focus styles are reused; rendered responsive verification remains pending.

## Validation

- PASS: `npm.cmd test` — 146 tests, including new blank-decision, all-six-key validation, explanatory-note, every-LARA-state, immutable bulk draft, saved-decision reload and progress-retention regressions. Existing queue-filter/next-selection and Scholarship/Grant regression tests pass.
- PASS: `npx.cmd tsc --noEmit`.
- PASS: ESLint on all five changed TypeScript/TSX files.
- PASS: isolated PGlite applies all checked-in migrations, then runs grant_eligibility_batch_save.sql, grant_eligibility_screening.sql, multi_program_authorization.sql, phase_d_scholarship_transactional.sql and phase_d_grant_transactional.sql. These cover authorization, atomic saves, stale writes, score locks and audited overrides using fictional rollback fixtures.
- FAIL: repository-wide `npm.cmd run lint` — 5,752 errors and 12 warnings, primarily existing formatting/CRLF violations across unrelated files. This increment does not reformat the repository.
- PASS: `npm.cmd run build` — Vercel output generated. The initial sandboxed attempt failed because esbuild could not read parent directories; the permitted retry outside that restriction passed. Nonfatal dependency annotation/chunk warnings remain.
- NEEDS MANUAL VALIDATION: authenticated browser, real hosted role/RLS and concurrent-admin behavior, external registry and private document access, responsive layout and keyboard path. Isolated SQL is not production/browser evidence.

## Prince's walkthrough

Use fictional practice/test applications and an administrator account in the approved test environment.

1. Open a Needs screening application with queue search, scoring, LARA, business-age and operating-model filters. Confirm no final decision is selected; verify count and outstanding checks are clear.
2. Compare the business name and unverified applicant-reported LARA status with the application. Open Search Michigan Business Registry; confirm a new tab opens. Search the business, identify the matching entity, inspect current standing and record findings manually. Do not treat a submitted Active answer as verification.
3. Inspect both P&Ls and completeness, then choose Verify three document checks. Confirm LARA and owner/business results are unchanged, including any existing failed/clarification LARA state and note. Verify LARA only after independent inspection.
4. Save progress; reload to confirm checks persisted without a final decision. Change a decision or note and attempt navigation to verify the warning. For a previously screened fixture, change a check and save progress; confirm the saved decision resets and the retained final-decision draft remains protected.
5. Choose Eligible with any requirement pending, missing, failed or needing clarification; saving must remain blocked. Verify all six manually; save and reopen. Confirm saved decision, administrator identity, timestamp and notes.
6. Choose Needs clarification and Ineligible separately. A blank/short note must block final saving; a meaningful note of at least 10 characters permits it. Confirm normal competitive scoring remains locked.
7. Save & next applicant from the filtered queue. Confirm the next record matches every filter and the URL retains them; when exhausted, confirm return to the same queue. Unsaved competitive edits must prevent Save & next.
8. As a reviewer or viewer, confirm screening controls are unavailable and screening writes are rejected. On a fictional ineligible application, test an administrator scoring exception with a meaningful reason, audit record, scoring access and revocation. Confirm historical scores remain.
9. Review at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Check long business names, outstanding text, link wrapping, keyboard focus, radio selection, notes, disabled-action explanations and success/error messages. Smoke-test Scholarship draft/submit and the Grant scoring/certification/conflict workflow.

No deployment or production database change is included. Rollback is the five frontend/test file changes; existing screening records remain intact.
