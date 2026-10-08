# Application Redesign Audit — audit only

Date: 2026-09-26. Scope: current repository code and SQL migrations for Educational Scholarships and Business Growth Grants. This is a static audit; no application code, UI, route, schema, policy, assignment, score, or persisted data was changed. The deployed database, real role sessions, rendered screens, and external document permissions were not inspected. `docs/architecture-audit.md` is a historical pre-migration baseline, not a description of the current tree.

## 1. Architecture and baseline

The native application is React 19/TypeScript with TanStack Start file routes, TanStack Query, Vite, Tailwind/Radix components, a Cloudflare Worker target, and a browser Supabase client using a publishable key (`package.json`, `wrangler.jsonc`, `src/integrations/supabase/client.ts`). `_app.tsx` gates the shell on a Supabase session; `auth-context.tsx` loads global roles and program memberships. Browser queries and writes rely on table grants and RLS. The separate service-role client is present but is not used by these review screens. MCP tools use the caller's bearer token; `submit_review` is a separate Scholarship write path (`src/lib/mcp/tools/submit-review.ts`).

`AppShell.tsx` is shared, but supplies separate Scholarship and grant navigation arrays. `programs`, `user_program_access`, `portal_applications`, `reviewer_assignments`, `rubric_criteria`, `program_reviews`, `review_scores`, import tables, and a security-invoker `program_rankings` view were added by `20260824040023_multi_program_review_portal.sql`. Scholarship `applicants` and `reviews` remain the active Scholarship detail and scoring records; `applicants.application_id` links them to the portal header. Grant detail and scores use the new tables. The live grant form migration adds typed fields and document categories (`20260921090000_live_business_grant_form.sql`). The two September 26 migrations replace the portal application select/insert/update policies for browser CSV import; their presence does not establish that they were applied remotely.

Existing local checks are `npm run build`, `npm test` (grant row mapping only), `npm run lint`, and `supabase/tests/multi_program_authorization.sql`. The SQL test checks schema flags and invariants, but does not impersonate roles to prove access or exercise save/submit transitions. There is no evidence here of a migrated test database or browser test accounts.

## 2. Roles and permission boundaries

| Actor | Current intended data boundary in migrations | Current client behavior |
|---|---|---|
| Global admin | `private.current_user_is_global_admin()` makes program-role checks true; can administer legacy Scholarship data and new program tables. | Global role drives Scholarship admin controls and some shell/admin screens; program selector still depends on membership rows. |
| Program admin | Can see program applications, assignments, rubric and individual program reviews; can write program configuration and imports. | Grant admin routes check selected program role; shared assignments/users accept either program admin or global admin. Scholarship admin controls usually check global role only. |
| Reviewer | Can see assigned application headers/details and own review/score rows. Scholarship access is also tied to assignment via the portal header. | Scholarship route uses global `reviewer` role and eligible screening; grant detail checks own assignment and excludes `viewer`. |
| Viewer | Can read program application data through the application helper; individual review rows remain restricted. | Navigation presents read-oriented routes, although Scholarship `Scoring Summary` is still exposed. |
| No program access | RLS should deny program records unless global admin. | Shell may show no program access; URL navigation is not a permission boundary. |

Important RLS details: `portal_applications` select now gives program admins a direct program-ID predicate before falling back to the application-access helper (`20260926025340_fix_portal_application_insert_returning_rls.sql`). The helper permits program admins/viewers, and reviewers only with an assignment (`20260824040023_multi_program_review_portal.sql:262-284`). Review and score selects restrict reviewers to their own rows (`:578-603`, `:623-638`). New public tables have RLS enabled, `anon` privileges revoked, and authenticated grants/policies (`:481-610`). Storage policies cover two private buckets (`:659-705`); Scholarship essay/transcript URLs and grant external URLs remain governed by their source providers. These are code-level observations, not a deployed policy verdict.

## 3. Primary workflows and completion conditions

