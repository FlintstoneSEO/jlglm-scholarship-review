# Applicant decision emails — proposed implementation

Date: 2026-11-07
Status: user approved the design on November 7; implemented and verified locally. No hosted migration, deployment, or applicant email sends.

## Source and intent

Prince's November 7 thread: https://mail.google.com/mail/u/?authuser=wendellswa06%40gmail.com#all/1a1b684177460fc9
Read both messages and extracted the full text from both attached DOCX letters. Prince names Zoe Life Spa & Salon and Cravings Gourmet popcorn as recipients. He requests owner-addressed letter text in the email body, storage of both letters in the portal, and no use of “denial” anywhere in applicant email. He will call recipients and follow up by email.

The user requests program-admin sending from info@justiceleagueglm.org, with an application-decision email allowed only after all required reviews for that application are complete OR an administrator explicitly records a denial decision. Interpret “still quite a few applications that have been reviewed” as “have not been fully reviewed” from context; no live outstanding count verified.

## Verified existing behavior and preservation boundaries

- src/routes/_app.grant-rankings.tsx already contains Finalists & recipients and separately displays saved recipient status. Live saved recipient identities have not been queried.
- src/lib/grant-ranking-summary.ts counts active assignments only. Review completion requires at least one active assignment and all such reviews completed. Rankings additionally require valid 100-point rubric scores and resolved eligibility or an allowed exception. Incomplete applications show pending; current averages are not final ranks. Certifications are separately reported.
- supabase/migrations/20261030200000_grant_selections.sql stores three finalists and two recipients, locks finalized choices, checks program admin authority, and logs revisions. It does not require completed reviews to finalize committee choices. Preserve this distinction.
- The rankings display currently labels absence from selected IDs “Not selected”; this is NOT an explicit applicant denial decision and must never be used as one.
- Scholarship contact templates/logs are in src/lib/applicant-utils.ts and src/routes/_app.applicants.$id.tsx. They are separate from an authenticated delivery service. Do not silently reuse scholarship language or its fixed five-reviewer rule for Grants.
- Existing server invitation code provides an authentication/role-check pattern, but Supabase Auth invitation delivery is not an applicant correspondence service.

Preserve scores, rubric/eligibility rules, reviewer assignments, review certification, final selection locks, authentication, and existing role boundaries. Do not mark reviews complete to permit sending. Scope the first release to Business Growth Grant; keep delivery/audit primitives program-aware for future reuse.

## Recommended workflow

Keep the current app shell and rankings navigation. Add a clear saved-recipient summary and a provisional-ranking explanation when reviews remain outstanding. Suggested text: “Some applications still have outstanding reviews. Rankings include only applications that meet the completed-review and eligibility requirements; committee-selected recipients are shown separately under Finalists & recipients.”

Add a program-admin-only Applicant emails section under Finalists & recipients, with a link from each Grant application:

1. Choose applicant and Application decision or Recipient congratulations.
2. Show owner, business, stored email, decision, completed/required review counts, sender, and previous sending history.
3. Show personalized subject and editable body based on Prince's letter; preserve the source letter as a downloadable private portal resource.
4. Preview the complete email, then explicitly send this applicant's email.
5. Show sending, sent/provider-accepted, failed, or outcome-unknown state. Do not claim delivery from provider acceptance.

Application-decision gate: never a finalized recipient; additionally all active required reviews complete OR a separately recorded explicit Not selected decision by a program admin. For the completion branch, require finalized committee recipients and an explicit confirmation of the applicant's non-selection so completion alone never determines an award outcome. Zero assignments do not count as complete. Record who marked Not selected, when, and why. This decision must not rewrite review or eligibility status.

Recipient gate: applicant must be one of the finalized saved recipients. Require the admin to confirm Prince's phone-contact step is complete before sending. Do not automatically send when selections are saved.

