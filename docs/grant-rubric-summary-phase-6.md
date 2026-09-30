# Grant Rubric summary and verification screen

Phase 6 implements the authorized Business Growth Grant Rubric tab specification. The route, shared workspace, eligibility gate, active assignment check, and `submit_business_grant_review` write path remain in place. Educational Scholarship scoring and funding recommendation logic were not changed.

## Screen specification and state

The Rubric tab leads with review status, eligibility/scoring readiness, criterion completion, current earned points over the dynamic maximum, a criterion-count progress indicator, and the names of criteria still unscored. Rubric rows retain the shared `RubricScoreField`, criterion guidance disclosure, and validation text. A readiness panel sits immediately above Save Draft and Submit Review. At small widths the summary uses a wrapping flex layout, while each score row wraps its long name separately from its score input. No new navigation behavior was added between Rubric and Application sections; this needs a stable section-selection contract before it can reliably target an application response.

`grantReviewSummary` is the single Grant completion calculation. A criterion is complete when its draft score is not `null` or `undefined`; explicit zero counts. Current points sum supplied scores, while the maximum sums each active criterion's `maximum_points`. The progress percentage divides completed criterion count by total criterion count. Invalid or out-of-range input clears the affected draft score, leaving it unscored until corrected.

Save Draft remains available for an assigned reviewer or admin with an open review when the existing `scoringAllowed` gate permits scoring and an active populated rubric exists, even if criteria are unscored. Submit Review is separately disabled until every criterion has a valid score. The canonical RPC still validates the write. Completed reviews show their scores and comments read only, without save/submit actions. Both score and comment edits now contribute to the shared workspace's Unsaved changes indicator; successful saves clear those flags. Switching tabs preserves the draft comments in route state. The workspace currently has an indicator, not a browser navigation guard.

Follow-up correction: an active Grant assignment also permits an admin to score. The previous UI gate required the program role to be exactly `reviewer`, which disabled the score fields for an assigned global/program admin even though the canonical Grant RPC checks the active assignment. `canScoreAssignedGrant` now permits `reviewer` or `admin` access with an active assignment; viewers and inactive assignments remain disabled. The connected Frxsco Creative Services record confirmed an eligible application, active assignment, and admin roles before this UI-only change.

## Migration history reconciliation

On 2026-09-27, the connected project `vkbjvoltuecfvedhedbu` listed 20 applied migrations. Six checked-in filenames had matching migration names but different version prefixes. The files were renamed as follows, without changing SQL contents or applying migrations:

| Previous version | Applied remote version | Migration |
| --- | --- | --- |
| `20260927030000` | `20260927113550` | `phase_d_rubric_version_management` |
| `20260927114210` | `20260927120049` | `revoke_scholarship_review_delete` |
| `20260927114530` | `20260927120057` | `prevent_empty_grant_rubric_submission` |
| `20260927115218` | `20260927120104` | `qualify_review_idempotency_digest` |
| `20260927160000` | `20260927235945` | `profile_names_for_invitations` |
| `20260927232500` | `20260927235959` | `grant_unscored_draft_scores` |

A second remote migration listing and local filename comparison found 20 matching names and versions, with no unmatched files on either side. No database schema or production data was modified for this reconciliation.

## Verification and remaining checks

- TypeScript `tsc --noEmit`: passed.
- Node unit suite: passed, including summary cases for empty, partial, complete, explicit zero, null, dynamic maxima, progress, and unscored names; existing Scholarship regression tests also passed.
- Production Vercel/Nitro build: passed outside the filesystem sandbox.
- Connected rollback-only SQL scripts `phase_d_submission.sql` and `grant_eligibility_screening.sql`: passed. `phase_d_grant_transactional.sql` was not run because it assumes an empty active Grant rubric, unlike the connected project.
- Repository-wide lint: fails on existing formatting issues across the repository. Targeted lint for edited files passed after formatting, with no remaining rule violation.
- Authenticated browser review at 375, 390, 768, 1024, and 1440 pixels and reviewer-role Save Draft/Submit were not available in this local session. They remain release verification work.
