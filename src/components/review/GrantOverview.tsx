import { ExternalLink } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import type { ReviewDocument, ReviewProgress, ReviewStatus } from "@/lib/review-domain";
import { grantOverviewRequirements } from "@/lib/grant-overview";

type GrantDetail = Database["public"]["Tables"]["business_grant_application_details"]["Row"];

export function GrantOverview({
  detail,
  documents,
  progress,
  status,
  onOpenDocument,
}: {
  detail: GrantDetail;
  documents: ReviewDocument[];
  progress: ReviewProgress;
  status: ReviewStatus;
  onOpenDocument: (document: ReviewDocument) => void | Promise<void>;
}) {
  const facts = [
    ["Time in business", detail.business_age_range],
    ["Operating model", detail.business_operating_model],
    ["LARA response", detail.lara_status],
    ["Customers served in 2025", detail.customer_volume],
  ].filter((entry): entry is [string, string] => !!entry[1]);
  const requirements = grantOverviewRequirements(detail, documents);
  return (
    <div className="min-w-0 space-y-5">
      <section
        aria-labelledby="grant-business-summary"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-business-summary" className="font-display text-xl font-black uppercase">
          Business at a glance
        </h2>
        <p className="mt-2 break-words text-lg font-semibold">{detail.business_name}</p>
        {facts.length > 0 ? (
          <dl className="mt-4 grid gap-x-8 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-4">
            {facts.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">
            No additional business summary fields were supplied.
          </p>
        )}
      </section>

      <section
        aria-labelledby="grant-eligibility"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-eligibility" className="font-display text-xl font-black uppercase">
          Eligibility &amp; compliance
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These six pass/fail requirements need human review before competitive scoring. Record
          responses and document presence do not establish eligibility.
        </p>
        <ol className="mt-4 divide-y divide-border border-y border-border">
          {requirements.map((requirement) => (
            <li
              key={requirement.id}
              className="grid min-w-0 gap-2 py-4 lg:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1.5fr)] lg:gap-6"
            >
              <div className="min-w-0">
                <h3 className="font-semibold">{requirement.label}</h3>
                <span
                  className={`mt-2 inline-block rounded px-2 py-0.5 text-xs font-semibold ${requirement.status === "Missing" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}
                >
                  {requirement.status}
                </span>
              </div>
              <div className="min-w-0 space-y-2 text-sm">
                <p className="break-words">
                  <span className="font-semibold">Record evidence:</span> {requirement.evidence}
                </p>
                <p className="break-words text-muted-foreground">
                  <span className="font-semibold text-foreground">Documentation:</span>{" "}
                  {requirement.documentNote}
                </p>
                <p className="break-words text-muted-foreground">
                  <span className="font-semibold text-foreground">Human verification:</span>{" "}
                  {requirement.verification}
                </p>
                {requirement.documents.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {requirement.documents.map((document) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => onOpenDocument(document)}
                        disabled={!document.url && !document.storagePath}
                        className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="break-words">
                          {document.url || document.storagePath ? "Open" : "Unavailable"}{" "}
                          {document.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="grant-eligibility-status"
        className="rounded-lg border border-border bg-muted/30 p-4 sm:p-5"
      >
        <h2 id="grant-eligibility-status" className="text-base font-semibold">
          Eligibility review status
        </h2>
        <p className="mt-1 text-sm font-medium">Eligibility review not yet confirmed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Review the requirements above before competitive scoring. Formal eligibility confirmation
          is planned for the next workflow phase; this screen does not record a decision or restrict
          scoring.
        </p>
      </section>

      <section
        aria-labelledby="grant-competitive-progress"
        className="rounded-lg border border-border bg-card p-4 sm:p-6"
      >
        <h2 id="grant-competitive-progress" className="font-display text-xl font-black uppercase">
          Competitive review progress
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Eligibility &amp; compliance → Competitive review
        </p>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-3 border-t border-border pt-4 text-sm">
          <div>
            <dt className="text-muted-foreground">Your review</dt>
            <dd className="font-semibold">
              {status.value === "submitted"
                ? "Submitted"
                : status.value === "in_progress"
                  ? "In progress"
                  : "Not started"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Assigned reviews</dt>
            <dd className="font-semibold">{progress.assignedReviewers ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Completed reviews</dt>
            <dd className="font-semibold">{progress.completedReviews ?? "—"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
