# Justice League Review Portal

This TanStack Start and Supabase application supports two isolated review programs:

- Educational Scholarships
- Business Growth Grants

The architecture audit and rollout design are in [`docs/architecture-audit.md`](docs/architecture-audit.md). Apply `supabase/migrations/20260824040023_multi_program_review_portal.sql` before deploying the updated client. The migration backfills every scholarship applicant into the shared application layer, preserves legacy scholarship detail records, grants existing global admins access to both programs, and grants existing reviewers/viewers scholarship access.

## Business Growth Grant setup

1. As a program admin, open **Users & Access** and grant Business Growth Grant reviewer access.
2. Open **Rubric** and enter only the committee-approved criteria and maximum points. The migration intentionally seeds no guessed grant rubric.
3. Open **Application Source** to connect the private Google Forms response sheet. Paste the Google Sheet URL, test the service-account connection, choose its worksheet, review the detected headers, save editable mappings, and use **Sync now** for the initial import.
4. The legacy **Import Applications** page remains available for controlled CSV/XLS/XLSX imports during migration or recovery. Each row must include a stable response ID, applicant/contact name, and business name.
5. Repeat exports and Google Sheet syncs are safe to import: the portal retains a source-specific record key and imports update applicant/detail data without deleting assignments, reviews, or scores.
6. Use **Reviewer Assignments** to grant reviewers access to specific applications.

## Google Sheets synchronization deployment

The Google Sheets connection is server-side. Do not add Google credentials to `VITE_*` variables, the browser, or the repository.

1. Create a Google Cloud service account, enable the Google Sheets API, and download its JSON credential only to a secure administrator workstation.
2. In Supabase Edge Function Secrets, set `GOOGLE_SERVICE_ACCOUNT_JSON` to that JSON. The Application Source screen displays the service-account email after a successful test; share the response sheet with that address as **Viewer**.
3. Deploy `supabase/functions/google-sheets-sync`. It validates a signed-in caller's program-admin access before manual inspection or sync; scheduled calls use a separate random token.
4. Set a strong `GOOGLE_SHEETS_SYNC_CRON_TOKEN` Edge Function secret, store the identical value in Supabase Vault as `jlgl_google_sheets_sync_cron_token`, then run [`supabase/scheduled/google-sheets-sync.sql`](supabase/scheduled/google-sheets-sync.sql). This uses `pg_cron` and `pg_net` to invoke the server-side function every 15 minutes.
5. In Application Source, save mappings and turn on **Automatic sync**. Failed rows are retained in run/import logs while valid rows continue.

The sync only writes source-owned application fields, business-detail fields, source metadata, and newly discovered document links. It does not write reviewer assignments, rubric criteria, reviews, scores, reviewer notes, or review status. Google Drive upload links are retained as source URLs; access remains governed by Google Drive until a future service-account copy to the private `business-grant-documents` bucket is enabled.

Supabase is the portal's operational source. Reviewers never query Google Sheets. External supporting-document links remain governed by the source provider; for fully portal-controlled access, copy files into the private `business-grant-documents` bucket and store their paths in `application_documents`.

## Security and verification

- Public-schema tables use RLS and `anon` has no access to new portal tables.
- Reviewers see assigned applications and only their own review/score rows; program admins can see program-wide progress and rankings.
- Private storage policies use the same application-access predicate.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_SERVICE_ACCOUNT_JSON`, or `GOOGLE_SHEETS_SYNC_CRON_TOKEN` through a `VITE_` variable or browser bundle.
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
