# Test Applications

Test applications are fictional records for rehearsing assignments, reading evidence, scoring, saving drafts and submitting reviews. They use the same review screens, rubric and permissions as real applications. They never affect real rankings, award recommendations, application totals, completion statistics or reporting/export scopes.

## Create and assign

1. Open **Testing** in the administrator navigation.
2. Choose an active program you administer, then **Create Test Application**.
3. Read the fictional sample description and select **Generate and Create**. No actual applicant information is copied.
4. Select **Open Test Application** to complete the normal screening process. Scholarship screening still requires a global administrator; its fictional sample uses the editable 2027 cycle because the 2026 cycle is locked. Grant administrators verify the six normal eligibility checks. Creation does not automatically approve eligibility.
5. Choose **Assign reviewers now / View Assignments**, or **Create without assignment**. The assignment page opens its Test Applications filter. Choose the test application and an existing authorized reviewer, then Assign; repeat as needed. Scholarship eligibility confirmation still automatically assigns the program's reviewers, exactly as it does for real applications. Inactive assignments retain their normal restrictions.

Reviewers sign into their own accounts, find an assigned **TEST APPLICATION** in their normal queue, open evidence, score the normal rubric, add comments, save a draft and submit. Grant reviewers still declare no known conflict and complete final certification. Test mode grants no additional access and creates no accounts.

## Run the same test again

In Testing, select **Reset Test Review** and confirm. This clears that application's review scores, comments/notes, submitted reviews, certifications, draft request history and conflict declarations/reports. The fictional application, screening decision and assignments remain. Reviewers declare clearance again where required. Suspended and administratively deactivated assignments remain suspended, preserving assignment history; a reset does not reactivate them.

Existing Grant practice runs remain available on Reviewer Assignments. Their **Reset Practice Run** archives a round and creates 40 fresh samples; it is different from resetting one application's review progress. All practice-run records are now marked TEST and stay excluded from real results, including archived rounds.

## Remove test data

Select **Delete** in Testing and confirm. The database removes only the selected test and its related assignments, reviews, scores, notes, contact logs, eligibility data and document references in one transaction. Real applications cannot be reset or deleted by these Testing actions. A minimal operation log remains without scores, comments or fictional applicant content.

If reviewers uploaded discussion copies or private supporting files, remove those files through the existing document controls first. Deletion refuses to proceed while uploads remain, avoiding orphaned private objects. No partial database deletion occurs on failure.

## Real applications and Google Sheets

Admin application lists and assignment management default to **Real Applications**. Use **Test Applications** or **All Applications** deliberately. A TEST badge and workspace banner distinguish fictional records; color alone is never the indication. Scores shown inside a test workspace describe that test, not real program results.

Test records originate inside the portal. They have no Google Sheets source identity and cannot be matched/relabelled by production imports. Reporting uses scopes that exclude tests before calculating results. This checkout currently offers Google Sheets CSV import; it has no visible connection-test action or outbound Sheets export. If a connection action is added/restored, its visible wording should be **Verify Google Sheets Connection**. Connection verification checks connectivity and never creates sample applications.

## Release and verification

Migration `20261006145039_test_applications.sql` was applied to the linked hosted project on 2026-10-06 with explicit authorization. Run the updated frontend locally or deploy it separately before using Testing. Authenticated provider and real-account workflow validation remains pending. See [audit and preservation boundaries](test-applications-audit.md) and [verification evidence](test-applications-verification.md).