Block missing/invalid email, unknown or stale decision data, unauthorized caller, test/duplicate/archived applications, unresolved placeholders, and duplicate sends. Recheck all gates on the server at send time; UI disabling alone is insufficient.

Use applicant-facing “Application decision” and internal “Not selected.” Never expose “denial,” including in attachment filenames. Default to body text, not an attached denial-named DOCX.

## Delivery and data design

Recommended: server-side authenticated sending through the organization's Google Workspace mailbox, subject to available mailbox authorization. The source email headers indicate Google-hosted mail, but no sending credentials or connected info@ mailbox have been verified. An alternative is a verified transactional email provider sending as info@justiceleagueglm.org; this requires domain configuration and does not inherently populate the mailbox Sent folder. A mailto link cannot provide controlled direct portal delivery or reliable audit history.

Use existing TanStack server functions and current database role checks. Keep provider credentials server-only. Add program-scoped RLS-protected communication records and an explicit non-selection decision/history table through additive migrations. Do not backfill non-selection from existing display labels. Store the exact recipient, subject, body snapshot, template revision, decision revision, actor, timestamps, delivery attempt key, provider ID and safe error status.

Reserve an idempotent send attempt transactionally before contacting the provider. Prevent simultaneous duplicate sends and conflicting decision changes while a send is reserved. On provider timeout, record outcome unknown and reconcile before retry; never blindly resend. Original sources belong in private storage with admin access and safe download names. Existing scholarship tables remain unchanged.

Deployment requires additive migration verification, configured authorized sender, and controlled test-recipient validation before enabling real sends. No production mutations or applicant sends are authorized by this design document.

## Template details

Application-decision subject supplied by Prince: **2026 Business Growth Grant – Application Decision**
Recipient subject proposal (Prince did not specify one): **Congratulations! 2026 Business Growth Grant Recipient**
Personalize the greeting to the stored applicant/owner name. Retain the original source separately. Review duplicated signature names in DOCX extraction when producing HTML rather than assuming they are intentional repeated prose.
The “more than 40 applications,” Fall 2027 reopening, and November 13 event details below are Prince-provided wording, not independently verified portal facts. Preserve source attribution and flag any discrepancy during template approval.

### Source: application decision

Dear Applicant,

Thank you for applying for the 2026 Business Growth Grant offered by the Justice League of Greater Lansing Michigan (JLGLM) through our Entrepreneurship Reparations pillar.
We received more than 40 applications from talented entrepreneurs and outstanding businesses throughout the Greater Lansing area. Due to the competitive nature of the process and limited grant funding, we regret to inform you that your business was not selected as a 2026 grant recipient.
We recognize the time and effort involved in applying and appreciate the opportunity to learn more about your business and its goals.
JLGLM remains committed to supporting African American-owned businesses and expanding access to resources that promote business growth and sustainability. We encourage you to apply again when the Business Growth Grant reopens in Fall 2027.
Here are some resources that may be able to assist you with your small business growth journey:
· Lansing Economic Area Partnership
· Lansing Economic Development Corp
· Small Business Development Center
· Lansing Regional Chamber of Commerce
· Melanated Business Alliance
Thank you for your interest in JLGLM and your continued contributions to the Greater Lansing business community. We wish you success in your continued endeavors.
Yours in the struggle,
Prince Solace, President
Prince Solace
Willye Bryan, Vice President
Willye Bryan

### Source: congratulations

Dear Grant Recipient,

On behalf of the Justice League of Greater Lansing Michigan (JLGLM), congratulations on being selected as a recipient of the 2026 Business Growth Grant!
Your selection recognizes your entrepreneurial vision, dedication, and commitment to business growth. We are proud to invest in your success and support your continued contributions to the Greater Lansing community.
Through our Entrepreneurship Reparations pillar, JLGLM established this grant to help address barriers to capital and expand opportunities for African American-owned businesses. We hope this investment provides meaningful support as you strengthen your operations, expand your capacity, and pursue new opportunities for growth.
We would also like to personally invite you to our 2026 Fall Celebration and Fundraiser on Friday, November 13, at 6:00 p.m. at Michigan State University Federal Credit Union. It would be our honor to publicly recognize and celebrate you as a 2026 Business Growth Grant recipient during this special occasion.
Your success represents the impact of investing in Black-owned businesses and building stronger communities. We look forward to celebrating this achievement with you!
Congratulations once again, and we hope you will join us!

