import { TestingHelpContent } from "./TestingHelpContent";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BookOpen,
  BriefcaseBusiness,
  ClipboardCheck,
  FileCheck2,
  HelpCircle,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck,
  SlidersHorizontal,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { grantFundingBands } from "@/lib/grant-funding-recommendation";
import { grantRubricGuidance } from "@/lib/grant-rubric-guidance";
import { grantCertificationExpectations } from "@/lib/grant-review-certification";
import { HelpSection } from "./HelpSection";

const grantSections = [
  { id: "welcome", label: "Welcome" },
  { id: "roles", label: "Roles & Access" },
  { id: "dashboard", label: "Dashboard" },
  { id: "applications", label: "Applications" },
  { id: "eligibility", label: "Eligibility & Compliance" },
  { id: "reviewing", label: "Reviewing" },
  { id: "rubric", label: "Rubric Scoring" },
  { id: "funding", label: "Funding Recommendation" },
  { id: "certification", label: "Reviewer Certification" },
  { id: "rankings", label: "Rankings" },
  { id: "import", label: "Import Data" },
  { id: "testing", label: "Testing the Review Portal" },
  { id: "rule", label: "Important Rule" },
] as const;

const eligibilityRequirements = [
  "Black/African American business owner eligibility",
  "Business eligibility",
  "LARA registration and good standing",
  "Required documentation",
  "2024 P&L",
  "2025 P&L",
] as const;