| Task | Scholarship path | Business Growth Grant path | Completion or return |
|---|---|---|---|
| Intake and eligibility | Admin imports CSV/XLS/XLSX into `applicants`; admin screens applicants and marks eligibility. Eligible rows trigger assignments to Scholarship reviewers. | Program admin imports the live Google Forms CSV; browser writes portal header, grant detail, typed documents, and import log. No grant screening route was found. | Scholarship reviewer queue requires eligible screening. Grant queue requires a visible portal application; importer may leave partial rows after failure. |
| Queue to workspace | `/applicants` filters by screening and review status; `/applicants/$id` has Information, Documents, Scoring, Notes, Contact tabs, plus previous/next navigation. | `/grants` filters by review state and business fields; `/grants/$id` shows application narrative, documents, raw response, then rubric. | Return links lead to each program's queue. Assignment/RLS control visibility, while client filtering is supplemental. |
| Review draft and submit | Legacy `reviews` row stores Writing and Rhetoric (0–9 each), recommendation, notes, `is_complete`; UI saves by insert/update and then separately updates applicant status. Trigger recomputes completed score and status. | `program_reviews` plus criterion `review_scores`; UI inserts review if needed, upserts all criterion points, then updates status/comments/timestamps. Trigger calculates review total and portal average/status. | Both offer Save draft and Submit review. Neither path has an immutable submitted state in the inspected code/policies. |
| Admin monitoring and decisions | Scholarship dashboard, `/top` scoring summary, finalist/selected flags, contact tools. Five completed reviewer subtotals sum to a maximum of 90. | Grant dashboard, shared `/assignments` and `/users`, grant rubric configuration, `/grant-rankings` by average completed review score. | Decision support is separate from recipient selection; grant ranking does not select recipients. |

Scholarship `applicants.review_status` and `portal_applications.review_status` are synchronized on applicant writes, but Scholarship review writes do not create `program_reviews`. Shared assignment monitoring reads `program_reviews`; it therefore cannot report Scholarship legacy review completion correctly. Grant completion is assignment-relative; Scholarship completion is fixed at five completed legacy reviews. These are distinct current semantics and must not be collapsed by a presentation refactor.

## 4–7. Inconsistencies, state concerns, and constraints

The shell is shared, while queue/workspace/dashboard/ranking composition and status vocabulary diverge. Scholarship uses `reviewed` and fixed combined points; grant uses `completed`, dynamic criteria, average points, and assignment-relative completion. The Scholarship workspace has tabs, notes, contact, discussion uploads and an admin review comparison. The grant workspace has narrative sections and a single rubric panel. These content differences should remain program-owned; queue, assignment, progress, save feedback, and reviewer navigation are candidates for shared mechanics.

Both detail routes have loading and unavailable states. Several secondary queries ignore errors or turn failures into empty arrays (`_app.applicants.$id.tsx:104-136`; `_app.grants.$id.tsx:40-70`). Local form state is initialized from query data and can remain stale if refetch changes the record while the component stays mounted. The grant panel uses a `key` to remount when review/score counts change, which does not cover every server-side edit. Neither path visibly warns about unsaved navigation. Confirmation and conflict behavior for a final submission needs a business decision before implementation.

The September 26 import-policy migrations and `README.md` deployment checklist are a live rollout constraint. Do not infer production state from local SQL. Preserve original Scholarship score meaning, eligibility, automatic assignment behavior, global/program access distinctions, import identity, and document source boundaries. Any dual-write/backfill of legacy reviews would be a migration with reconciliation and rollback requirements.

## Actionable findings

### A1 — Scholarship completion is absent from shared assignment monitoring

- **Severity:** high
- **Element or file:** `src/routes/_app.assignments.tsx:27-64,98-121`; `src/routes/_app.applicants.$id.tsx:585-625`; `supabase/migrations/20260824040023_multi_program_review_portal.sql:374-391`
- **Viewport, route, or state:** Scholarship, `/assignments`, after a legacy review draft or submission
- **Observed problem:** Assignment cards and rows derive completion from `program_reviews`, but Scholarship saves only `reviews`. Scholarship portal status and the shared monitor can disagree.
- **Evidence:** The assignment query reads `program_reviews`; Scholarship scoring inserts/updates `reviews` and applicant status. No bridge from `reviews` into `program_reviews` appears in the migrations.
- **Exact recommended change:** First define a read-only Scholarship assignment-progress adapter based on `reviews` joined to assigned portal applications. Keep its fixed-five and completed-only meaning explicit; add a reconciled shared progress contract only after role-based fixture checks.
- **Reason:** Administrators need trustworthy completion counts without silently changing scoring storage.
- **Expected outcome:** Scholarship assignment progress matches the legacy review records, while grant progress remains assignment-based.
- **Verification method:** In a migrated test database, compare 0/draft/completed Scholarship reviews for assigned reviewers with `/assignments`, `applicants.review_status`, and grant equivalents.