Yours in the struggle,
Prince Solace, President
Prince Solace
Willye Bryan, Vice President
Willye Bryan

## Validation plan

- Unit tests for completed, partial, zero-assignment, superseded/conflicted reviews; explicit non-selection; recipient exclusions; missing email; stale decisions; test/duplicate exclusion.
- Database authorization tests: allowed program admin/global admin under existing policy; rejected reviewer/viewer/other-program admin; protected history and cross-program application IDs.
- Delivery tests with a fake provider: double click/concurrent sends, replay, provider rejection, timeout after acceptance, safe reconciliation.
- Test exact preview-to-send subject/body snapshot and placeholder/denial wording checks.
- Review keyboard/focus, clear blocked reasons, 320px overflow, and 375/390/768/1024/1440 layouts using existing Justice League tokens and Lucide.
- Run repository tests, typecheck, production build and diff check. No code tests run for this design-only change.

## Implementation and migration implications

The approved workflow is implemented on the existing rankings and application detail screens. The existing shell, tokens and native controls are preserved; compact layouts prioritize identity, review progress, the message and its explicit confirmation. Dialogs retain focus management and keyboard dismissal through the existing Radix primitives. The recipient summary now names the two saved recipients directly. A rankings notice explains outstanding reviews. The previous fallback “Not selected” label now reads “Not designated as finalist or recipient,” avoiding confusion with an explicit decision.

The additive migration `20261107152905_applicant_decision_emails.sql` adds decision events, email attempt snapshots and reconciliation events. No existing applications are automatically marked not selected. Existing saved recipients and scores are unchanged. Decision changes and reservations serialize on the program and application; partial unique indexing blocks duplicate active/sent attempts. Recipient finalization now rejects a conflicting explicit non-selection or outstanding/sent decision email. Clear the explicit non-selection before finalization if no email was reserved/sent; sent communications require operational resolution rather than silently rewriting history.

While an email is reserved, sending, or outcome-unknown, sensitive applicant fields and assignment/review changes are blocked until its outcome is reconciled. This intentionally prevents the approved message becoming inconsistent during delivery. A crash leaving a reserved/sending record is treated as uncertain, never as proof of non-delivery. After at least five minutes a program admin may record verified mailbox evidence and classify the outcome; the reconciliation is append-only history. Provider acceptance does not mean inbox delivery. Subsequent bounces are managed in the mailbox; automated bounce tracking is not implemented.

Original DOCX files are preserved byte-for-byte as base64 server assets under `src/lib/letter-sources/`. This replaces the proposed private-storage upload with an authenticated server download: it avoids a separate manual storage deployment for two fixed source documents. Downloads require the same program-admin authorization as the applicant email workspace; originals are not public assets or client-bundle imports. The decision letter downloads with a neutral filename. The email template personalizes the greeting, separates paragraphs and removes duplicated extracted signature names while retaining the original DOCX for comparison.

## Mailbox setup and release

Production supports a mailbox-only test while `APPLICANT_EMAIL_ENABLED=false`. Set `APPLICANT_EMAIL_TEST_RECIPIENT` to an inbox controlled by the tester and configure the three Gmail credentials. After redeploying, a grant administrator can open the email workspace and select **Send mailbox test**. The server uses the configured address and fixed test text. This action checks Gmail delivery without recording an applicant email or changing an application. Verify receipt and the sender address before enabling applicant delivery.

