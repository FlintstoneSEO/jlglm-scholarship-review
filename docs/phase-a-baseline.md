# Phase A baseline evidence

Date: 2026-09-26. This is a read-only code and migration inventory for the Phase A adapter work. No database connection or Supabase CLI is available in this checkout environment. It makes no claim about the deployed migration version, production rows, effective policies, or live authorization results.

## Verified from code and local migration files

- Scholarship application identity remains in `public.applicants`; its nullable `application_id` links to `portal_applications`. The migration backfills these links and the sync trigger maintains the shared header.
- Scholarship review identity and scores remain in legacy `public.reviews`; the table has reviewer/application references and `is_complete`, with Writing and Rhetoric fields added by later SQL. No unique `(applicant_id, reviewer_id)` constraint appears in the inspected migrations. The recompute trigger counts completed rows and sums completed Writing + Rhetoric; it marks `reviewed` at five completed rows.
- Scholarship program assignments are in `reviewer_assignments`. The migration trigger inserts assignments for Scholarship reviewers when an applicant becomes eligible; the code does not establish deployed assignment coverage or prove access is revoked on screening change.
- Business Grant reviews use `reviewer_assignments`, `program_reviews`, and criterion-level `review_scores`. The schema constrains one grant review per assignment and per application/reviewer. Triggers recompute criterion totals and the portal application’s completed-review count and completed-review average.
- Grant criteria are program-configured records, and application documents can carry either `storage_path` or `external_url`. Scholarship essay/transcript fields remain original applicant URLs; reviewer discussion copies use their separate document table/bucket.
- Current migration files in the repository include the multi-program migration and three later grant import/RLS repair migrations dated September 2026. Local presence does not establish which are applied remotely.
- Route code reads the native Scholarship and Grant models separately. The Grant detail route currently turns several secondary-query errors into empty arrays; the Scholarship detail route similarly ignores errors for some secondary reads. Phase A adapters preserve per-source read state but are not wired into these routes.

## Requires deployed database validation

- Applied migration history and live policy definitions.
- Duplicate Scholarship `(applicant_id, reviewer_id)` pairs; missing applicant-to-portal links; Scholarship assignment totals versus five-reviewer expectation; completed legacy reviews versus assignments and both status columns.
- Grant reviews without assignments, scores without reviews/criteria, aggregate/status disagreement, and configured rubric state.
- Program membership distribution, role-scoped reads, actual effective access after screening changes, storage access, and whether all source rows can be read by each intended actor.
- Any production counts, scores, document availability, policy behavior, or migration discrepancy.

No record-level anomaly was counted in this environment. The adapters report these cases when their authorized source rows are provided; they do not repair them or replace source queries.