### A2 — Scholarship review identity and post-submit edits are weakly enforced

- **Severity:** high
- **Element or file:** `supabase/migrations/20260425041736_7f615fec-6079-4274-b4e1-69bc7fa2d91f.sql:107-134`; `20260824040023_multi_program_review_portal.sql:623-638`; `src/routes/_app.applicants.$id.tsx:574-625`; `src/lib/mcp/tools/submit-review.ts:23-43`
- **Viewport, route, or state:** Scholarship review create, concurrent submit, and already submitted review
- **Observed problem:** No unique `(applicant_id, reviewer_id)` constraint was found for legacy `reviews`. UI and MCP both find then insert, so concurrent requests can create duplicates. Own-row update remains allowed after completion, and Save draft preserves a prior `is_complete=true`.
- **Evidence:** The legacy table has an applicant index but no matching uniqueness declaration in inspected migrations; both writers use read-then-write; RLS update checks reviewer identity but no status transition.
- **Exact recommended change:** Decide whether submitted reviews may be revised, then design a deduplicated uniqueness migration and explicit transition rules. Until approved, do not map legacy rows into one-review-per-assignment storage or relabel Save draft as reopening.
- **Reason:** Duplicates can inflate a fixed five-reviewer total; revision semantics affect stored score meaning.
- **Expected outcome:** One review identity per reviewer/application and an agreed, testable submit/revision lifecycle.
- **Verification method:** Inventory existing duplicates, test concurrent UI/MCP requests and post-submit saves against a migrated test database, then reconcile totals before release.

### A3 — Grant submit spans multiple writes and can be revised

- **Severity:** high
- **Element or file:** `src/routes/_app.grants.$id.tsx:348-401`; `supabase/migrations/20260824040023_multi_program_review_portal.sql:578-603`
- **Viewport, route, or state:** Grant Save draft, Submit review, network interruption, already completed review
- **Observed problem:** A review row, score upsert, and final status update are separate browser operations. A failed later call leaves a partial draft. RLS allows the owner to update completed reviews and scores; the UI still offers Save draft and Submit review.
- **Evidence:** Sequential calls in `save()` and owner-based update policies; no server transaction or immutable-completion rule is visible.
- **Exact recommended change:** Specify allowed revision and retry semantics; then implement one authorized transactional submission boundary with version/conflict handling, preserving existing criterion totals and RLS. Until then, expose partial-save recovery explicitly in a future UI change.
- **Reason:** A completed status must correspond to the scores and comments the reviewer intended to submit.
- **Expected outcome:** Atomic, repeatable submission with clear failure and revision behavior.
- **Verification method:** Interrupt each write stage, retry, and compare review status, score rows, totals, and timestamps under reviewer/admin accounts.

### A4 — Client roles do not consistently reflect program permissions

- **Severity:** high
- **Element or file:** `src/lib/auth-context.tsx:67-121`; `src/routes/_app.applicants.$id.tsx:75-82,145-148`; `src/components/AppShell.tsx:48-55`; `src/routes/_app.grants.$id.tsx:73-92`; `supabase/migrations/20260824040023_multi_program_review_portal.sql:262-284,629-638`
- **Viewport, route, or state:** Direct route, program switch, global viewer with program reviewer access, new global admin
- **Observed problem:** Scholarship editing uses global role, grant editing uses assignment plus program role, and the shell combines both. A user can see an action that RLS denies, or fail to see an authorized task. A newly promoted global admin may have no selectable program membership even though RLS grants global admin access.
- **Evidence:** The cited predicates differ; `loadAuthorization()` builds the selector only from `user_program_access`; global role mutation in `/users` does not add program memberships.
- **Exact recommended change:** Define a read-only effective-capability contract from global role, program role, assignment, and Scholarship screening, then use it consistently for route states and controls. Keep RLS authoritative and separately decide how new global admins receive program membership.
- **Reason:** Visual permissions and database permissions must describe the same task boundary.
- **Expected outcome:** Navigation and controls match authorized capabilities across programs.
- **Verification method:** Test global admin, program admin, program reviewer, global reviewer/program viewer, viewer, no-access, and cross-program direct URLs with RLS tester accounts.