Use a Google OAuth client authorized by **info@justiceleagueglm.org**, with offline access and the `https://www.googleapis.com/auth/gmail.send` scope. This implementation uses the named mailbox in the Gmail API path; another connected personal Gmail account is not a substitute. Store the client ID, secret and refresh token in the hosting provider's server-only secret settings as `APPLICANT_GMAIL_CLIENT_ID`, `APPLICANT_GMAIL_CLIENT_SECRET`, and `APPLICANT_GMAIL_REFRESH_TOKEN`. Never paste credentials into chat or commit them. Existing Supabase authentication SMTP does not configure this feature.

Keep `APPLICANT_EMAIL_ENABLED=false` until migration, deployment and a controlled test-recipient check are complete. Configure the existing `SUPABASE_SERVICE_ROLE_KEY` for atomic delivery claims/status updates. The privileged client cannot rewrite the stored subject, body or recipient through its table grants. Local development has no verified mailbox credentials; no credential or production configuration was changed.

Release sequence:

1. Review/apply the additive migration through the authorized release process; run hosted security advisors and role checks on the target environment.
2. Deploy the matching frontend/server code with sending disabled. Check authenticated admin/reviewer behavior with real accounts.
3. Configure the mailbox credentials securely. Validate a controlled non-applicant recipient in an isolated staging database, including mailbox Sent evidence and reply-to behavior. Production test applications are intentionally excluded from this feature.
4. Enable sending only in the intended environment. Confirm the live recipient IDs correspond to Prince's two named businesses; no IDs were inferred or changed here.
5. Administrators review the exact personalized wording, confirm non-selection or Prince's phone call, and send individually.

Rollback: disable `APPLICANT_EMAIL_ENABLED` first, then revert the application deployment if necessary. Preserve email/decision/reconciliation history and the duplicate-prevention indexes; do not drop them to clear an unknown outcome. Earlier application versions can continue reading existing data, but the new selection-conflict and pending-email guards remain intentional database protections.

Provider references: [Gmail messages.send](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send), [Google OAuth offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline), [Supabase database functions and execution permissions](https://supabase.com/docs/guides/database/functions).

## Verification evidence

- 198 unit tests pass, including template wording, eligibility branches, MIME header-injection prevention, provider rejection versus unknown outcome, concurrent send claims and failed audit persistence.
- All migrations apply in disposable PGlite PostgreSQL with local Auth/Storage stand-ins. `supabase/tests/applicant-emails.mjs` verifies program-role isolation, zero/incomplete/completed reviews, explicit decisions, winner exclusion, stale previews, content validation, duplicate reservations, pending-record guards, reconciliation and RLS. This is not a hosted-provider test.
- Existing database suites pass: grant selection workflow, reviewer certification, group transfers and duplicate management.
- Browser test `supabase/tests/applicant-emails-browser.mjs` passes with fictional data and a local Auth/API stub. It covers incomplete review gating, recording a decision, personalized previews, recipient exclusion, phone confirmation, disabled mailbox state, keyboard interaction, and reviewer exclusion. No provider send occurs.
- Browser overflow checks and screenshots at 320, 375, 390, 768, 1024 and 1440 CSS pixels; axe checks pass for the tested main content. Screenshots are under `supabase/.temp/email-evidence/`; they do not represent live applicant data.
- TypeScript, production build and focused ESLint pass. Build retains existing large-chunk and third-party annotation warnings. Original DOCX base64 and Gmail credential variable names are absent from the generated public client assets.
- Hosted advisors, deployed identity/viewport checks, real mailbox authorization and live delivery verification remain release tasks.

The browser suite additionally verifies that the authenticated original-letter download matches the source DOCX byte-for-byte. It uses a structurally valid synthetic JWT and a local identity stub, not a real Supabase session. Client handling rejects malformed/unauthorized server-action responses instead of treating them as delivery results. The local Supabase advisor command could not connect because no Docker PostgreSQL instance is running on port 54322; the disposable PGlite policy/migration tests passed, and hosted advisor checks remain outstanding.
