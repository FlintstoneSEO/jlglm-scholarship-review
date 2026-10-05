# Growth Grant committee increment 1

Authorized locally on 2026-10-05 by the bounded implementation request. No production migration, deployment, invitations, emails, assignment changes, or broader Phase F work is authorized.

## Pre-implementation audit and preservation boundaries

README and the cohort proposal correctly identify React/TanStack Start, browser Supabase, and Vercel. The architecture audit's Cloudflare deployment, absent program tables, broad peer visibility, absent tests, and unrestricted reviewer queue describe an earlier baseline: current migrations and routes supersede them. The decision register's final Phase E prohibition is stale relative to AGENTS.md; no new visual direction is requested here.

Verified sources: multi-program migration, Phase D submission migration and follow-ups, Grant eligibility and certification migrations, account setup and admin reset migrations; assignments and Grant detail routes; shared queue projections and review write adapter. RLS limits review details to owner/admin; scores inherit review access. Global admins and program admins screen; six verified items precede Eligible. Existing eligibility exceptions stay intact but do not qualify an application for paired allocation. Active/suspended assignment lifecycle affects access. Restrictive assignment/review FKs preserve identity. Certification remains required at submission. Grant aggregates average completed individual reviews; Scholarship retains five reviews, /18 and /90. This increment changes none of those semantics.

## Implementation-ready screen and data plan

- Preserve shell/navigation, routes, typography, controls, and shared progress projection. Add vertical controls and lists within Assignments and the Grant workspace; no new route or operational scrolling table.
- Screening: six existing checks retain human decisions. Clearly label submitted answers and document references, including absence. A reference proves neither accessibility nor content, ancestry, ownership, year, or current LARA standing.
- Allocation: select six distinct existing account IDs with reviewer/admin Grant memberships into three pairs and explicitly confirm identities against committee records. Names in the proposal are reference only. No seeded identity mapping. A database-generated persisted preview freezes roster, actual eligible/unassigned/no-activity pool, exclusions, capacity, coverage and allocation. Reopening selects the stored preview; explicit reshuffle creates a new preview and supersedes the previous one. Choose balanced or fixed per-pair capacity explicitly before preview/apply. Unallocated records remain visible.
- Apply: authorized, transactional, locked, idempotent RPC revalidates program, roster memberships, exact pool snapshot, eligibility and activity. Write two individual assignments per allocated application; retain actor/time/roster/snapshot/result. Preserve prior work and private score policies.
- Conflicts: display existing expectation before rubric; assigned reviewer reports required reason. Own/admin read only. Serialize report and competitive writes on the application; database triggers cover direct review/score writes including privileged writers, and canonical replay gate checks hold before returning success. Reports do not suspend access, clear drafts, change assignments, remove scores or recalculate ranks.
- Admin unresolved queue has no resolution/replacement control. All conflict resolution remains pending committee policy, particularly existing-activity treatment. Random allocation does not eliminate conflicts.
- Progress: paired application shows two independent expected reviews using shared individual projections; no aggregate formula change. Admin visibility is broader than own competitive assignments. Existing invitation/password setup is reused without sending.
- States: loading, errors/retry, unauthorized, incomplete/unconfirmed roster, empty pool, excluded/unallocated, stale/superseded preview, applying/applied, own conflict hold, unresolved admin reports. Native labels, 44px controls, wrapping vertical lists and visible focus at 320px.

## Migration and rollback implications

Additive Grant-scoped allocation audit and conflict tables, RLS/select grants, RPCs and guards. No existing row backfill or scoring rewrite. Do not seed guessed committee accounts. Validate on an isolated synthetic database before release; compare deployed schema separately. Retain audit/report tables on rollback, cut UI callers back first, and do not disable conflict guards while unresolved reports exist. Dropping a guard is a policy-changing release requiring approval. No automatic report resolution or replacement assignment is implemented.

## Pending decisions and verification

Account identity confirmation is required operational input; local synthetic IDs can test mechanics but cannot establish committee identity. Replacement allocation, resolution and historical score treatment require committee policy. Production/email/onboarding checks remain separate release work. Local test, database, rendered and production evidence will be recorded below after implementation.

## Delivered behavior and operational notes

`20261005211902_growth_grant_committee_increment.sql` adds two tables and three public RPCs: preview, apply, and report. It does not seed committee accounts. The six named people remain reference text only. Configure pairs by existing account ID and membership and explicitly confirm identities; selected account details and IDs remain visible below controls. A saved preview contains the confirmed roster as program configuration. Previous applied allocations remain available through the saved-preview selector.

