# Business Growth Grant eligibility screening

## Decision and data boundary

The six pass/fail requirements belong to the application, separate from the 100-point competitive rubric. `application_eligibility_reviews` has one current row per application. `eligibility_review_items` has one row per stable requirement key. An absent item is pending; an applicant answer or linked file never changes the verification state automatically. Scholarship uses neither table nor this scoring gate.

The current authorization model does not distinguish an assigned competitive reviewer from a designated screener. Requirement verification and final confirmation are therefore limited to global and Business Growth Grant program admins. Assigned Grant reviewers and program viewers can read screening records for applications they may access, but cannot mutate them. Other programs cannot read or write these records. The three tables have RLS and authenticated read policies; all writes use admin checked RPCs. `anon` has no table or RPC privileges.

An admin may confirm **Eligible** only after all six items are explicitly **Verified**. **Needs clarification** and **Ineligible** require a reason of at least ten characters. Changing any requirement resets the final decision to **Not reviewed**. The confirmer and timestamp are stored on the application decision. The Overview shows the decision, confirmer, time, reasons, evidence, document actions, and human verification separately.

## Competitive score gate and exception

The Grant rubric remains readable while locked. Score inputs, comments, Save Draft, and Submit Review are disabled in the browser unless eligibility is **Eligible** or an admin exception is active. Database triggers also reject Grant `program_reviews` and `review_scores` mutations while locked. This covers the canonical `submit_business_grant_review` RPC and privileged/direct writes. Scholarship score mutations are unaffected.

`eligibility_scoring_overrides` is append-only through the application RPC. An admin must supply a reason of at least ten characters. Each event stores the original status, resulting scoring permission, admin ID, reason, event order, and time. An allow event is permitted only while the application is not already Eligible. A revoke event restores the normal decision rule. A changed requirement or confirmed decision automatically revokes an active exception with an audit event; an admin must reconsider and explicitly grant another exception. The Overview labels scoring by exception.

## Existing data and release sequence

The migration does not update or delete existing `program_reviews` or `review_scores`, nor does it infer Eligible from them. Existing Grant scores remain stored and readable under existing authorization. New drafts, scores, submissions, and changes to old competitive reviews remain locked until screening is confirmed or an explicit exception is recorded. The connected database read on 2026-09-27 showed 21 Grant applications, 0 Grant reviews, and 0 Grant score rows; check the target environment again before release.

The connected main database recorded `20260927232459_grant_eligibility_screening.sql` as version `20260927232459` on 2026-09-27. The rollback-only `supabase/tests/grant_eligibility_screening.sql` passed there after the migration. The older `phase_d_grant_transactional.sql` uses an empty-rubric baseline and should run against a matching migrated test database. Before release, test with separate global admin, Grant program admin, assigned Grant reviewer, Grant viewer, and scholarship-only reviewer browser sessions. Verify private evidence links, override visibility, score rejection/acceptance, and 375/390/768/1024/1440px layouts. The transactional SQL test verifies database roles; it does not replace deployed browser checks.