export function BusinessGrowthGrantHelpGuide({ programName }: { programName: string }) {
  const maximum = grantRubricGuidance.reduce((total, criterion) => total + criterion.maximum, 0);
  return (
    <div className="max-w-4xl min-w-0 space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-warning">
          {programName}
        </p>
        <h1 className="mt-1 font-display text-3xl md:text-4xl">Help &amp; Guide</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Guidance for reviewing Business Growth Grant applications. Return here from the sidebar at
          any time.
        </p>
      </header>

      <nav aria-label="Guide sections">
        <Card className="rounded-xl border-border/60 bg-secondary/30 p-4">
          <div className="flex flex-wrap gap-2">
            {grantSections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex min-h-11 max-w-full items-center rounded-full border border-border bg-background px-3 py-1.5 text-xs leading-tight hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {section.label}
              </a>
            ))}
          </div>
        </Card>
      </nav>

      <HelpSection id="welcome" icon={BookOpen} title="Welcome">
        <p>
          The Justice League of Greater Lansing reviews Business Growth Grant applications in one
          shared portal. Eligibility screening comes before competitive scoring. Assigned reviewers
          use the approved 100-point rubric, and the portal calculates a score-based funding
          recommendation. Rankings support committee discussion; the portal does not select
          recipients automatically.
        </p>
      </HelpSection>

      <HelpSection id="roles" icon={ShieldCheck} title="Roles &amp; access">
        <ul className="space-y-3">
          <li>
            <Badge className="mr-2 bg-primary text-primary-foreground">Admin</Badge>
            Program administrators can manage permitted program access and reviewer assignments,
            verify eligibility, manage rubric versions, inspect rankings, and record an audited
            scoring exception when program rules allow it.
          </li>
          <li>
            <Badge className="mr-2" variant="outline">
              Reviewer
            </Badge>
            Assigned reviewers can read applications and documents, score once eligibility permits
            it, save drafts, certify their review, and submit it.
          </li>
          <li>
            <Badge className="mr-2" variant="secondary">
              Viewer
            </Badge>
            Viewers have read-only access within their program permissions.
          </li>
        </ul>
        <p>Available actions depend on your account role, program access, and assignment.</p>
      </HelpSection>

      <HelpSection id="dashboard" icon={LayoutDashboard} title="Dashboard">
        <p>
          The review dashboard shows application totals by Not started, In progress, and Completed
          review status. Its recent submissions list opens application workspaces. Use Open review
          queue to see the full Applications list. Counts reflect the currently available program
          data.
        </p>
      </HelpSection>

      <HelpSection id="applications" icon={BriefcaseBusiness} title="Applications">
        <p>
          The Applications queue shows each business and applicant, competitive review status, and
          eligibility status. Search by business, applicant, or email. Filter by review state, LARA
          response, operating model, or business age; additional filters are under More filters on
          small screens. Open an application to review its responses and documents. Assignment and
          review progress appear in the workspace.
        </p>
      </HelpSection>

      <HelpSection id="eligibility" icon={FileCheck2} title="Eligibility &amp; compliance">
        <p>
          Eligibility is a human-verified pass/fail screening step, separate from the 100-point
          competitive score. The Overview presents six requirements:
        </p>
        <ol className="list-decimal space-y-1 pl-5">
          {eligibilityRequirements.map((requirement) => (
            <li key={requirement}>{requirement}</li>
          ))}
        </ol>
        <p>
          The overall status can be Not reviewed, Eligible, Needs Clarification, or Ineligible.
          Source answers and document presence are evidence to inspect; they do not automatically
          establish verified eligibility. Competitive scoring stays locked until eligibility allows
          it. Authorized administrators can permit scoring through an audited exception when program
          rules allow.
        </p>
      </HelpSection>

      <HelpSection id="reviewing" icon={ClipboardCheck} title="Reviewing an application">
        <p>The Grant workspace has four current views:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">Overview</strong> — Business at a glance,
            Eligibility &amp; compliance, and review progress.
          </li>
          <li>
            <strong className="text-foreground">Application</strong> — imported Grant responses,
            with rubric-scored sections and expandable criterion guidance.
          </li>
          <li>
            <strong className="text-foreground">Documents</strong> — supporting files, including
            available LARA documentation and 2024 and 2025 Profit &amp; Loss statements.
          </li>
          <li>
            <strong className="text-foreground">Rubric</strong> — seven scores, current total,
            recommendation, reviewer comments, certification, and save or submit actions.
          </li>
        </ul>
        <p>
          Application sections such as Business &amp; Market, Financial Health, Growth Opportunity,
          Use of Funds, Expected Impact, Business Capacity, and Why This Grant connect to their
          rubric criteria. You may score while reading; the Application and Rubric views share the
          same score state. Internal reviewer comments are entered in Rubric.
        </p>
      </HelpSection>

      <HelpSection id="rubric" icon={SlidersHorizontal} title="Rubric scoring">
        <p>
          Score the seven active competitive criteria independently, for {maximum} points total:
        </p>
        <ol className="space-y-2">
          {grantRubricGuidance.map((criterion, index) => (
            <li
              key={criterion.name}
              className="flex min-w-0 justify-between gap-3 border-b border-border/60 pb-2 last:border-0"
            >
              <span className="min-w-0 break-words">
                <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                {criterion.name}
              </span>
              <strong className="shrink-0 text-foreground">{criterion.maximum} points</strong>
            </li>
          ))}
        </ol>
        <p>
          Expand scoring guidance for each criterion. An intentional zero is a valid score; unscored
          is different from zero. Save Draft can preserve an incomplete review. To submit, every
          active criterion needs a valid score.
        </p>
        <Card className="border-primary/30 bg-primary/5 p-4">
          <p className="font-semibold text-foreground">Save Draft versus Submit Review</p>
          <p className="mt-2">
            Save Draft preserves current scores and comments without finalizing the review. Submit
            Review requires scoring permission, all seven valid scores, an available calculated
            recommendation, and reviewer certification. A submitted review becomes read-only until
            an authorized administrator reopens it.
          </p>
        </Card>
      </HelpSection>

      <HelpSection id="funding" icon={ListOrdered} title="Funding recommendation">
        <p>
          The portal calculates the recommendation from a completed 100-point score. Reviewers do
          not select it manually. Until scoring is complete, the recommendation is pending.
        </p>
        <ul className="space-y-2">
          {grantFundingBands.map((band) => (
            <li
              key={band.rangeLabel}
              className="grid gap-1 border-b border-border/60 pb-2 last:border-0 sm:grid-cols-[5rem_1fr]"
            >
              <strong className="text-foreground">{band.rangeLabel}</strong>
              <span>
                {band.tier} — {band.recommendation}
                {band.guidance ? ` · ${band.guidance}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <p>
          A funding recommendation supports committee decisions; it does not select a recipient.
        </p>
      </HelpSection>

      <HelpSection id="certification" icon={ShieldCheck} title="Reviewer certification">
        <p>Before Submit Review, reviewers confirm all six expectations:</p>
        <ul className="list-disc space-y-1 pl-5">
          {grantCertificationExpectations.map((expectation) => (
            <li key={expectation}>{expectation}</li>
          ))}
        </ul>
        <p>
          One final certification checkbox is required. Changing scores or comments after
          certification requires certification again. A reopened review also needs new certification
          before resubmission. Potential conflicts must be disclosed according to program policy.
        </p>
      </HelpSection>

      <HelpSection id="rankings" icon={Trophy} title="Rankings / decision support">
        <p>
          Decision Support Only. Authorized administrators use Rankings to compare completed
          reviews. The screen shows completed versus assigned review counts, average score, score
          range, average tier, and eligibility context. Only completed reviews contribute to the
          displayed average. An application with outstanding active reviews remains Pending and
          receives no final numeric rank, even if its current average is high. Ties may occur.
          Rankings do not determine recipients.
        </p>
      </HelpSection>

      <HelpSection id="import" icon={Upload} title="Import / data administration">
        <p>
          A Business Growth Grant program administrator can export Form Responses 1 from Google
          Sheets as CSV, upload it on Import Business Growth Grants, and review the validation
          preview before importing valid rows. The importer identifies an existing application by
          program and external submission ID. Re-importing updates source-owned application answers
          and document links while keeping reviews and assignments. The result reports new, updated,
          and failed rows for follow-up.
        </p>
      </HelpSection>

      <HelpSection id="testing" icon={ClipboardCheck} title="Testing the Review Portal">
        <TestingHelpContent />
      </HelpSection>

      <HelpSection id="rule" icon={AlertTriangle} title="Important rule">
        <Card className="border-gold/40 bg-gold/10 p-4">
          <p className="font-medium text-foreground">
            The portal does not select Business Growth Grant recipients automatically.
          </p>
          <p className="mt-2">
            Eligibility screening, rubric scores, funding recommendations, rankings, and
            missing-document indicators support decisions. Final funding decisions remain with the
            authorized Justice League committee.
          </p>
        </Card>
      </HelpSection>

      <Card className="rounded-xl border-border/60 p-6 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Need more help?
        </div>
        <p className="mt-2 text-muted-foreground">
          Reach out to your program administrator or committee lead. Return to the{" "}
          <Link
            to="/help"
            className="text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Help &amp; Guide
          </Link>{" "}
          from the sidebar at any time.
        </p>
      </Card>
    </div>
  );
}
