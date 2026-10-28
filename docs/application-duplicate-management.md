# Grant duplicate management

## Pre-implementation audit and authorized scope

The October 27, 2026 request authorizes implementation and disposable local tests only. No hosted migration, deployment, or real duplicate action is authorized. Real applicant identities and identifiers are deliberately omitted here and from fixtures.

Current code verified against migrations: Grant records use `portal_applications` plus separate business details, documents, assignments, program reviews, scores and certifications. Scholarship uses the same header/assignment layer but retains its legacy review engine. Competitive Grant writes use the submission RPC, idempotency guard, conflict/clearance triggers, and an application row lock. Grant eligibility and conflict replacement are distinct domain states. Replacement excludes the old review without deleting it. Duplicate handling must not reuse those states.

Operational reads currently include the queue loader (also dashboard), assignment administration (also group workload and progress), practice controls, the production application projection, rankings/funding summary, replacement candidate workload and allocation snapshot. Detail routes deliberately load history tables. Import updates the original external submission identity and source-owned fields, not reviews. The security-invoker production/ranking views preserve underlying RLS. Assignment summaries expose names/statuses while redacting private reasons from non-admins; peer review/score policies remain authoritative.

## Design and migration implications

Add an immutable retained-application ID on the existing header; append one event with administrator, timestamp and reason in a read-only admin audit table. Sensitive audit metadata stays in that table and the admin-redacted timeline, rather than application columns readable by reviewers. Only an internally authorized transactional RPC can set the designation. Existing application/assignment/review read policies remain unchanged. The designation does not grant access to either application. Reviewer history remains available only under existing permissions. No application, assignment, review, score, document, certification, conflict, resolution, prior event or frozen allocation snapshot is removed or transferred.

Active application, assignment and review projections exclude duplicates in the database. Operational consumers use these projections; history consumers keep base tables. Rankings and production projections exclude duplicates. Allocation snapshots exclude them and the existing snapshot comparison rejects pending stale previews. Existing frozen previews are never rewritten. Stored historical scores/counts on the excluded application remain evidence, and must not be treated as active totals.

Lock both applications in UUID order. Review writes serialize on the same application lock and recheck duplicate state, including before idempotent replay. Trigger guards cover review, score, certification and assignment writes. An earlier completed submission is preserved; a later submission fails. PostgreSQL may abort a competing direct child-row edit on deadlock; transaction rollback preserves history and the client reports an error. Never retry a failed operation as a merge or reset.

Both records must belong to Business Growth Grant, have identical test flags, practice session and round, and be in a current practice scope if applicable. Reject self-links, excluded targets and any source with incoming duplicate links. Thus a retained application cannot later be excluded while it has dependents; an administrator must keep the established retained record. This deliberately avoids chains, cycles and automatic retargeting. A repeat with the identical retained ID and trimmed reason is idempotent and preserves the original actor/time; a different request is rejected.

CSV import retains separate source identities. Duplicate fields cannot be cleared or edited through ordinary header updates; re-import may refresh source-owned answers but cannot reactivate assignments or competitive writes. Existing test reset/delete tools must also fail for duplicates/retained records with dependents, preserving the audit and history.

## Incremental screen specification

Preserve Concept B tokens, typography, Lucide, shell, route IA and existing Radix dialog primitives. This adds a workflow without a material redesign. On Grant details, admins see a secondary “Mark as duplicate” action. The application list offers an explicit Active / Excluded duplicates filter and the same action per active row. The dialog searches business and applicant names in compatible scope, requires a retained selection and 10–4000 character reason, then loads fresh affected assignment/review statuses before explicit confirmation. A stale-impact confirmation is rejected and must be reviewed again. No scores/comments are needed in the confirmation.

Confirmation identifies excluded and retained business/applicant names, all affected assignment statuses and preserved review counts. Explain exclusions and that reviews/scores are never combined. Cancel remains available before submission; submitting disables repeated clicks. Loading, no results and inline errors are explicit. Native labeled inputs, radio selection and Radix focus containment/return support keyboard use. At narrow widths names wrap, controls remain at least 44 CSS pixels high, and the dialog scrolls within the viewport.

Details show an excluded-history banner with retained link for administrators only; ordinary reviewers see the exclusion explanation without a new route to another applicant. Admin audit details show reason, actor and timestamp. All preserved reviews are labeled excluded history, including completed reviews. Scoring controls are disabled. A stale open screen receives the database's explicit duplicate explanation on save/submit.

## Rollout and validation

Implementation migration: `supabase/migrations/20261028013523_application_duplicate_management.sql`. The timestamp was generated by the CLI in UTC. This migration performs no duplicate backfill and marks no applications.