### A5 — Scholarship assignment changes do not revoke access on screening change

- **Severity:** high
- **Element or file:** `supabase/migrations/20260824040023_multi_program_review_portal.sql:262-284,422-459`; `src/routes/_app.applicants.index.tsx:52-70`
- **Viewport, route, or state:** Scholarship application changed from eligible to did-not-meet-minimum-requirements
- **Observed problem:** Trigger creates assignments when eligibility becomes eligible, but no reverse path removes or suspends them. The application-access helper checks assignment and membership, not current Scholarship screening. The client filters ineligible rows, but direct database access may still succeed.
- **Evidence:** Insert-only assignment trigger and helper predicate in the cited SQL; bulk screening action changes only applicant status.
- **Exact recommended change:** Confirm whether screening revocation should remove reviewer access while preserving history; then design an RLS screening predicate or explicit assignment lifecycle migration, with retention rules for existing reviews/documents.
- **Reason:** Hidden queue rows are not an authorization boundary.
- **Expected outcome:** Ineligible Scholarship records follow the committee's intended access rule on direct queries and document reads.
- **Verification method:** With an assigned reviewer, toggle screening in a test database and query applicant, portal header, notes, review, and storage via that reviewer's token.

### A6 — Error and stale-form states can mislead reviewers

- **Severity:** medium
- **Element or file:** `src/routes/_app.applicants.$id.tsx:77-136,574-582`; `src/routes/_app.grants.$id.tsx:28-71,332-349`; `src/routes/_app.assignments.tsx:27-64`
- **Viewport, route, or state:** Detail load error, partial query failure, simultaneous reviewer edit, save retry
- **Observed problem:** Secondary query errors are ignored in places, making failed data loads look empty. Score forms initialize from fetched rows once, so a later refetch can leave locally displayed values stale. Assignments administration also defaults failed queries to empty lists.
- **Evidence:** `data ?? []` without error checks and state initializers from `mine`/`scores` in cited code.
- **Exact recommended change:** Specify loading, empty, unauthorized, partial-error, unsaved, saved, and conflict states in one shared review-state contract; surface query failures and preserve deliberate edits until a controlled refresh.
- **Reason:** Empty, stale, and unauthorized information require different recovery actions.
- **Expected outcome:** Reviewers can distinguish missing data from a failed load and know whether edits were saved.
- **Verification method:** Force query failures and remote changes during editing in both workspaces; verify messaging, focus, and retained draft values.

### A7 — Shared shell and reporting use different program vocabularies

- **Severity:** medium
- **Element or file:** `src/components/AppShell.tsx:29-45,188-252`; `src/routes/_app.index.tsx:85-174,176-262`; `src/routes/_app.top.tsx:13-100`; `src/routes/_app.grant-rankings.tsx:10-102`
- **Viewport, route, or state:** Mobile navigation, dashboard, scoring summary/rankings
- **Observed problem:** Mobile navigation includes only the program's primary array, omitting shared Users & Access and Reviewer Assignments links. Scholarship reports a fixed combined score and separate selection statuses; grant reports an average and assignment-relative review status. Generic labels such as progress/rank can obscure those units.
- **Evidence:** Desktop-only shared admin links; distinct dashboard and ranking calculations/routes.
- **Exact recommended change:** Add shared task navigation and metric labels only after defining role-specific IA and score-unit contracts. Preserve each program's selection and scoring semantics in the copy and data adapter.
- **Reason:** Administrators need complete mobile task access and unambiguous decision-support numbers.
- **Expected outcome:** Same authorized tasks are reachable at mobile widths, and displayed metrics state their denominator and completion rule.
- **Verification method:** Check 375/390/768/1024/1440px with admin/reviewer/viewer accounts; compare displayed values with source rows.

## 8. Preserve / Improve / Restructure / Replace

