# Grant contact details and guide correction

## Authorized scope and evidence

The user requested updates from Prince Solace's emails, “Business Portal- Uploading emails” (November 6 follow-up) and “Business Portal -Updated Help guide” (November 6, 2026). The follow-up confirms email is visible and asks for applicant phone numbers. The guide request specifies minimum three years in operation, minimum $20,000 annual revenue, and a Greater Lansing Region location.

## Current behavior and preservation boundaries

The Grant importer maps `Phone Number` / `contact_phone` into the existing detail field. The Grant workspace already fetches that field through its existing detail query, but its header only renders applicant name and email. Scholarship already exposes email and phone; this is a presentation gap, not a different contact policy. The shared workspace accepts React content, so no shared-engine change is needed.

The existing `business_details_select` policy delegates to application access, with additional restrictive practice scope. Keep queries, policies, roles, assignments and privacy boundaries unchanged. No schema, backfill or production data mutation is needed. Missing numbers must remain explicitly missing; do not infer them.

The Help guide lists six human-verified screening categories. Add the requested minimums as guidance under business eligibility without adding checks, changing saved decisions, automatically reclassifying applications or changing scoring semantics. No migration is required.

## Screen specification and decision

Preserve the existing shell, navigation, tokens, typography and visual direction. On `/grants/$id`, replace the single contact sentence with applicant name followed by labeled email and phone rows in the same header context. Use native email/telephone links, visible focus, wrapping text and 44 CSS-pixel link height; missing values say “No email provided” / “No phone number provided.” Keep contact details visible across workspace tabs and stack rows at every width so mobile prioritizes the same information.

On `/help` with Business Growth Grant selected, add a short minimum-requirements list within Eligibility & compliance and explain where contact details appear in Applications. Scholarship help stays unchanged.

## Verification

Run existing tests and production build, review the diff and verify formatting. Check populated/missing contact states and responsive rendering at 375, 390, 768, 1024 and 1440 CSS pixels where a local browser fixture is available. Live recipient contact completeness and authenticated production rendering are separate from source verification; do not claim either without checking.

Completed: 193 tests passed; `npm run build`, `tsc --noEmit`, and `git diff --check` passed. Updated the existing workspace identity assertion for the JSX contact layout. Installed dependencies using the existing lockfile. Build emits a large-chunk warning. No authenticated browser/viewport review or live contact-completeness check was performed. No deployment or email sending was performed.