1. Obtain separate release authorization and review the additive migration, helper grants, policies, and production schema drift. Preserve a database recovery point.
2. Apply the migration in an approved staging environment. Verify distinct Grant administrator, reviewer, viewer, revoked-member and Scholarship accounts. The local tests use provider stand-ins and do not validate hosted Auth, PostgREST schema-cache exposure or deployment configuration.
3. Verify a synthetic application end to end through the actual hosted API, including stale draft/submit, repeated marking, active totals, import, exclusion filter and audit timeline. Confirm actual table policies still restrict peer scores/comments.
4. With separate approval, apply the migration to production **before** releasing the dependent frontend. The existing frontend does not use all new active views, so do not mark real duplicates during a mixed-version rollout. Existing production and ranking views already exclude designations once migrated.
5. Release the frontend only after approval. This branch explicitly disables its automatic Vercel Git deployment in `vercel.json`, following [Vercel's documented branch setting](https://vercel.com/docs/project-configuration/git-configuration#git.deploymentenabled). Main's deployment convention is unchanged; do not merge until migration/release sequencing is approved.
6. Only after a separate instruction, recheck the intended real records and use the administrator dialog. Never hard-code their identities into the migration or fixtures.

Rollback should revert frontend first while retaining designation/history and write guards. Older operational frontend queries do not all honor the active views: freeze duplicate management and treat their counts as incompatible after any designation exists. Prefer a forward fix. Removing a designation or replacing a retained application requires a separately designed and authorized recovery workflow. This feature intentionally has no undo, score transfer, merge or automatic retargeting.

### Operational read inventory

| Consumer | Database exclusion | History boundary |
| --- | --- | --- |
| Grant queues, dashboard, next work, screening counts | `active_portal_applications`, `active_reviewer_assignments`, `active_program_reviews` | Explicit admin exclusion filter reads headers; detail reads original rows |
| Assignment administration, group workload, combined progress | Active application/assignment/review views | Frozen preview records remain unchanged; active progress removes excluded entries before computing denominators |
| Random allocation and pool totals | `private.grant_committee_snapshot` omits duplicates | Pending snapshot comparison rejects changed pools; applied snapshots are retained |
| Conflict replacement candidates/workload | Eligible target check and workload subquery omit duplicates | Existing conflicts/resolutions stay readable in application history; resolution cannot create new duplicate review work |
| Rankings and funding recommendations | `production_applications` and `program_rankings` omit duplicates | Historical scores/certifications are unchanged |
| Practice and Testing application panels | Active application view | Excluded test records remain discoverable through Applications → Excluded duplicates → Test scope |
| Import | Original external submission ID and original header | Source-owned answers can refresh; designation and source identity cannot be cleared |
| Review draft/submit/reopen/reset, direct child writes | Shared application lock and duplicate guard before idempotent replay; review/score/certification/assignment triggers | Base history tables retain their policies; duplicate test reset/delete is blocked |

### Validation results — October 27, 2026

- All 19 checked-in SQL suites passed against disposable PGlite with every migration applied. This includes duplicate management, multi-program authorization, conflict replacement, distribution, practice, testing, certification, eligibility, assignment history/deactivation and Scholarship transactional paths. The legacy review-reset fixture lacked the current conflict declaration; the same failure was reproduced without this migration, then its synthetic setup was corrected so the complete suite exercises reset again.
- Native PostgreSQL multi-connection tests passed submission-first, marking-first and simultaneous identical marking races. A stale confirmation fails after a competing submission commits; a submission waiting behind a duplicate mark fails without a new review; identical requests return one audit event. Native local PostgreSQL was 18.4, while hosted provider/version behavior remains a staging release check.
- Unit tests, TypeScript, targeted source lint and production build are recorded in the pull request. Build emits existing third-party annotation and large-chunk warnings.
- Synthetic browser tests passed search by applicant/business, required reason/target, no results, loading, errors/retry, impact confirmation, pending-click prevention, retained link, ordinary-reviewer link restrictions, disabled scoring and active/excluded management. Reflow was checked at 320, 375, 390, 768, 1024 and 1440 CSS pixels. Keyboard focus containment/return and scoped axe WCAG AA checks passed. Assignment-summary browser regression passed. External requests were blocked; browser fixtures are not proof of hosted API authorization.
- Visual review removed misleading “Ready to score” messaging on excluded history. No hosted migration, deployment or real marking was performed.

### Reproduction

Use repository Node/npm tooling. Local SQL/browser dependencies are deliberately outside the production package manifest: install `@electric-sql/pglite@0.3.14`, `playwright@1.55.1` and `@axe-core/playwright@4.10.2` into ignored `supabase/.temp/committee-test` when absent.

```powershell
npm test
npx tsc --noEmit
node supabase/tests/run-committee-local.mjs supabase/tests/application_duplicate_management.sql
$sqlSuites = Get-ChildItem supabase/tests/*.sql | ForEach-Object FullName
node supabase/tests/run-committee-local.mjs @sqlSuites
npm run build
```

For native races, start a fresh disposable PostgreSQL cluster with an empty database whose name begins `duplicate_test_`. The runner creates provider stand-ins and migrates that database; never point it at a shared or hosted cluster. Supply a locally installed `pg` module path and set `DUPLICATE_TEST_DATABASE_URL` to its loopback-only connection URL:

```powershell
node supabase/tests/duplicate-concurrency.mjs C:/path/to/pg/lib/index.js
```

Start the local app with synthetic `VITE_SUPABASE_URL=http://127.0.0.1:54329` and `VITE_SUPABASE_PUBLISHABLE_KEY=synthetic-local-fixture-key` at port 4174. In another terminal:

```powershell
node supabase/tests/reviewer-usability-browser.mjs --duplicates
node supabase/tests/reviewer-usability-browser.mjs --assignment-summary
```

Screenshots are saved under ignored `supabase/.temp/reviewer-usability/`. The browser harness intercepts every provider call and blocks non-loopback hosts. No real credentials or applicant records are used.
