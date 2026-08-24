# Justice League Review Portal

This TanStack Start and Supabase application supports two isolated review programs:

- Educational Scholarships
- Business Growth Grants

The architecture audit and rollout design are in [`docs/architecture-audit.md`](docs/architecture-audit.md). Apply `supabase/migrations/20260824040023_multi_program_review_portal.sql` before deploying the updated client. The migration backfills every scholarship applicant into the shared application layer, preserves legacy scholarship detail records, grants existing global admins access to both programs, and grants existing reviewers/viewers scholarship access.

## Business Growth Grant setup

1. As a program admin, open **Users & Access** and grant Business Growth Grant reviewer access.
2. Open **Rubric** and enter only the committee-approved criteria and maximum points. The migration intentionally seeds no guessed grant rubric.
3. Open **Import Applications** and upload a CSV/XLS/XLSX export from Google Forms/Sheets. Each row must include a stable response ID, applicant/contact name, and business name.
4. Repeat exports are safe to import: `(program_id, external_submission_id)` is unique and imports update application/detail data without deleting assignments, reviews, or scores.
5. Use **Reviewer Assignments** to grant reviewers access to specific applications.

Supabase is the portal's operational source. Reviewers never query Google Sheets. External supporting-document links remain governed by the source provider; for fully portal-controlled access, copy files into the private `business-grant-documents` bucket and store their paths in `application_documents`.

## Security and verification

- Public-schema tables use RLS and `anon` has no access to new portal tables.
- Reviewers see assigned applications and only their own review/score rows; program admins can see program-wide progress and rankings.
- Private storage policies use the same application-access predicate.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` through a `VITE_` variable or browser bundle.
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