| Area | Classification | Boundary and rationale | Dependency/risk |
|---|---|---|---|
| TanStack Start routes, React stack, Cloudflare deployment, Supabase auth/RLS | **Preserve** | Native architecture and production authorization model. | Validate deployed migrations and accounts before release. |
| Legacy Scholarship `applicants`/`reviews`, fixed 0–9 + 0–9 rubric, five-reviewer sum, screening/selection | **Preserve** | Active business/data meaning, including historical records. | Any schema consolidation needs explicit migration/reconciliation. |
| Grant criteria, typed application content, score rows, average ranking | **Preserve** | Program-specific content and dynamic rubric. | Committee rubric and revision policy are external decisions. |
| Loading/error/unsaved feedback, metric labels, mobile admin access | **Improve** | UI/state clarity without changing database meaning. | Role and responsive QA. |
| Queue/workspace progress, permission presentation, save-state contracts, assignment monitor | **Restructure** | Share mechanics through adapters; keep content and scoring calculators separate. | A1–A6 and RLS role matrix must be resolved first. |
| Existing score persistence or schema | **No replace recommendation** | No evidence justifies replacing either production record model in this audit. | Future migration needs data audit and approval. |

## 9. Safe unification recommendation

Use one review workflow contract with program-specific adapters. A shared `ReviewQueue` owns search/filter presentation, assignment-aware entry, empty/error states, and return navigation. A shared `ReviewWorkspace` owns task hierarchy, document area placement, draft/submit affordances, progress, unsaved/error states, and accessibility behavior. A shared `ReviewProgress` describes assigned, drafted, submitted, and remaining work with an explicit denominator. A shared `ReviewPermission` derives UI capabilities, while Supabase RLS remains authoritative. A shared `ReviewSubmission` contract defines validation, retries, timestamps, and completion semantics; it should **not** be bound to a common write implementation until both persistence models and revision rules are verified.

Adapters remain program-owned: `ScholarshipReviewAdapter` reads/writes legacy applicants and reviews, calculates completed-only sum out of 90 and five-reviewer completion, and exposes scholarship notes/contact/discussion documents. `GrantReviewAdapter` reads/writes portal applications, grant detail, rubric criteria, program reviews and scores, calculates per-review total and application average, and exposes typed/external documents. Shared components receive explicit score unit, maximum, completion rule, allowed actions, and status labels from the adapter. Do not reinterpret Scholarship `total_score` as grant `average_score`, infer grant eligibility from Scholarship screening, or turn program configuration into hard-coded criteria.

## 10. Proposed sequence and regression gates

1. **Establish live baseline read-only:** inventory deployed migration versions, policy definitions, row counts, existing duplicate legacy reviews, unlinked applicants, assignment counts, and program membership distribution in a safe environment. Confirm committee rules for eligibility revocation, review revision/finalization, reviewer count, and grant rubric. Use no production mutation for discovery.
2. **Build role/workflow fixtures:** global/program admin, reviewer, viewer, no access, cross-program user; scholarship eligible/ineligible and grant assigned/unassigned applications; no/draft/completed reviews; valid/missing/external/private documents. Run direct RLS reads/writes and storage checks. Extend the current SQL test, which presently tests only structural invariants.
3. **Specify contracts and IA:** document normalized task states, status/score units, effective capabilities, mobile navigation, failure/retry behavior, and program adapters. Resolve A1–A5 before an implementation-ready screen specification or material redesign.
4. **Refactor read-only mechanics first:** shared queue/progress display and permission presentation, with snapshot comparisons against both existing workflows. Preserve route paths and write code until the read model is proven.
5. **Plan writes as a separately approved migration:** inspect duplicate Scholarship reviews and all historical scores; decide submitted-review revision rules; design idempotent transactional writes and any legacy-to-shared mapping with rollback. Do not dual-write or backfill on inference.
6. **Regression gates for any later implementation:** Scholarship screening and automatic assignment; Scholarship fixed score sum/status; grant criterion bounds, total/average/ranking; own versus peer scores; save/submit/retry; admin monitoring; import reruns preserving reviews/assignments; private storage and external link access; keyboard and 375–1440px task completion. Distinguish local passing checks from migrated test/production verification.

No visual direction or navigation change is selected by this audit. The application-redesign implementation gate remains closed pending the business decisions, live authorization checks, and implementation-ready screen specification above.
