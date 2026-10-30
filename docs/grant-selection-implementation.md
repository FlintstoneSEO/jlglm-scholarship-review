# Grant committee selections

Authorized October 30, 2026: extend Rankings with a Finalists & recipients tab and shared selection labels. Exactly three interview finalists and exactly two final recipients. Committee decisions are manual, independent of score order.

Baseline: grant Rankings is administrator-only decision support; Scholarship uses legacy is_finalist/is_selected flags. Preserve both score engines, eligibility, assignments, authentication, routes and Scholarship semantics. Reuse tabs, buttons, dialogs and brand tokens. Add a grant decision record rather than repurposing review status or copying legacy toggles.

Screen specification: retain Rankings as the default tab; show saved selection labels in its table. The second tab provides an application checklist, save-three-finalists action, then a two-recipient checklist and named confirmation. Saved finalists remain visible after finalization. Compact divided rows, native checkboxes, wrapping labels and full-width mobile actions preserve density. Loading/error states disable writes. Server failures preserve choices. Finalization locks this first version; correction is a separately scoped follow-up.

Data boundary: additive decision/history tables, admin-only reads and RPC writes; optimistic revision checks and per-program locking. Reject duplicates, test records, wrong-program IDs and invalid counts. Existing records are not backfilled or changed. No automatic selection from supplied names. Migration must be applied and database authorization/concurrency tests passed before release. No production mutation is authorized by local implementation.

Design: preserve existing shell and Phase E direction. Mobbin Deel candidate table informs status placement (https://mobbin.com/screens/4f007485-06fc-4eb0-9ab2-8c700b31e148); avoid pipeline boards and decorative award treatments. Finalists display business names and application links; group metadata requires verified integration before release.

## Validation status

TypeScript check passed; all 187 existing unit tests passed; Impeccable mechanical scan returned no findings. Database execution is blocked locally because Docker/Podman is unavailable. The included SQL smoke test checks direct-write grants, anonymous RPC denial, RLS and missing-identity rejection; full fixture-based count/subset/concurrency/role tests and authenticated responsive browser review remain required before release. This implementation has not been deployed or populated with the email's finalist names.
