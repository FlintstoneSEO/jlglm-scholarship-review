import { TestingHelpContent } from "./TestingHelpContent";
import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HelpSection } from "./HelpSection";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  Trophy,
  Mail,
  Upload,
  ShieldCheck,
  Star,
  ClipboardCheck,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";

const scholarshipSections = [
  { id: "welcome", label: "Welcome" },
  { id: "roles", label: "Roles" },
  { id: "dashboard", label: "Dashboard" },
  { id: "applicants", label: "Applicants" },
  { id: "screening", label: "Preliminary Screening" },
  { id: "reviewing", label: "Reviewing" },
  { id: "top", label: "Scoring Summary" },
  { id: "contact", label: "Contact Center" },
  { id: "access", label: "Reviewer Access" },
  { id: "team", label: "Review Team" },
  { id: "import", label: "Import Data" },
  { id: "testing", label: "Testing the Review Portal" },
  { id: "rule", label: "Important Rule" },
];

export function ScholarshipHelpGuide({ programName }: { programName: string }) {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-warning font-semibold">
          {programName}
        </p>
        <h1 className="font-display text-3xl md:text-4xl mt-1">Help &amp; Guide</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A quick tour of the Scholarship Review Portal. The 2026 Reparations Scholarship cycle is
          locked; practice applications use the editable 2027 cycle. Bookmark this page — you can
          return any time from the sidebar.
        </p>
      </div>

      <Card className="p-4 rounded-xl border-border/60 bg-secondary/30">
        <div className="flex flex-wrap gap-2">
          {scholarshipSections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex min-h-11 items-center text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </Card>

      <HelpSection id="welcome" icon={BookOpen} title="Welcome">
        <p>
          This portal helps the Justice League of Greater Lansing Scholarship Committee review
          applicants for the 2026 Reparations Scholarship together — in one place, with consistent
          scoring and clear records of who needs follow-up.
        </p>
        <p>
          The app summarizes information, calculates scores, and flags missing documents to support
          consistent review. <strong className="text-foreground">It does not pick winners.</strong>{" "}
          The committee makes the final selection.
        </p>
        <Card className="p-4 bg-primary/5 border-primary/30">
          <p className="text-foreground">
            Dear Education Cohort, as you review and prepare your essays, please be mindful of the
            appropriate use of artificial intelligence tools. We recognize AI as a tool for learning
            and development; however, it should support students’ thinking, not replace it.
          </p>
        </Card>
      </HelpSection>

      <HelpSection id="roles" icon={ShieldCheck} title="Roles &amp; permissions">
        <ul className="space-y-2">
          <li>
            <Badge className="mr-2 bg-primary text-primary-foreground">Admin</Badge> Full access —
            import applicants, manage reviewers, mark finalists and selected recipients, edit any
            record.
          </li>
          <li>
            <Badge className="mr-2" variant="outline">
              Reviewer
            </Badge>{" "}
            View applicants, add scores and notes, log contact attempts.
          </li>
          <li>
            <Badge className="mr-2" variant="secondary">
              Viewer
            </Badge>{" "}
            Read-only access to the dashboard and applicant records.
          </li>
        </ul>
        <p className="text-xs">
          Your current role is shown at the bottom of the sidebar. If you need different access,
          contact the committee chair.
        </p>
      </HelpSection>

      <HelpSection id="dashboard" icon={LayoutDashboard} title="Dashboard">
        <p>
          The dashboard shows current real-application totals and review progress. Counts change as
          applications are screened and reviews are submitted. Practice applications are excluded
          from these totals.
        </p>
      </HelpSection>

      <HelpSection id="applicants" icon={Users} title="Applicants list">
        <p>
          The Applicants page lists every submission. Use the search and filters to narrow by
          status, missing documents, or finalist flag. Status badges tell you at a glance where each
          applicant is in the process. Click any row to open the full record.
        </p>
      </HelpSection>

      <HelpSection id="screening" icon={ClipboardCheck} title="Preliminary Screening">
        <p>
          We will conduct an initial review of all applications to ensure submissions meet the
          established eligibility requirements and basic application criteria. This preliminary
          screening process is necessary to maintain fairness, uphold program standards, and ensure
          that only qualified applications proceed to the next stage of evaluation.
        </p>
      </HelpSection>

      <HelpSection id="reviewing" icon={ClipboardCheck} title="Reviewing an applicant">
        <p>
          Open an assigned applicant from your Review Queue. The workspace includes Information,
          Documents, Rubric, Notes and Contact.
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Information: application answers and contact information.</li>
          <li>Documents: essay, transcript, discussion copies and signature checks.</li>
          <li>
            Rubric: Writing and Rhetoric, each scored from 0 to 9, for 18 points per reviewer.
          </li>
          <li>Notes: committee notes; your private reviewer notes are entered with your review.</li>
          <li>Contact: application outreach history.</li>
        </ul>
        <p>
          Enter your Writing and Rhetoric scores, choose a recommendation and add reviewer notes.
          Save draft preserves work without completing the review. Submit Review marks your review
          complete. Use Update Review where the current screen permits changes to your submitted
          review.
        </p>
        <p>
          Program score summaries use completed reviews and the existing five-reviewer total out of
          90. Practice scores do not enter real summaries.
        </p>
      </HelpSection>

      <HelpSection id="top" icon={Trophy} title="Scoring Summary">
        <p>
          The Scoring Summary page provides a neutral score overview for committee discussion.
          Finalist Selection Pending: this section is not a final ranking and should not be treated
          as a selected Top 10 list.
        </p>
      </HelpSection>

      <HelpSection id="contact" icon={Mail} title="Contact Center">
        <p>
          Use the Contact Center to track outreach related to incomplete applications, missing
          documents, or follow-up questions. Reviewers should use this area to note which applicants
          may need contact regarding missing signatures, transcripts, essays, or other application
          materials. This section should support coordination and prevent duplicate outreach.
        </p>
      </HelpSection>

      <HelpSection id="access" icon={ShieldCheck} title="Reviewer Access">
        <p>
          Reviewers must use their own invited account and select the correct program. Access
          depends on program membership, screening and an active application assignment. Ask an
          administrator to check these if an expected application is missing.
        </p>
      </HelpSection>

      <HelpSection id="team" icon={Users} title="Review Team">
        <p>
          Administrators manage current reviewers in Users &amp; Access and assign them through
          Reviewer Assignments. Consult the current user list rather than a fixed roster in this
          guide.
        </p>
      </HelpSection>

      <HelpSection id="import" icon={Upload} title="Import Data (Admin)">
        <p>
          Admins can upload applicant data from a CSV. Match columns to applicant fields and review
          the preview before importing. This Scholarship importer adds new applications; verify the
          existing list before importing the same file again to avoid duplicates.
        </p>
      </HelpSection>

      <HelpSection id="testing" icon={ClipboardCheck} title="Testing the Review Portal">
        <TestingHelpContent />
      </HelpSection>

      <HelpSection id="rule" icon={AlertTriangle} title="Important rule">
        <Card className="p-4 bg-gold/10 border-gold/40">
          <p className="text-foreground font-medium">
            The app does not select scholarship recipients automatically.
          </p>
          <p className="mt-2">
            Scoring, ranking, and missing-document flags are decision-support tools. Final selection
            of finalists and recipients is always made by the Justice League of Greater Lansing
            Scholarship Committee.
          </p>
        </Card>
      </HelpSection>

      <Card className="p-6 rounded-xl border-border/60 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" /> Need more help?
        </div>
        <p className="mt-2 text-muted-foreground">
          Reach out to your program administrator or committee lead. You can return to this guide
          any time from the{" "}
          <Link to="/help" className="text-primary underline">
            Help &amp; Guide
          </Link>{" "}
          link in the sidebar.
        </p>
      </Card>
    </div>
  );
}
