# Justice League Review Portal architecture audit

## 1. Current architecture

The application is a React 19 and TypeScript single-page/SSR application built with TanStack Start, TanStack Router file routes, Vite, Tailwind CSS 4, Radix UI components, and TanStack Query. It is deployed through Cloudflare Workers (`wrangler.jsonc`) and uses the Lovable Vite/TanStack integration. Authenticated application routes live under `src/routes/_app.*`; `_app.tsx` checks for a Supabase session and wraps pages in `AppShell`.

Supabase is called directly from the browser with the publishable key. A separate server-only client exists for a service-role key, but the current scholarship screens do not use it. The browser client persists and refreshes the Supabase session. TanStack server-function middleware validates bearer tokens with `getClaims`. Authentication supports email/password and Lovable-mediated Google OAuth.

The main reusable pieces are the auth provider, shell, design system, query setup, badges/cards/forms/tables, import file parsing, and storage signed-URL pattern. The application list/detail, contact templates, missing-document logic, dashboard metrics, fixed 5-reviewer totals, and writing/rhetoric scoring UI are scholarship-specific.

## 2. Existing database schema

- `profiles` mirrors `auth.users` with email and full name.
- `user_roles` assigns one or more global enum roles (`admin`, `reviewer`, `viewer`). A signup trigger creates the profile and grants the first user admin, later users viewer.
- `applicants` is the scholarship application record. It mixes contact metadata, education fields, document URLs, signatures, preliminary screening, decision flags, review status, aggregate score, and rank.
- `reviews` belongs to an applicant and reviewer. The original five-category rubric remains in legacy columns; a later migration added the active writing and rhetoric scores, draft/completion fields, and a trigger that totals completed reviews.
- `applicant_notes` and `contact_logs` belong to scholarship applicants.
- `reviewer_discussion_documents` stores metadata for objects in the private `reviewer-discussion-documents` bucket.

There is no program table, program membership, reviewer-assignment table, configurable rubric, generic application header, business-application model, or idempotent import log.

## 3. Scholarship workflow

Admins import CSV/XLS/XLSX rows directly into `applicants`, perform preliminary screening, bulk-mark eligibility, update finalist/selected/follow-up flags, manage global roles, and view scoring summaries. Reviewers currently see every eligible applicant, not an assigned queue. A reviewer opens an applicant, reads scholarship fields and external essay/transcript URLs, optionally uploads a discussion document, saves a draft or submits writing/rhetoric scores, adds notes, and logs contact attempts. One review per reviewer is intended in UI but not enforced by a database uniqueness constraint. Applicant totals are the sum of completed reviewer subtotals (the UI assumes five reviewers and a maximum of 90).

The detail screen currently queries all reviews and displays every reviewer's scores. The later storage migration also added broad authenticated read policies that weaken the earlier restricted policies. These conflict with the requested private-score and assignment boundaries.

## 4. Refactoring plan

Add a normalized program/application authorization layer without moving or renaming scholarship data in the first release. Existing `applicants` rows will link to shared `portal_applications` headers and continue to power existing scholarship screens. Business grants will use the same header plus `business_grant_application_details`. New reviewer assignments, rubric criteria, reviews, score rows, document metadata, import batches, and import rows will be program-aware.

The client auth context will load the user's program memberships and selected program. Navigation and the dashboard will follow that selection. Existing scholarship routes stay intact; new grant list/detail/ranking/import and assignment administration routes use the generic model.

## 5. Proposed database changes