Preview freshness means an identical ordered application/eligibility/exclusion snapshot and current valid memberships, not a timer that silently reshuffles. Explicit reshuffle supersedes pending previews. Exact retries of an already applied preview return its recorded result without new assignments; caller admin authorization is still checked. Balanced mode covers all qualifying applications; fixed mode retains every unallocated application in the persisted allocation. The preview shows total, actual pool, coverage, unallocated records, excluded reasons, pair sizes and both reviewers. Pair progress uses `projectAssignmentProgress` and counts two independent active expected reviews, without changing stored totals, completion or rankings. Missing/suspended assignments are visible anomalies.

The existing individual Assignments controls and reset behavior remain available. Their shared record presentation now wraps vertically rather than using an operational scrolling table; Scholarship assignment actions and its legacy progress source are preserved. `ReviewWorkspace.notice` is an optional shared slot after the application header and before tabs; only Grant supplies the disclosure. This preserves application identity first and surfaces conflicts before scoring on every tab. The normal certification remains unchanged.

Conflict reports require 10–4000 characters, derive reviewer identity from auth, require an active personal Grant assignment, and persist reason/time/assignment identity. Report retries retain the first report. Own/admin reads alone are granted. No authenticated report update/delete or resolution RPC exists. Report and competitive writes serialize on the application row. Guards cover INSERT/UPDATE/DELETE of program reviews, score rows and certification rows, including privileged direct writes; the idempotency gate rejects held canonical retries before returning prior success. The other reviewer remains independent. Historical scores still contribute exactly as before.

Migration code follows the existing pinned empty-search-path/security-definer RPC pattern with explicit actor/role checks, private helpers, RLS and revoked public/anon execution. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). No client secret or new external service is introduced.

Preview/apply take short transaction-scoped table locks to cover existing direct assignment, eligibility and membership writers as well as RPC writers. These are infrequent operations but can contend with other programs' writes; a lock/deadlock/constraint failure rolls back the whole operation. Multi-session contention/load testing is still a release gate. Reviewers can retain draft form state when a report is recorded; stored drafts and submitted reviews remain intact. No automatic assignment suspension, replacement, reset or ranking exclusion is performed.

Rollback: first remove new UI callers, retain both audit tables and unresolved-report guards, and keep old assignment/review rows. If restoring the previous idempotency function, use its exact definition from the eligibility migration, but retain a conflict check in the canonical path while holds exist. Never drop conflict protection merely to make old clients save. A complete feature removal requires committee policy for unresolved reports and separately authorized release work. No destructive rollback script is supplied.

## Reproducible local checks

Application commands: `npm.cmd test`, `npx.cmd tsc --noEmit`, scoped `npx.cmd eslint` on changed TS/TSX and test MJS files, and `npm.cmd run build`. The build retains the Vercel preset. esbuild needed execution outside the filesystem sandbox to read ancestor directories; no deployment command was run.

Isolated test dependencies (no application package/lock change):

```powershell
npm.cmd install --prefix supabase/.temp/committee-test --no-audit --no-fund @electric-sql/pglite@0.3.14 playwright@1.55.1 @axe-core/playwright@4.10.2
node supabase/tests/run-committee-local.mjs supabase/tests/grant_reviewer_groups.sql supabase/tests/growth_grant_committee.sql supabase/tests/phase_d_scholarship_transactional.sql supabase/tests/grant_eligibility_screening.sql supabase/tests/multi_program_authorization.sql supabase/tests/account_setup_lifecycle.sql supabase/tests/phase_d_rubric_lifecycle.sql
```

The harness creates a fresh in-memory PostgreSQL instance, loads every checked-in migration in order, then runs rollback-only SQL. It bootstraps minimal Auth/Storage schemas and roles. PGlite has no pgcrypto extension in this harness: SHA-256 digest delegates to Postgres `sha256`; password hashing helpers and the platform event-trigger function are harness-only compatibility shims. This proves SQL/RLS/RPC/trigger behavior in the isolated engine, not Supabase Auth, Storage delivery, PostgREST, production schema parity or real concurrent sessions. No application records, credentials or committee accounts are imported into it.

Browser commands (synthetic API responses, never production fixtures):

```powershell
node supabase/.temp/committee-test/node_modules/playwright/cli.js install chromium
$env:VITE_SUPABASE_URL='http://127.0.0.1:54329'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='synthetic-local-key'
npm.cmd run dev -- --host 127.0.0.1 --port 4173
# In a second terminal:
node supabase/tests/committee-browser.mjs
```

The browser signs in through synthetic auth responses and intercepts all local API responses. Nonlocal requests are blocked, including Google Fonts; screenshots use fallback font metrics. The fixture's deliberate stale-preview response is HTTP 400; that expected console error is not a real backend failure. Evidence is regenerated under ignored `supabase/.temp/committee-browser/` (full-page and viewport screenshots). The fixture exercises UI states; transactional/authorization proof comes from the separate SQL tests.

