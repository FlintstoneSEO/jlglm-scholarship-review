# Growth Grant cohort implementation proposal

Date: 2026-10-05. Status: proposal for review; no application, database, assignment, invitation, or deployment changes made.

## Authorization update: 2026-10-05

The user separately authorized local implementation and testing of increment 1, including additive migration files. [Implementation and verification record](growth-grant-committee-increment.md). The original proposal remains historical context. Real account identity confirmation, conflict resolution/replacement and production release remain pending; no invitation/email/live assignment action is authorized.

## Source and requested outcome

Prince Jerold Solace's email, **Growth Grant Portal**, from info@justiceleagueglm.org, October 5, 2026 at 3:46 p.m. Eastern: [source email](https://mail.google.com/mail/u/?authuser=wendellswa06%40gmail.com#all/1a10d9acfdf6e33f).

Prince reports 40 applications and requests preliminary screening against six requirements, three randomly allocated reviewer pairs, conflict disclosure, and a chance to test the portal before inviting the committee. The email count is not a verified database count.

| Committee | Members as written in the email |
| --- | --- |
| Group 1 | Tony Willis and Willye Bryan |
| Group 2 | Sean Holland and Prince Solace |
| Group 3 | Betty Sanford and Courney Minor |

Confirm reviewer email addresses and the spelling of Courney Minor before matching or inviting accounts. Names alone must not establish account identity.

## Current code baseline

The repository is a React/TanStack Start portal with Supabase, existing shared review primitives, and Vercel configuration. README is current context; the earlier architecture audit describes an obsolete pre-multi-program baseline and Cloudflare deployment. `vite.config.ts` and `vercel.json` identify the current Vercel target. The working tree was clean at the start of this review.

| Request | Existing implementation | Proposed increment |
| --- | --- | --- |
| Six preliminary requirements | `src/lib/grant-overview.ts`, `GrantOverview`, and `20260927232459_grant_eligibility_screening.sql` already model these six checks. | Make missing information easier to triage; retain human verification. |
| Paired review | `src/routes/_app.assignments.tsx` assigns individuals; two assignments can already attach two reviewers to one application. | An admin preview and atomic paired allocation operation, retaining individual reviews. |
| Conflict statement | `src/lib/grant-review-certification.ts` includes disclosure; the Grant rubric requires certification at submission. | An earlier, application-specific disclosure and resolution path. No dedicated conflict-report workflow was found in the inspected routes/components/libraries. |
| Reviewer access | `invite-user.server.ts`, `invite-user-workflow.ts`, `accept-invite`, and account-setup migration support invitations and password setup. | Verify delivery and onboarding, then invite confirmed accounts using existing roles. |
| Progress | Existing assignment/review projections and admin monitoring. | Show pair membership and two expected independent reviews per allocated application. |

These are source-code findings, not proof of deployment, live permissions, SMTP delivery, current application counts, or reviewer usability. No runtime tests were run for this documentation-only proposal.

## Recommended approach and alternatives

Start with the existing human screening workflow, then add paired allocation and conflict handling. Structured checks can flag absent answers and missing document links with their source fields; those flags are triage information only. A linked document is not proof of accessibility, correct year, completeness, or current LARA standing.

For only 40 applications, using the existing checklist and manually assigning both people is the quickest operational fallback, but it lacks a reusable allocation preview and structured recusal history. An AI-assisted document extraction service would require approved document handling, authorized file access, source citations, and evaluation against human review; its cost and complexity are not justified before the existing workflow is tested. Keep it a later optional phase.

AI must not infer race or ancestry from names, images, or writing, decide eligibility, disqualify applicants, produce competitive scores, or choose awards. Display submitted self-identification for authorized human review. No applicant financial documents should be sent to a new external service through this proposal.

## Proposed workflow and screen specification

