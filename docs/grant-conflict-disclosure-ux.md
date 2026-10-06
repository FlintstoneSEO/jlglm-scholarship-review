# Completed conflict disclosure

User-authorized focused Phase E update, 2026-10-06. Preserve the existing shell and visual direction.

## Audit and preservation

The Grant workspace displays the disclosure in its notice area. A saved no-conflict declaration currently leaves all guidance and reporting controls visible. Scholarship has no equivalent prerequisite disclosure panel; no shared review-engine change is needed. Grant declaration and report RPCs, assignment checks, conflict holds, eligibility gating, score persistence and certification remain unchanged. No migration or persisted-data change is required.

## Screen specification

- Before declaration, show the existing guidance, declaration action and conflict report form.
- After the refreshed server data confirms a declaration for an active personal assignment, show a compact heading and “No known conflict recorded” status. Collapse the guidance and report form into a native keyboard-accessible disclosure labeled “View disclosure / report a conflict”. A later conflict can still be reported.
- Place “Start review” beside the completion summary on desktop and full width beneath it on mobile. It opens and focuses the existing Application tab, where application answers and contextual scoring are available. This action navigates only; existing eligibility requirements still gate scoring and saving. For submitted reviews, label it “View review”.
- An unresolved conflict keeps the hold message expanded and offers no start action. Administrative visibility without an active personal assignment keeps its existing explanation.
- Keep errors visible outside the collapsed area. Keep mutation buttons disabled while saving. The summary comes from refreshed server state, never an optimistic local completion flag.

## Verification

Run scoped lint, TypeScript and the production build. Authenticated browser verification should cover initial declaration, saved and reopened declaration, later reporting, unresolved hold, missing/inactive assignment, ineligible application and submitted review. Verify keyboard disclosure and tab focus, and mobile action wrapping at 375/390 pixels. Local checks do not establish deployed or authenticated browser behavior.

Local validation: PASS — TypeScript, scoped ESLint and production build. The build required an approved run outside the sandbox after a configuration-directory access denial. NEEDS MANUAL VALIDATION — authenticated interactions and responsive rendering. No deployment was performed.
