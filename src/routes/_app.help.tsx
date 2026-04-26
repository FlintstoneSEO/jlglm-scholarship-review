import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

export const Route = createFileRoute("/_app/help")({
  head: () => ({
    meta: [
      { title: "Help & Guide — JLGL Scholarship Review" },
      { name: "description", content: "How to use the Justice League of Greater Lansing Scholarship Review portal." },
    ],
  }),
  component: HelpPage,
});

const sections = [
  { id: "welcome", label: "Welcome" },
  { id: "roles", label: "Roles" },
  { id: "dashboard", label: "Dashboard" },
  { id: "applicants", label: "Applicants" },
  { id: "reviewing", label: "Reviewing" },
  { id: "top", label: "Top Applicants" },
  { id: "contact", label: "Contact Center" },
  { id: "import", label: "Import Data" },
  { id: "rule", label: "Important Rule" },
];

function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="p-6 rounded-xl border-border/60 scroll-mt-24">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg grid place-items-center bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl">{title}</h2>
      </div>
      <div className="mt-4 space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>
    </Card>
  );
}

function HelpPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Getting Started</p>
        <h1 className="font-display text-3xl md:text-4xl mt-1">Help &amp; Guide</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          A quick tour of the Scholarship Review Portal for the 2026 Reparations Scholarship. Bookmark this page — you can return any time from the sidebar.
        </p>
      </div>

      <Card className="p-4 rounded-xl border-border/60 bg-secondary/30">
        <div className="flex flex-wrap gap-2">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              {s.label}
            </a>
          ))}
        </div>
      </Card>

      <Section id="welcome" icon={BookOpen} title="Welcome">
        <p>
          This portal helps the Justice League of Greater Lansing Scholarship Committee review applicants for the 2026 Reparations Scholarship together — in one place, with consistent scoring and clear records of who needs follow-up.
        </p>
        <p>
          The app summarizes information, calculates scores, flags missing documents, and ranks applicants based on the scores you and other committee members enter. <strong className="text-foreground">It does not pick winners.</strong> The committee makes the final selection.
        </p>
      </Section>

      <Section id="roles" icon={ShieldCheck} title="Roles &amp; permissions">
        <ul className="space-y-2">
          <li><Badge className="mr-2 bg-primary text-primary-foreground">Admin</Badge> Full access — import applicants, manage reviewers, mark finalists and selected recipients, edit any record.</li>
          <li><Badge className="mr-2" variant="outline">Reviewer</Badge> View applicants, add scores and notes, log contact attempts.</li>
          <li><Badge className="mr-2" variant="secondary">Viewer</Badge> Read-only access to the dashboard and applicant records.</li>
        </ul>
        <p className="text-xs">Your current role is shown at the bottom of the sidebar. If you need different access, contact the committee chair.</p>
      </Section>

      <Section id="dashboard" icon={LayoutDashboard} title="Dashboard">
        <p>The dashboard is your starting point. The KPI cards show:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Total Applicants</strong> — every applicant in the system.</li>
          <li><strong className="text-foreground">Complete Applications</strong> — no documents flagged as missing.</li>
          <li><strong className="text-foreground">Needs Review</strong> — not yet reviewed or in progress.</li>
          <li><strong className="text-foreground">Missing Documents</strong> — applicants you may need to contact.</li>
          <li><strong className="text-foreground">Finalists</strong> &amp; <strong className="text-foreground">Selected Recipients</strong> — committee decisions.</li>
          <li><strong className="text-foreground">Average Score</strong> &amp; <strong className="text-foreground">Top 10</strong> — based on saved committee reviews.</li>
        </ul>
      </Section>

      <Section id="applicants" icon={Users} title="Applicants list">
        <p>
          The Applicants page lists every submission. Use the search and filters to narrow by status, missing documents, or finalist flag. Status badges tell you at a glance where each applicant is in the process. Click any row to open the full record.
        </p>
      </Section>

      <Section id="reviewing" icon={ClipboardCheck} title="Reviewing an applicant">
        <p>Each applicant record has five tabs:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Information</strong> — contact details, demographics, education, and answers.</li>
          <li><strong className="text-foreground">Documents</strong> — transcript, recommendation letters, essay, and ID. Missing items are flagged here.</li>
          <li><strong className="text-foreground">Scoring</strong> — the 100-point rubric (see below).</li>
          <li><strong className="text-foreground">Notes</strong> — internal committee notes shared with other reviewers.</li>
          <li><strong className="text-foreground">Contact</strong> — log of outreach to the applicant.</li>
        </ul>
        <p className="pt-2"><strong className="text-foreground">100-point rubric:</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Essay Quality — up to 30 points</li>
          <li>Alignment with Scholarship Purpose — up to 25 points</li>
          <li>Educational Goals — up to 20 points</li>
          <li>Personal Impact / Need — up to 15 points</li>
          <li>Application Completeness — up to 10 points</li>
        </ul>
        <p>
          Pick a <strong className="text-foreground">recommendation</strong> (Strongly recommend, Recommend, Consider, Needs discussion, Do not recommend) and add reviewer notes explaining strengths and concerns. Click <em>Save review</em> — you can come back and update it any time.
        </p>
      </Section>

      <Section id="top" icon={Trophy} title="Top Applicants">
        <p>
          The Top Applicants page ranks everyone by the average of committee scores. Use it to surface candidates for discussion. Admins can mark applicants as <strong className="text-foreground">Finalists</strong> or <strong className="text-foreground">Selected Recipients</strong> from the applicant detail page once the committee has decided.
        </p>
      </Section>

      <Section id="contact" icon={Mail} title="Contact Center">
        <p>
          The Contact Center helps you reach applicants who are missing documents or need follow-up. You can copy email addresses, draft messages, and log every contact attempt so the committee has a clear record.
        </p>
      </Section>

      <Section id="import" icon={Upload} title="Import Data (Admin)">
        <p>
          Admins can upload applicant data from a CSV. Match columns to applicant fields and review the preview before importing. Existing applicants are matched by email so you can re-import without creating duplicates.
        </p>
      </Section>

      <Section id="rule" icon={AlertTriangle} title="Important rule">
        <Card className="p-4 bg-gold/10 border-gold/40">
          <p className="text-foreground font-medium">
            The app does not select scholarship recipients automatically.
          </p>
          <p className="mt-2">
            Scoring, ranking, and missing-document flags are decision-support tools. Final selection of finalists and recipients is always made by the Justice League of Greater Lansing Scholarship Committee.
          </p>
        </Card>
      </Section>

      <Card className="p-6 rounded-xl border-border/60 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground"><HelpCircle className="h-4 w-4 text-primary" /> Need more help?</div>
        <p className="mt-2 text-muted-foreground">
          Reach out to the committee chair or your administrator. You can return to this guide any time from the <Link to="/help" className="text-primary underline">Help &amp; Guide</Link> link in the sidebar.
        </p>
      </Card>
    </div>
  );
}
