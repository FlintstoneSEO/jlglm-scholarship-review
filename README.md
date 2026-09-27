# Justice League Review Portal

This TanStack Start and Supabase application supports two isolated review programs:

- Educational Scholarships
- Business Growth Grants

The architecture audit and rollout design are in [`docs/architecture-audit.md`](docs/architecture-audit.md). Apply the checked-in Supabase migrations before deploying the matching application version. The live project and Phase D release evidence are tracked in [`docs/phase-d-live-verification.md`](docs/phase-d-live-verification.md).

## Business Growth Grant setup

Production application source:

- Spreadsheet: **JL Business Growth Grant Application (Responses)**
- URL: `https://docs.google.com/spreadsheets/d/162njO9n1W5Dkz-il3lbkYsH5OyPk8-vP2noo0H84Mqc/edit`
- Worksheet: **Form Responses 1**

1. As a program admin, open **Users & Access** and grant Business Growth Grant reviewer access.
2. Open **Rubric**, clone the active rubric into a draft (or create a blank draft), edit only the committee-approved criteria and maximum points, then activate the completed version. No guessed Grant criteria are seeded.
3. In Google Sheets, activate **Form Responses 1**, then choose **File → Download → Comma-separated values (.csv)**.
4. In the portal, open **Business Growth Grants → Import Applications** and choose the downloaded CSV.
5. Review every validation message before importing. Applicant first name, last name, and business name are required; middle name and document links are optional.
6. Import the applications, then compare at least two applications and their documents with the source sheet.
7. Re-importing the same CSV is safe. Source-owned application answers are updated without deleting reviewer assignments, reviews, scores, comments, or completion status.
8. Use **Reviewer Assignments** to grant reviewers access to specific applications.

The portal does not connect to Google Sheets and requires no Google Cloud service account. Keep the original Google Forms header row in the CSV; the importer recognizes all 29 live-form columns and preserves the complete row in `raw_response`, including any future columns it does not yet normalize.

The live sheet does not include a stable response ID. The importer therefore derives a repeatable identity from the submission timestamp, applicant name, and business name. Re-import the same export freely, but if any of those identity fields are corrected in Google Sheets, verify the affected applicant carefully because that correction can be treated as a new application.

### Production deployment checklist

- [ ] Deploy the TanStack Start application to Vercel.
- [ ] Apply all checked-in Supabase migrations through the approved release workflow.
- [ ] Download `Form Responses 1` as a CSV without changing its header row.
- [ ] Verify the CSV contains all 29 live-form columns.
- [ ] Upload the CSV through **Business Growth Grants → Import Applications**.
- [ ] Review the row validation results and correct any missing required fields.
- [ ] Complete the initial import.
- [ ] Compare at least two imported applications and their documents with the source rows.
- [ ] Import the same CSV again and confirm there are no duplicate applications or typed documents.
- [ ] Verify Business Growth Grant admin permissions.
- [ ] Verify an assigned grant reviewer can review only assigned applications and documents.
- [ ] Verify a scholarship-only reviewer cannot access Business Growth Grant data.
- [ ] Complete the scholarship application and review regression checks.
- [x] Verify the committee-approved Business Growth Grant rubric is configured in the live database (v2, seven criteria, 100 points; 2026-09-27). Verify the deployed reviewer UI separately.
- [ ] Verify reviewers can open the three private Google Drive document types.

Supabase is the portal's operational source. Reviewers never query Google Sheets. External supporting-document links remain governed by the source provider; for fully portal-controlled access, copy files into the private `business-grant-documents` bucket and store their paths in `application_documents`.

## Security and verification

- Public-schema tables use RLS and `anon` has no access to new portal tables.
- Reviewers see assigned applications and only their own review/score rows; program admins can see program-wide progress and rankings.
- Private storage policies use the same application-access predicate.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable or browser bundle.
- Vercel build environment: set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser bundle.
- Vercel server runtime: set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` for the SSR auth middleware, and configure `SUPABASE_SERVICE_ROLE_KEY` as a server-only secret for invitations. Never prefix the service key with `VITE_`.
- The **Invite User** server function now uses `SUPABASE_SERVICE_ROLE_KEY` on Vercel. Configure it as a server-only secret before deploying this version. Apply `20260927160000_profile_names_for_invitations.sql` first; then test an invitation with a global admin, a program admin, and a denied reviewer account. The browser sends its bearer token through the existing auth middleware, and the server checks current database roles before using the service client. Program admins may invite global viewers into programs they administer; only global admins may grant a higher global role. Existing email addresses are handled through the user list rather than re-invited. If profile or access setup fails after Auth creates the invite, the server attempts to delete that newly invited account and returns a safe error.
- The production adapter is `nitro: { preset: "vercel" }` in `vite.config.ts`, with `vercel.json` identifying TanStack Start. The Cloudflare Vite plugin is supplied by the existing build configuration and is not the deployment target.
- `.env` is intentionally ignored. It is currently tracked in this repository only for public configuration; remove it from Git history if it ever contains a private key, service-role key, or other credential, then rotate that credential.
- Run the production build with `npm run build`.
- Run `supabase/tests/multi_program_authorization.sql` against a migrated test database, then use the Supabase RLS tester with separate scholarship-reviewer, grant-reviewer, and admin accounts before production rollout.

## Admin workflow notes

- Preliminary screening statuses:
  - **Pending Screening**: default status before admin review.
  - **Eligible for Review**: visible to reviewer/viewer accounts.
  - **Did Not Meet Minimum Requirements**: hidden from reviewer/viewer access.
- Reviewers can upload edited discussion copies in PDF/DOC/DOCX from the applicant **Documents** tab.
- Uploaded reviewer discussion files never replace original applicant `essay_url` or `transcript_url` records.
- Reviewer access is limited to applications marked **Eligible for Review**.
- Reviewer users should be created in Supabase Auth and assigned the `reviewer` role in `public.user_roles`.

Administrative reference contacts (not app logic):

- Willye Bryan — entpeople@yahoo.com
- Cheryl Smith — cherylsmith4742@gmail.com
- Dr. Nakia Parker — nakiadparker@gmail.com
- Pastor Terrance King — terrenceking@kminfo.org