1. **Admin screening:** import/reconcile the actual applications, filter the existing queue by eligibility, open each Overview, inspect source answers and documents, verify each requirement, then record Eligible, Needs clarification, or Ineligible. Reuse the existing reason requirements and scoring gate. Prince must have authorized Grant admin access to do this; the current model has no separate screener role.
2. **Allocation preview:** extend the current Reviewer Assignments route using the existing shell, typography, form controls, and progress primitives. Select three pairs by confirmed account ID. Default the allocation pool to confirmed Eligible applications. Display pool count, proposed group sizes, two reviewers per application, existing activity, and exclusions before an explicit Apply action.
3. **Randomization:** shuffle the frozen eligible pool once with an unbiased shuffle, then distribute it as evenly as possible. Persist the preview identity, resulting allocation, actor, time, roster, and pool snapshot. Reopening the preview must show the same allocation; reshuffling is explicit and invalidates the prior preview. Randomization distributes work but does not establish absence of conflicts.
4. **Application conflict action:** make the approved conflict statement visible from the assigned queue/workspace and add Report a conflict before scoring. An individual report records the affected application, reviewer, reason, and time. A server-enforced hold prevents that reviewer from saving/submitting competitive work while resolution is pending. The administrator sees a separate resolution queue; reasons are not exposed to unrelated reviewers. Preserve review drafts and submitted scores. Do not silently broaden application access.
5. **Resolution:** an admin records the resolution and approved replacement. Before any review activity, moving an application to another pair is straightforward. Once activity exists, do not delete or change assignment identities. Decide whether to retain the unaffected reviewer or move both members, and how excluded historical scores affect totals, before implementing that transition.
6. **Independent review:** both members read the same application and submit their own scores/comments using the existing rubric and canonical review write adapter. Pairing must not expose the partner's scores or create a joint score. Monitor 0/2, 1/2, and 2/2 active completed reviews without changing score aggregation or award logic.

Preserve current navigation; this proposal adds controls inside existing routes. On small screens, use a vertical preview list showing application, pair, and warnings together, with a visible Apply action after the summary. Avoid horizontal tables and nested scrolling. Use native labeled controls, keyboard-accessible dialogs, visible focus, and announced success/error messages.

Required states: loading, no confirmed eligible applications, incomplete roster, duplicate reviewer within/across pairs, unauthorized user, stale preview, existing assignments/activity, conflict reported, resolution pending, resolved, saving, failure, and success. A failure or stale preview must create no partial assignments and retain the preview for correction.

## Data, authorization, and migration implications

- Preserve `portal_applications`, program memberships, `reviewer_assignments`, individual `program_reviews`, `review_scores`, existing rubric versions, submission certification, drafts, and scoring/award semantics. Preserve Scholarship workflows.
- Reuse shared queue/workspace/progress and review write primitives. Grant-specific eligibility content and this committee roster remain program configuration. Do not build a parallel Grant review engine or hard-code the six named people into components.
- Pair metadata and allocation audit records can be additive and program-scoped. A pair is a grouping of individual assignments, not a new score owner or authorization role. Validate program membership and active assignment lifecycle at the server/database boundary.
- Apply allocation in one authorized transaction with an idempotency key, expected preview version, and duplicate guards. Revalidate the pool, membership, eligibility, and existing activity at commit. Existing browser assignment inserts are insufficient to guarantee all-or-nothing paired allocation.
- Additive conflict events and holds require explicit schema, RLS, submission, and lifecycle design. Inspect all direct and canonical score-write paths; a disabled button alone is insufficient. Existing active/suspended assignment lifecycle is a possible primitive, but confirm Grant compatibility before reusing it for recusal.
- `program_reviews` references assignment identity with restrictive foreign keys. The assignments page prevents removal once review activity exists. A recusal must preserve that history. Do not use the admin test-data reset to clear a real conflict.
- Prince's Grant admin access permits broader application visibility and administrative score access. His assigned competitive queue can remain limited to Group 2, but the system cannot honestly promise that an administrator sees only those applications. A separate screener role or stricter score isolation is a separate authorization decision.
- Before a conflict changes completion/rankings, document whether historical reviews are excluded, who approves that action, and how aggregates are recalculated. No aggregation migration is authorized by this proposal.

## Decisions needed

- **Allocation count:** three groups of 13 cover 39 applications. Recommend 14/13/13 if all 40 pass screening; otherwise balance the actual eligible count. Confirm whether the intended pool is all submissions or only eligible applications, and account visibly for every excluded/pending record.
- **Conflict policy:** confirm the statement wording, who resolves reports, and whether a conflict causes reassignment of one reviewer or the whole pair. Confirm treatment of any reviews already started/submitted.
- **Eligibility policy:** the six category labels already exist, but the email does not define full business eligibility, acceptable ownership evidence, every required document, or treatment of a missing financial year. Use the committee-approved requirements; do not invent rules or relax checks.
- **Accounts:** confirm all six email addresses, current account matches, Group 3 spelling, and Prince's screening role. Existing users retain their credentials; new users receive individual invitations and set their own passwords.

