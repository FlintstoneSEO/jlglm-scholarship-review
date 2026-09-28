# Business Growth Grant Rankings — Phase 9

## Screen and data boundary

Rankings is an administrator-only committee view. It remains **Decision Support Only** and never writes funding decisions. The existing Scholarship ranking route and `program_rankings` view remain unchanged; Grant Rankings reads existing RLS-protected tables in batches and calculates rows in `buildGrantRankingSummary`.

The primary task is to distinguish fully reviewed applications from partial or unavailable data, then open the application for deeper review. Desktop uses a semantic table. The existing responsive record layout presents labeled cards below 1280px, with the rank and business first, followed by score, reviews, tier, status, and the application link. A compact summary and review-status filter support scanning.

## Calculation contract

- Only `active` assignments are expected. A suspended assignment remains historical and does not count as outstanding or contribute a current ranking score. Completed reviews on active assignments count only while their current status is `completed`; reopening removes the review from the current average until resubmission.
- A completed review uses its own `rubric_version_id`, the criteria belonging to that version, and its persisted `review_scores`. Exactly one valid score per criterion is required, including intentional zero. A missing version, missing or extra score, out-of-range score, or version whose maximum is not 100 makes the application's score data unavailable and calls for administrator attention. No normalization occurs.
- Average is the sum of valid completed totals divided by their count. Display uses one decimal; sorting and ties use the unrounded value. One review displays a single score; two or more display minimum–maximum.
- A numeric rank requires at least one active assignment, every active assignment completed with valid scores, and eligibility `eligible` or a currently active scoring exception. Applications with unresolved eligibility or bad scores never receive numeric ranks. An admin exception remains labeled.
- Numeric ranks use standard competition ranking: `1, 2, 2, 4`. Exact equal averages tie. Business name provides stable display order within a tie only. Partial applications follow ranked ones, then applications unable to rank.
- The Phase 7 `getGrantFundingRecommendation` helper supplies the average tier and recommendation for rankable rows only. Partial averages are labeled current and recommendations remain pending.
- Certification is matched to the current completed review version. An absent record is presented as not recorded, including legitimate historical submissions; it is never inferred. Only aggregate certification counts appear here.

## Access and validation

The route requires Grant administrator access and makes no new authorization grants. Queries use the existing browser Supabase client and RLS. Individual reviewer names and score pairs are not shown. The application link uses the existing detail route and permissions. A query error fails the whole ranking view rather than presenting partial data as authoritative. Local tests cover calculation, lifecycle, historical rubrics, eligibility, certification, and ranking. Deployed role and viewport verification remains a release check.