- `programs(id, slug, name, description, active, created_at, updated_at)`
- `user_program_access(id, user_id, program_id, access_role, created_at)` with unique user/program membership
- `portal_applications(id, program_id, external_submission_id, submitted_at, applicant_name, applicant_email, status, review_status, completed_review_count, average_score, created_at, updated_at)` with unique program/external ID
- `applicants.application_id` as a unique link from the legacy scholarship detail row
- `business_grant_application_details(application_id, contact/business/need/use/impact fields, raw_response, updated_at)`
- `application_documents(id, application_id, label, file_name, storage_path, external_url, content_type, created_at)`
- `reviewer_assignments(id, application_id, program_id, reviewer_id, assigned_by, assigned_at, due_at)` with unique application/reviewer
- `rubric_criteria(id, program_id, name, description, maximum_points, display_order, active, created_at, updated_at)`
- `program_reviews(id, assignment_id, application_id, program_id, reviewer_id, status, reviewer_comments, total_score, started_at, submitted_at, timestamps)` with one review per assignment
- `review_scores(id, review_id, criterion_id, points, created_at, updated_at)` with one score per criterion/review
- `import_batches` and `import_rows` for auditable, idempotent ingestion outcomes
- `program_rankings` security-invoker view for deterministic decision support

Existing scholarship applicants are backfilled into `portal_applications`; existing admins receive both program memberships and existing reviewers/viewers receive scholarship membership. Existing eligible scholarship applications are assigned to existing scholarship reviewers so rollout does not empty their queues. The scholarship rubric is seeded from its known criteria. No Business Growth Grant criteria are guessed or seeded.

## 6. Authorization plan

RLS is enabled on every new public table. `anon` receives no table access. Authenticated grants are operation-specific and RLS then limits rows. Global admins retain administrative continuity and receive program-admin memberships. Program admins/viewers can read program data; reviewers can read only assigned applications. Reviewers can create/update only their own review and score rows. Program admins alone manage imports, rubric configuration, and assignments. Reviewers cannot read another reviewer's review or score rows.

Private `SECURITY DEFINER` helpers live in a non-exposed `private` schema with pinned empty search paths, internal `auth.uid()` checks, and narrowly granted execute permission. Storage policies resolve the application from the object path and apply the same application-access check. Existing broad discussion-document policies are removed.

## 7. File change plan

- `supabase/migrations/*_multi_program_review_portal.sql`: schema, backfill, triggers, grants, RLS, storage, ranking view
- `src/integrations/supabase/types.ts`: generated-shape additions for new tables/enums/view
- `src/lib/auth-context.tsx`: program memberships and selection
- `src/components/AppShell.tsx`: portal identity, program selector, program-aware navigation
- `src/routes/_app.index.tsx`: selector and program-specific dashboard
- New grant list/detail/ranking/import and reviewer-assignment routes
- Scholarship detail/list queries and review presentation: assignment/private-score compatibility
- `src/lib/business-grant-import.ts`: pure validation/mapping boundary
- `supabase/tests/multi_program_authorization.sql`: policy and invariant checks
- `README.md`: setup, migration, import format, and rollout notes

## 8. Risks

- The current migrations contain duplicate, conflicting policies; later permissive policies override the intended document restrictions. The new migration must explicitly drop all conflicting policies.
- Scholarship review totals are sums while the new generic model uses reviewer totals and application averages. Both semantics must remain clearly labeled.
- There is no current reviewer assignment data. Backfilling eligible scholarship applications prevents immediate reviewer lockout, but administrators should verify assignments after deployment.
- Scholarship document URLs are arbitrary external URLs rather than objects protected by Supabase Storage. RLS protects their database visibility, but link-provider permissions still govern the files themselves. Future ingestion should copy authorized files into private storage.
- Browser-side multi-table imports cannot be fully transactional. Unique external IDs prevent duplicates and import logs expose partial failures; an Edge Function/server transaction is the recommended automation boundary for a future Google Sheets sync.
- The worktree had pre-existing changes in package/build/generated MCP route files at audit time. They must be preserved and reviewed separately.
- `.env` is tracked and contains live project URL/ID and publishable-key values. No service-role/private-key value was found, and Supabase publishable keys are intended for browser use, but environment-specific files should still be removed from tracking in favor of a sanitized `.env.example`. If this file ever held a secret/service-role key, rotate it and remove it from Git history.
- There were no existing automated tests. Database policy tests and pure import tests are added, but applying/testing RLS against a linked or local Supabase instance remains a deployment gate.
