import { Link } from "@tanstack/react-router";
export function TestingHelpContent() {
  return (
    <div className="space-y-4">
      <p>
        Testing is the practice control center. Reviewer Assignments chooses who reviews an existing
        application.
      </p>
      <ol className="list-decimal space-y-4 pl-5">
        <li>
          <strong className="text-foreground">What is a practice application?</strong>
          <p>
            A fictional application marked TEST. Use it to practice reading evidence, entering
            scores, saving drafts and submitting reviews.
          </p>
        </li>
        <li>
          <strong className="text-foreground">Does testing affect real applications?</strong>
          <p>
            Practice scores are excluded from real rankings, program totals, reports and award
            decisions. Testing does not give anyone extra access.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How do I create one?</strong>
          <p>
            Administrators open Testing, choose an active program they manage, then select Create
            Practice Application. Start Guided Test walks through the steps. Open the new
            application and complete normal screening; creation does not approve eligibility.
            Scholarship screening requires a global administrator; the sample uses the editable 2027
            cycle.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How do I assign a reviewer?</strong>
          <p>
            Select Assign Reviewers beside a practice application. Reviewer Assignments opens with
            Test Applications and that application selected. Choose an authorized reviewer and
            select Assign Reviewer. The guided test can do the same assignment. Scholarship
            screening may already assign the program’s reviewers; existing assignments are reused.
          </p>
        </li>
        <li>
          <strong className="text-foreground">Where does the reviewer find the test?</strong>
          <p>
            The assigned reviewer signs in to their own account, selects the matching program, and
            opens their Review Queue. Administrators can choose All Applications or Test
            Applications to see tests. Look for TEST. Do not sign in as someone else.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How does the reviewer complete it?</strong>
          <p>
            Open the application, read the information and documents, enter the normal rubric scores
            and comments, save a draft, then Submit Review. Complete any program-specific conflict
            declaration and reviewer certification. Normal eligibility and permission rules still
            apply.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How do I know testing finished?</strong>
          <p>
            Testing lists each reviewer’s progress and completed count. Select Continue Guided Test
            and Refresh Progress to check the selected reviewer. Testing Complete appears only when
            their normal saved review is completed; a saved draft is not a submitted review. The
            optional checklist separates observed progress from checks you make yourself.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How do I reset it?</strong>
          <p>
            Select Reset Test and confirm. This clears review progress, scores, comments and
            conflict declarations/reports. The application, screening decision and assignments
            remain. Inactive assignments stay inactive. Reviewers must declare clearance again where
            required. Group practice reset is different: it archives the previous round and creates
            40 fresh applications.
          </p>
        </li>
        <li>
          <strong className="text-foreground">How do I delete it?</strong>
          <p>
            Select Delete Test and confirm. This permanently removes the fictional application and
            its test review activity. Remove uploaded discussion or supporting files through the
            document controls first; deletion stops if uploads remain. Real applications cannot be
            deleted by Testing.
          </p>
        </li>
        <li>
          <strong className="text-foreground">What if something does not work?</strong>
          <p>
            Check the program, screening decision, reviewer access and active assignment. Retry a
            failed load and refresh progress after submission. If the issue persists, tell your
            administrator which step failed, what you expected, what happened and the exact error
            message. Do not include passwords or real applicant information.
          </p>
        </li>
      </ol>
      <Link to="/testing" className="inline-flex min-h-11 items-center font-medium underline">
        Open Testing (administrators)
      </Link>
    </div>
  );
}
