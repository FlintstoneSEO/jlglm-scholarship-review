import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
export const Route = createFileRoute("/_app/practice-document")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { applicationId: string; kind: string; applicantId?: string } => ({
    applicationId: typeof s.applicationId === "string" ? s.applicationId : "",
    applicantId: typeof s.applicantId === "string" ? s.applicantId : undefined,
    kind: typeof s.kind === "string" ? s.kind : "lara_documentation",
  }),
  component: PracticeDocument,
});
function PracticeDocument() {
  const { kind, applicationId, applicantId } = Route.useSearch();
  const year = kind === "profit_loss_2024" ? 2024 : 2025;
  return (
    <Card className="mx-auto max-w-3xl space-y-5 p-6">
      {applicantId && (
        <Link
          className="inline-flex min-h-11 items-center underline"
          to="/applicants/$id"
          params={{ id: applicantId }}
        >
          Return to application
        </Link>
      )}
      {applicationId && (
        <Link
          className="inline-flex min-h-11 items-center underline"
          to="/grants/$id"
          params={{ id: applicationId }}
        >
          Return to application
        </Link>
      )}
      <h1 className="font-display text-3xl">Practice supporting document</h1>
      <p className="font-semibold">
        FICTIONAL TRAINING EXAMPLE · No real applicant or official LARA record
      </p>
      {kind === "scholarship_essay" ? (
        <>
          <h2 className="text-xl">Sample education and community essay</h2>
          <p>
            I hope to study community planning at a fictional college. Volunteering at a
            neighborhood learning center taught me to listen, organize and support others. My
            educational goal is to develop practical skills that strengthen access to local
            services. This fictional student describes financial need for books, tuition and
            transport; all circumstances are invented for testing.
          </p>
        </>
      ) : kind === "scholarship_transcript" ? (
        <>
          <h2 className="text-xl">Sample transcript</h2>
          <p>
            Fictional Community High School · Sample Student · English: A · Mathematics: B · Civics:
            A. This is a fictional record for workflow testing.
          </p>
        </>
      ) : kind === "lara_documentation" ? (
        <>
          <h2 className="text-xl">Sample registration and standing</h2>
          <p>
            Practice Business · Michigan · Example standing: active. This is a training example, not
            a government verification. Check actual LARA records for real applications.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-xl">Sample {year} profit and loss</h2>
          <p>Period: January 1–December 31, {year}. Fictional figures for screening practice.</p>
          <dl className="grid grid-cols-2 gap-3">
            <dt>Revenue</dt>
            <dd>$100,000</dd>
            <dt>Expenses</dt>
            <dd>$75,000</dd>
            <dt>Net profit</dt>
            <dd>$25,000</dd>
          </dl>
        </>
      )}
      <p>
        Use this document to rehearse opening evidence, checking its year and recording a human
        screening decision.
      </p>
    </Card>
  );
}
