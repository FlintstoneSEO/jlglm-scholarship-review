# Conflict history and application identity clarification

Authorized October 26, 2026: clarify resolved conflict records and show business and applicant names together in Review Distribution.

## Audit and screen specification

- Severity: medium. Element: GrantCommitteeAllocation, real/test administrator Conflicts tab, all widths. Observed problem: resolved history omits the application identity and presents a raw decision. Evidence: resolved list renders reviewer, decision, date and replacement only. Exact change: show business, applicant, a readable resolved state, original/replacement reviewer, current active reviewers, resolution reason and date. Reason: users must distinguish historical resolution from current assignment. Expected outcome: an administrator can identify which business was reassigned and to whom. Verification: synthetic browser replacement journey and source/type/build checks.
- Severity: medium. Element: GrantCommitteeAllocation tab and empty state. State: zero unresolved conflicts. Observed problem: zero can be mistaken for no recorded conflicts. Evidence: Conflicts (0) alongside collapsed history. Exact change: label the count as needing action and explain resolved history. Reason: separate pending work from audit history. Expected outcome: zero is clearly actionable work only. Verification: browser empty and resolved states.
- Severity: medium. Element: distribution progress, allocation preview, conflicts and assignment administration. State: business names differ between submissions. Observed problem: applicant identity is missing. Exact change: pass existing scoped application data into the distribution components; render business plus labeled applicant and include applicant in progress search. Reason: identify related submissions without guessing that they are duplicates. Expected outcome: users can recognize business/applicant relationships. Verification: synthetic names and filter browser assertions.

Keep the existing compact application shell, tokens, disclosures and wrapping text at mobile widths. Business is the primary identity and applicant a labeled supporting line. Shared program assignment mechanics stay intact; Scholarship naming remains unchanged. Loading/error states must not claim successful resolution.

## Preservation and migration

Display-only change. Existing scoped application data is reused; no additional Supabase queries, credentials, RLS changes, migrations or production mutations. Frozen allocation snapshots are not rewritten; current names are presentation overlays with snapshot fallback. Review identities, scores, history and assignment lifecycles remain unchanged. No duplicate application is deleted, merged or excluded. Jus Us Kidz submissions require committee confirmation before reconciliation.

## Validation

Run TypeScript, changed-file lint, the unit suite and production build. The existing synthetic browser contract exercises replacement and retained history; update its expected copy and verify applicant names and reassignment labels. Browser verification status is recorded in delivery notes.

Validation results: TypeScript (`npx tsc --noEmit`), changed-component ESLint, all 178 Node tests and the Vercel production build passed. `git diff --check` passed. The updated synthetic browser contract could not run: Chromium was absent and its download returned an invalid/truncated archive. Rendered responsive, keyboard and accessibility verification remains pending. No production data was changed.
