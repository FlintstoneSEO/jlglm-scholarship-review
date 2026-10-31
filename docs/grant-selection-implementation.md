# Grant committee selections

Authorized October 30, 2026: extend Rankings with a Finalists & recipients tab and shared selection labels. Exactly three interview finalists and exactly two final recipients. Committee decisions are manual, independent of score order.

Baseline: grant Rankings is administrator-only decision support; Scholarship uses legacy is_finalist/is_selected flags. Preserve both score engines, eligibility, assignments, authentication, routes and Scholarship semantics. Reuse tabs, buttons, dialogs and brand tokens. Add a grant decision record rather than repurposing review status or copying legacy toggles.

Screen specification: retain Rankings as the default tab; show saved selection labels in its table. The second tab provides an application checklist, save-three-finalists action, then a two-recipient checklist and named confirmation. Saved finalists remain visible after finalization. Compact divided rows, native checkboxes, wrapping labels and full-width mobile actions preserve density. Loading/error states disable writes. Server failures preserve choices. Finalization locks this first version; correction is a separately scoped follow-up.

Data boundary: additive decision/history tables, admin-only reads and RPC writes; optimistic revision checks and per-program locking. Reject duplicates, test records, wrong-program IDs and invalid counts. Existing records are not backfilled or changed. No automatic selection from supplied names. Migration must be applied and database authorization/concurrency tests passed before release. No production mutation is authorized by local implementation.

Design: preserve existing shell and Phase E direction. Mobbin Deel candidate table informs status placement (https://mobbin.com/screens/4f007485-06fc-4eb0-9ab2-8c700b31e148); avoid pipeline boards and decorative award treatments. Finalists display business names and application links; group metadata requires verified integration before release.

## Initial validation status (superseded below)

TypeScript check passed; all 187 existing unit tests passed; Impeccable mechanical scan returned no findings. Database execution is blocked locally because Docker/Podman is unavailable. The included SQL smoke test checks direct-write grants, anonymous RPC denial, RLS and missing-identity rejection; full fixture-based count/subset/concurrency/role tests and authenticated responsive browser review remain required before release. This implementation has not been deployed or populated with the email's finalist names.

## Completed validation — October 30, 2026

- Integrated origin/main de02f56, preserving transferred-review exclusions and current group ownership.
- Committee labels now reuse the existing assignment summary through a batched administrator-only RPC, including transfers and active reviewer names. Missing groups and failed loads are explicitly labeled.
- TypeScript, targeted ESLint, production build and all 192 unit tests passed.
- All migrations applied in isolated PGlite and native PostgreSQL. Selection access and workflow suites and existing group-transfer SQL tests passed on native PostgreSQL.
- Separate native PostgreSQL connections verified actual lock waiting, stale-write rejection and one audit event for competing saves.
- Browser tests used synthetic authenticated sessions with intercepted local API responses. Verified finalist/recipient limits, group names, confirmation error and retry, persisted reload, keyboard tab activation, reviewer denial and Rankings labels.
- No overflow at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Axe A/AA checks passed on finalist, finalized and ranking states. Desktop/mobile screenshots visually inspected. Evidence: supabase/.temp/selection-evidence/.
- Impeccable scan returned no findings. This is scoped feature verification, not portal-wide Phase F sign-off.
- Hosted migration history confirms prerequisite group-transfer migration is applied; grant_selections is pending. No production changes or selections were made.

## Reproduction

The browser and PGlite runners use the existing supabase/.temp/committee-test dependencies. Run selection-baseline.mjs with the grant_selections.sql and grant_selection_workflow.sql paths. Native selection-concurrency.mjs accepts the absolute embedded-postgres dist/index.js module path as its first argument; it creates an isolated loopback cluster with synthetic records and stops it afterward.

For browser tests, start Vite on 127.0.0.1:4176 with VITE_SUPABASE_URL=http://127.0.0.1:54329 and VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-test-key, then run grant-selections-browser.mjs. External requests are blocked.

## Rollout

Apply only 20261030200000_grant_selections.sql after release approval, then deploy the application. Historical hosted migration timestamps differ from some local filenames; do not blindly push all pending migrations. Verify real administrator group labels and reviewer denial after deployment. Recording the supplied finalist names is a separate deliberate live-data action. No recipients are preselected. Finalization remains locked; corrections require a separately designed audited workflow. If rolling back the app, retain additive decision/history tables.

## Resolved findings

- High; GrantSelections concurrent edits: source inspection found the mutation used the latest refetched revision. Pin the revision at edit start. Expected outcome: no silent overwrite; verified stale SQL writes and native concurrency.
- High; save_grant_selection finalization: source inspection found unsaved finalist sets were accepted. Require the existing saved set. Expected outcome: recipients belong to the saved committee shortlist; verified native SQL rejection.
- Medium; confirmation dialog failed-save state: source inspection found the error outside the dialog. Render it inside. Expected outcome: visible recovery without losing choices; verified browser error/retry.
