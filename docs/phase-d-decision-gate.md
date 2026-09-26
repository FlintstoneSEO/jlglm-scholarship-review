# Phase D decision gate: review submission architecture

Date: 2026-09-26  
Scope: decision and architecture preparation only. No Phase D persistence, submission, schema, RLS, assignment, or score changes are authorized by this document.

## Gate result

**PHASE D WRITE IMPLEMENTATION IS NOT AUTHORIZED.** Every decision in the decision register remains `OPEN`. D1–D4 are direct blockers for the proposed write boundaries; D5 and D6 constrain score and rubric validation; D3, D7, and D8 constrain authorization and visibility. D9 does not block backend contract design, but remains required before further navigation or visual changes.

A recommendation below is analysis, not approval. Each unselected decision is marked **BLOCKED — PROJECT DECISION REQUIRED**. Current behavior remains in force until the register records an approved option, decision maker, date, scope, transition/retention behavior, and verification evidence.

## Decision matrix

### D1 — Submitted review editing

- **Current behavior:** Scholarship and Grant owner-update policies and browser flows permit updates after completion. Scholarship “Save draft” can update an already complete row without clearing `is_complete`. The MCP writer also updates a discovered completed row.
- **Risk if unchanged:** “Submitted” does not communicate a reliable lifecycle boundary; scores, comments, timestamps, and aggregates may change without an explicit reopen event or audit record.
- **Options and technical consequence:**
  - **A, immutable:** reject all reviewer writes after submit; define a separate admin correction/reopen process if needed.
  - **B, reviewer reopen until deadline:** persist the governing deadline and an approved transition; enforce it in the transaction and RLS.
  - **C, administrator reopen:** reviewers cannot mutate final rows until an authorized administrator creates an explicit transition.
  - **D, always editable:** treat submit as completion signaling rather than finality; every later edit must deliberately update timestamps/aggregates and may require history.
- **Migration impact:** none can be finalized until an option is approved. B/C likely need lifecycle/version fields and perhaps history. A/D may still need version/idempotency fields.
- **RLS impact:** policies or the authorized function must enforce the selected state transitions; hidden/disabled controls are insufficient.
- **UI impact:** labels, action availability, error states, timestamps, and any reopen control must match the approved rule.
- **Rollback implications:** deploy enforcement after preflight; retain old rows and make new lifecycle fields additive. A rollback may relax the new boundary but must not erase recorded events.
- **Tests:** score/comment changes after submit, timestamps, aggregate updates, direct API access, admin/reviewer reopen permissions, concurrent edits, and browser/MCP parity.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED.**

### D2 — Scholarship review identity and duplicate reconciliation

- **Current behavior:** `reviews` has no migration-verified unique `(applicant_id, reviewer_id)` constraint. Browser and MCP writers each read then update/insert; that sequence is race-prone. The aggregate trigger counts completed rows, so duplicates can increase both completion count and the /90 sum.
- **Risk if unchanged:** concurrent writes can create multiple identities for one reviewer/application and alter completion and score meaning.
- **Options and technical consequence:**
  - retain all historical rows but designate an explicitly approved canonical row;
  - merge into one row under an approved field-by-field reconciliation rule while preserving originals in audit/history;
  - adjudicate each duplicate pair before enforcing uniqueness.
    After reconciliation, an approved unique constraint plus an idempotent canonical writer should prevent recurrence.
- **Migration impact:** read-only preflight and conflict report first; no constraint until every duplicate is resolved explicitly. Never delete or choose “latest” silently.
- **RLS impact:** canonical write boundary must still verify assignment and actor; uniqueness is not authorization.
- **UI impact:** unresolved historical conflicts need an admin-visible resolution state if they exist; reviewer UI should resolve one canonical review.
- **Rollback implications:** retain a reconciliation map/export and unchanged source records until verification; make constraint removal reversible without reversing reconciled score meaning.
- **Tests:** historical duplicates, null reviewer IDs, UI/MCP concurrency, double submit, aggregate /90 preservation, and approved reconciliation fixtures.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED.** Live duplicate inventory was not possible because no connected database credentials are available.

### D3 — Scholarship eligibility revocation