## Verification report

| Evidence boundary | Status | Result / limitation |
| --- | --- | --- |
| Local functional checks | PASS | 105 unit tests, TypeScript, scoped lint (zero errors; one existing `ReviewWorkspace` Fast Refresh export warning); Scholarship adapter, queue, auth and workspace regressions included. |
| Local production build | PASS | Vercel-targeted production build; no deployment. |
| Isolated database | PASS | All migrations parse/apply; committee, Scholarship transaction, Grant eligibility, multi-program authorization, account setup and rubric lifecycle SQL suites roll back successfully. |
| Committee database invariants | PASS | 43 total / 40 pool / 3 exclusions; 14/13/13; fixed 13 retains one unallocated; distinct members; cross-program/duplicate/missing-capacity rejection; frozen reads; superseded/stale eligibility/stale assignment/membership revocation fail; forced second-member failure leaves zero partial new assignments; retry yields 80 assignments exactly; suspended work survives; canonical save/submit/replay and privileged review/score/certification mutations are held; peers cannot read private review/report data; admin reports readable; aggregates, drafts and submitted scores retained; resolution writes and anon privileges denied; empty pool accounted for. |
| Rendered synthetic browser | PASS | Assignment and Grant workspace full-page/viewport captures at 320/375/390/768/1024/1440; measured scroll width equals viewport width. Applied individual records also pass 320px. Keyboard preview action, explicit roster/capacity, fixed leftovers, stale error, Apply, 1/2 progress, report/hold and reopening without reshuffle pass. Scoped axe scans report zero violations in new allocation/disclosure controls. |
| Full provider/browser/accessibility proof | NEEDS MANUAL VALIDATION | Actual Supabase API roles, private document delivery, multi-session concurrency, provider fonts, screen reader, zoom and other browsers/devices; fixture checks do not establish these. |
| Real committee roster | NEEDS MANUAL VALIDATION | Six account IDs and identity/membership confirmation are not supplied. No guessed roster seeded or live membership changed. |
| Conflict resolution/replacement | NEEDS MANUAL VALIDATION | Blocked transition pending committee policy, especially existing review activity/historical scores. Report/hold/progress are implemented independently. |
| Production / invitations | NEEDS MANUAL VALIDATION | No production DB changes, deployment, live assignment changes, invitations or emails were performed or authorized. |

## Open review findings

| Severity | Element/file | Route/state | Observed problem | Evidence | Exact recommended change | Reason | Expected outcome | Verification method |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| High | Committee roster controls | Assignments, real configuration | Confirmed identities are absent. | User supplies reference names only; no verified ID mapping. | Committee supplies six confirmed IDs; authorized admin selects matching existing Grant members and confirms identities. | Avoid guessed identity/access. | Correct three pairs without hard-coded people. | Compare IDs with committee records and current memberships in authorized test/release preparation. |
| High | Conflict resolution transition | Unresolved reports | No approved resolution/replacement or historical-score policy. | User explicitly keeps these transitions pending. | Committee documents policy before a separately authorized resolution increment. | Preserve real reviews and ranking meaning. | Review-specific holds remain until approved handling. | Policy review plus isolated transition/aggregate tests before release. |
| Medium | Allocation locks / provider boundary | Concurrent Apply and writes | The single-session local harness cannot establish production contention or Supabase API behavior. | PGlite compatibility bootstrap and intercepted browser responses. | Run the checked-in rollback SQL and concurrent Apply/report/save sessions in a full isolated Supabase test stack before release. | Verify platform parity and failure behavior. | Atomic outcomes and authorized private access under real APIs. | Multi-session/database and separate role browser tests; production is not a fixture. |

## Follow-up authorization: saved reviewer groups (2026-10-05)

The user authorized creating groups in the admin section and assigning people only after they have been added to the app. This increment adds Grant-scoped named groups on the existing Reviewer Assignments route, with an existing Users & Program Access link for account creation and program access. No new navigation, authentication, invitation behavior, emails, live data changes, or Scholarship behavior is introduced.

Screen specification: group management precedes allocation. Administrators create or edit a name and select existing Grant reviewer/admin accounts using labeled checkboxes in a wrapping vertical list. Saved groups show their members and any revoked membership. Loading, empty, errors and in-progress saves are visible. Three saved groups with exactly two members each and six distinct existing eligible accounts can feed the frozen preview. Identity confirmation and explicit capacity choice remain required. Narrow screens use normal document flow; no tables or nested scrolling. Existing visual tokens, Card, Button and native controls are reused.