## Implementation sequence and acceptance

**Step 1 — Existing-workflow walkthrough:** verify Prince's access and use a separate test environment with synthetic applications for onboarding, screening, documents, drafts, and submission. Test invitation and password-reset delivery with authorized recipients before committee rollout. Grant program admins may invite global viewers with program reviewer access; global role and program role are separate concepts.

**Step 2 — Scoped proposal approval:** record approved pool/count, pairing, conflict policy, role boundaries, and completed-review treatment. This is a new functional/data implementation phase; existing Phase E visual authorization does not authorize these migrations or Phase F. Resolve only decisions on which this increment depends.

**Step 3 — Paired allocation:** add roster/preview UI, pure allocation logic, additive audit metadata, and transactional commit. Acceptance: every selected application appears exactly once in the preview and receives exactly two distinct authorized reviewer assignments; balanced totals; no partial writes on failure; retries create no duplicates; existing work is preserved.

**Step 4 — Conflicts:** add the approved statement, report action, server-enforced hold, admin resolution, and history. Acceptance: conflicted reviewers cannot save/submit through UI or direct writes; unrelated reviewers cannot see reports; resolution preserves historical work and grants only intended replacement access; aggregation follows the separately approved policy.

**Step 5 — Pilot and release verification:** confirm distinct reviewer sessions cannot open unassigned applications or one another's private scores; admin screening is allowed and reviewer screening mutations denied; missing eligibility keeps scoring locked; both independent submissions reach 2/2. Test links, invitation acceptance, password recovery, drafts, repeat submission, errors, keyboard navigation, and 320/375/390/768/1024/1440px rendering. Run relevant pure tests, TypeScript, scoped lint, production build, rollback-only database authorization/lifecycle tests, and Scholarship regressions. Apply migrations and deploy only through the separately authorized release process. Report PASS / FAIL / NEEDS MANUAL VALIDATION separately for local, database, deployed browser, and email-delivery evidence.

## Actionable findings

| Severity | Element/file | Route/state | Observed problem | Evidence | Exact recommended change | Reason | Expected outcome | Verification method |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| High | Email allocation specification | Allocation planning | 40 reported applications versus 39 requested slots. | Source email states 40 and three groups of 13. | Confirm pool after screening; propose 14/13/13 for 40 eligible. | Prevent an omitted application. | Every pool member accounted for. | Preview coverage and group-count assertions. |
| Medium | `_app.assignments.tsx` | Admin allocation | Individual assignment UI has no paired random preview/commit. | `assign()` inserts one assignment at a time. | Add preview plus transactional, idempotent paired commit. | Avoid partial pairs and repeated manual work. | Two assignments per selected application. | Atomic failure, retry, balance, membership, and access tests. |
| High | `grant-review-certification.ts` / Grant workspace | Before scoring | Conflict language appears at final certification; no dedicated report/hold/resolution path found. | Certification text and inspected Grant route/help. | Add early disclosure, persisted report, server hold, and admin resolution. | Surface conflicts before competitive review. | Conflicts visibly resolved without deleting review history. | Reviewer/admin browser journeys and direct-write rejection tests. |
| High | Current program access model | Prince as screener and Group 2 reviewer | Admin visibility exceeds an ordinary assigned-reviewer queue. | Program/application access predicates and admin-only screening RPCs. | Confirm dual-role expectations and retain truthful access labeling. | Avoid promising privacy the role cannot provide. | Explicitly understood role boundaries. | Separate admin/reviewer RLS and browser checks. |
| Medium | Grant requirement evidence | Screening | Answer/link presence cannot establish verified eligibility. | `grant-overview.ts` labels human verification and document presence separately. | Keep automated flags advisory and require existing human confirmation. | Avoid treating missing/inaccessible evidence as an automatic rejection. | Traceable screening decisions. | Missing/linked/wrong-year evidence fixtures and confirmation-gate tests. |