- **Current behavior:** eligibility creates assignments; resetting eligibility does not remove them. Queue queries hide ineligible applicants for non-admins, while assignment-aware database access can remain.
- **Risk if unchanged:** queue visibility can be mistaken for authorization; direct access may expose application, review, note, contact, or document data after revocation.
- **Options and technical consequence:** suspend assignment access while retaining history; permanently revoke access while retaining immutable records; or preserve limited read access to completed work. Each option must define drafts, completed reviews, notes, discussion documents, assignment status, and re-eligibility restoration.
- **Migration impact:** potentially additive assignment lifecycle fields; never delete reviews/documents as an implicit consequence.
- **RLS impact:** application, Scholarship review, note/contact, discussion-document, and storage policies must consistently enforce the selected lifecycle.
- **UI impact:** revoked/suspended state, loss-of-access handling, and re-eligibility behavior must be explicit.
- **Rollback implications:** prefer reversible suspension over deletion; retain actor/time/reason if lifecycle state is introduced.
- **Tests:** every protected table and storage object before revocation, after revocation, and after re-eligibility for every role.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED.**

### D4 — Business Growth Grant atomic submission

- **Current behavior:** the browser creates `program_reviews`, upserts `review_scores`, then updates review status/comments/timestamps. A failure can leave a partial review.
- **Risk if unchanged:** partial saves, ambiguous retries, stale rubric writes, and aggregates that do not represent one accepted submission.
- **Options and technical consequence:** approve one Postgres transaction for both draft and submit, or approve separate atomic functions with identical identity/version rules. Decide idempotency retention, stale-version behavior, and treatment of existing partial rows.
- **Migration impact:** likely additive version/idempotency support and an RPC/function; exact migration is blocked by D1 and D4 approval.
- **RLS impact:** the function must verify authenticated actor, program membership, assignment, application/program linkage, and selected lifecycle; execution grants must be least-privilege.
- **UI impact:** map validation, authorization, conflict, stale-version, already-submitted, unavailable, and transaction-failure errors; prevent duplicate clicks without treating that as the security boundary.
- **Rollback implications:** function deployment should be additive; keep the old client path only for a controlled rollback window and never allow both paths to create divergent identities.
- **Tests:** forced failure at each stage, full rollback, retries, duplicate submit, stale versions/rubrics, and aggregate recomputation.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED.**

### D5 — Scholarship reviewer count

- **Current behavior:** five reviewers, reviewer subtotal /18, aggregate /90, and completion at five completed rows.
- **Risk if unchanged:** assignment-count discrepancies can exist, but changing only the denominator or trigger would reinterpret current and historical scores.
- **Options and technical consequence:** confirm exactly five; or authorize a separately versioned/configurable future model with explicit historical semantics.
- **Migration impact:** none for confirmation of five. Configurability requires a separate migration and reporting/trigger transition plan.
- **RLS impact:** none expected solely from reviewer count.
- **UI impact:** retain five and /90 until approved otherwise.
- **Rollback implications:** a configurable model must preserve the historical target/version so rollback cannot relabel old scores.
- **Tests:** exactly five, fewer/more assignments, duplicate historical rows, completion transition, /18 and /90.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED. Current preservation rule: five.**

### D6 — Business Growth Grant rubric

- **Current behavior:** active `rubric_criteria` rows drive the Grant UI and maxima; no guessed Grant criteria are seeded.
- **Risk if unchanged:** mutable criteria can make a stale client submit an incomplete or mis-scaled score set; hard-coding would contradict the dynamic model.
- **Options and technical consequence:** approve criteria and an immutable/versioned rubric policy, or retain active-row configuration with an approved snapshot/stale-configuration rule.
- **Migration impact:** none for architecture preparation; rubric version/snapshot fields may be needed after approval.
- **RLS impact:** submission must validate criteria server-side; rubric administration remains program-admin controlled.
- **UI impact:** render arbitrary active criteria/maxima and show stale-configuration errors.
- **Rollback implications:** never reinterpret saved scores when criteria change; retain the configuration used for each accepted review.
- **Tests:** arbitrary criterion counts, maxima, inactive/missing/extra criteria, configuration change during edit, and totals.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED. Existing dynamic architecture must be preserved.**

### D7 — Global admin program selection