Database plan: additive group and membership tables, restrictive profile foreign keys, admin-only reads and guarded atomic save RPC. Group edits require an expected revision to reject concurrent overwrites. Allocation records store ordered group ID/name/revision/member snapshots. Apply compares snapshots transactionally and fails entirely if a group changed. Applied allocations retain their original roster and assignments even after later group edits. Program membership revocation does not delete group/history rows; it blocks new allocation. Existing direct roster RPC remains compatible for retained previews; UI now selects saved groups. No automatic reassignment, group deletion, conflict resolution or score changes.

Migration/rollback: apply only in an authorized test or separately authorized release. No backfill or guessed accounts. Remove the follow-up UI/RPCs and restore the previous Apply RPC before considering removal of additive tables/preview column; preserve snapshots for applied history and do not delete or reverse assignments. Local SQL, unit, type, lint, build and intercepted responsive browser checks will be reported separately from provider/production verification.


## Saved-group implementation and verification

Migration: `20261005221213_grant_reviewer_groups.sql`, after the committee migration. `GrantReviewerGroups` and `useGrantReviewerGroups` reuse the selected-program admin boundary and existing profile projections. `save_grant_reviewer_group` validates current actor authorization, existing profile IDs and explicit Grant reviewer/admin memberships, then saves the name and all members in one transaction. Unique names are case-insensitive per program. Groups accept 1-20 members; paired allocation accepts exactly two in each of three distinct groups, with six distinct reviewers overall. No member accounts are created by group saving.

Group edits use expected revisions and record the current actor/time. New allocation previews store ordered ID/name/revision/member snapshots and display the frozen group names and revisions. Apply locks groups and members before the existing allocation locks, rechecks actor authorization after membership locks, checks source group snapshots and retains the original pool validation, atomic assignments and retry behavior. Legacy direct-roster previews remain compatible. Applied retries return their recorded allocation even if groups subsequently change. Group changes also clear obsolete identity confirmation in the UI. The wrapper and atomic group saver use the same group-first lock order; actual multi-session contention remains a full test-stack check.

Membership rows use restrictive profile foreign keys. Deleting an app user who is a saved member will fail rather than silently erasing membership; remove that membership by editing its group first. Existing assignment/review/history foreign keys still apply independently. Revoking program access leaves the group/history visible but marks the member unavailable and blocks future allocation/saving until corrected. No group deletion or automatic allocation replacement is included. Existing Users & Program Access invitations and password setup remain unchanged and were not sent.

Administrator operation:

1. Add each person using the existing Users & Program Access flow, and grant Grant reviewer/admin membership.
2. In Reviewer Assignments, create a named group and select existing accounts. Use Edit group to change its name or members.
3. Select three saved groups with two members apiece, verify all account identities, and choose balanced coverage or an explicit fixed capacity.
4. Create and review the frozen preview. A changed group requires an explicit new preview and renewed identity confirmation. Apply preserves individual private reviews.

| Evidence boundary | Status | Follow-up result / limitation |
| --- | --- | --- |
| Local unit/type/lint | PASS | 105 unit tests; TypeScript; scoped lint has zero errors in follow-up files. |
| Local production build | PASS | Vercel-targeted build completed; no deployment. |
| Isolated PostgreSQL | PASS | All migrations and seven rollback suites, including new group tests plus committee, Scholarship, eligibility, authorization, account setup and rubric lifecycle. Group tests reject nonexistent accounts, invalid program membership, duplicate members/names/groups, overlapping pairs, invalid pair sizes, stale revisions and changed-group Apply. Failed edits retain revision/members; stale Apply leaves no partial assignments; applied retry after group edits retains assignments; reviewer reads and direct writes are denied. |
| Rendered synthetic browser | PASS | Create three groups, choose saved pairs, edit a group, invalidate pending preview and identity confirmation, explicitly reshuffle, fixed leftovers, stale eligibility error, Apply/progress and conflict report/hold. Empty and populated group layouts have no overflow at 320/375/390/768/1024/1440px; scoped axe has zero violations. Captures are under ignored `supabase/.temp/committee-browser/groups-*.png` and `groups-panel-*.png` / `groups-form-*.png`. Desktop viewport captures cover the preserved main scrolling shell; body and main scroll widths were measured independently. Supabase responses are intercepted and external font requests blocked. |
| Provider and production | NEEDS MANUAL VALIDATION | Real Supabase API/RLS roles and concurrent sessions, real account/committee identity confirmation, provider fonts, screen reader/device checks and separately authorized release. No production migration, deploy, invitation or live assignment change. |

Rollback requires retaining group snapshots and allocation history. Restore the previous Apply definition from the committee migration before removing source-group helpers. Preserve the conflict guards and all real assignments/reviews. No destructive rollback is authorized or supplied.