- **Current behavior:** the SQL global-admin helper grants broad access, while the selector is based on explicit program membership.
- **Risk if unchanged:** effective database capability and discoverable UI access can disagree.
- **Options and technical consequence:** synthesize all programs for global admins; provision memberships on promotion; or require deliberate grants. Each must define Scholarship program-admin versus global-admin powers.
- **Migration impact:** depends on whether memberships are provisioned.
- **RLS impact:** do not widen policies merely to fix selector UX; align the selected administration model.
- **UI impact:** selector contents and direct-route messaging.
- **Rollback implications:** membership provisioning needs a reversible record of generated grants.
- **Tests:** newly promoted admin, revoked membership, direct URL, and cross-program roles.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED for any access-policy work; not a blocker to contract-only design.**

### D8 — Peer review visibility and comparison

- **Current behavior:** reviewers read their own review rows; admins can read program review rows. Scholarship admin comparison is a distinct administrative function.
- **Risk if unchanged:** aggregate progress, named peer scores, and anonymous summaries can be conflated.
- **Options and technical consequence:** admins-only named comparison; delayed/anonymized reviewer aggregate visibility; or another explicitly timed policy.
- **Migration impact:** probably policy/query changes only, unless anonymized snapshots/history are required.
- **RLS impact:** preserve current restrictions until approved; counts and individual rows need separate authorization analysis.
- **UI impact:** conditionally show comparison details only when authorized.
- **Rollback implications:** policy rollback must not leak cached or materialized peer data.
- **Tests:** named rows, aggregates, timing, and direct queries for all roles.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED for visibility/RLS changes; not a blocker to private adapter design.**

### D9 — Navigation and screen specification

- **Current behavior:** Phase C uses shared queue return, previous/next, identity, status, progress, and section navigation while preserving program routes.
- **Risk if unchanged:** further navigation changes could outrun approved task hierarchy, especially on mobile/admin routes.
- **Options and technical consequence:** approve the plan as written or approve a revised screen specification before further navigation/visual work.
- **Migration impact:** none.
- **RLS impact:** none; navigation never grants access.
- **UI impact:** determines later shell/task hierarchy work.
- **Rollback implications:** preserve routes and deep links.
- **Tests:** role-specific tasks, return behavior, keyboard path, and required viewports.
- **Status:** **BLOCKED — PROJECT DECISION REQUIRED before later navigation or Phase E work. It does not block this presentation cleanup or architecture document.**

## Evidence classification

### Verified from code and repository migrations

- Scholarship browser and MCP paths independently perform read-then-update/insert writes.
- Scholarship aggregation counts completed rows, sums completed subtotals, and marks reviewed at five.
- Grant browser submission is a three-stage client sequence: review row, score rows, review transition.
- Grant schemas already make `assignment_id` unique and `(review_id, criterion_id)` unique; criterion maximum validation and aggregate triggers exist.
- Checked-in policies allow owner updates and do not enforce final immutability.
- The checked-in Grant rubric is dynamic and no Grant criteria are seeded.
- Phase C cleanup makes `ReviewWorkspace` the single Scholarship navigation/header/status/progress layer while retaining contact, screening, finalist/selection, and follow-up actions in its header action area.

These statements describe checked-in migrations and code, not proof of production state.

### Verified from live database

Nothing. No Supabase URL, database URL, service credential, or publishable client configuration is available in this environment. No production or remote query was attempted.

### Not verified

- Which migrations are applied in production.
- Live RLS/storage policies or function definitions.
- Scholarship duplicate pairs, row counts, score differences, timestamps, or aggregate impact.
- Applicant/application linkage completeness, assignment-count discrepancies, orphaned records, program memberships, rubric rows, or live draft/submitted counts.

The read-only inventory in `docs/phase-d-read-only-inventory.sql` must be run by an authorized operator against a safe target and its results reviewed before any migration is authored.

## Gate exit criteria

Phase D implementation may begin only for a specifically approved slice after all decisions that govern that slice are recorded. At minimum:

1. D1 selects and fully defines the submitted lifecycle.
2. D2 selects the canonical Scholarship identity and separately approves reconciliation for every discovered duplicate.
3. D3 defines eligibility-revocation access before related RLS or assignment changes.
4. D4 approves the Grant transaction/retry boundary.
5. D5 confirms five or separately authorizes a versioned alternative.
6. D6 approves rubric/version behavior while preserving dynamic criteria.
7. D7/D8 are approved before affected access or visibility policies change.
8. Live inventory and production-like RLS tests are reviewed.
