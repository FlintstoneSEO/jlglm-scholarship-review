import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  assignmentHistoryText,
  type GrantAssignmentSummary as Summary,
} from "@/lib/grant-assignment-summary";

const statusLabels = {
  not_started: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  on_hold: "On hold for conflict",
};

export function GrantAssignmentSummary({
  summary,
  failed,
  onRetry,
  userId,
  applicationId,
  isTest,
  canAdmin,
  excluded = false,
}: {
  summary: Summary | null;
  failed: boolean;
  onRetry: () => void;
  userId?: string;
  applicationId: string;
  isTest: boolean;
  canAdmin: boolean;
  excluded?: boolean;
}) {
  return (
    <section
      aria-labelledby="grant-assignments-heading"
      className="col-span-full min-w-0 rounded-lg border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 id="grant-assignments-heading" className="font-display text-lg font-semibold">
          {excluded ? "Excluded reviewer & assignment history" : "Reviewers & assignments"}
        </h2>
        {canAdmin && (
          <Link
            to="/assignments"
            search={{
              application: applicationId,
              program: "business_growth_grant",
              scope: isTest ? "test" : "real",
              tab: "progress",
            }}
            className="inline-flex min-h-11 items-center text-sm underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Manage assignments
          </Link>
        )}
      </div>
      {failed ? (
        <div role="alert" className="mt-2 text-sm">
          Reviewer assignments and history could not be loaded.
          <Button variant="outline" className="ml-2 min-h-11" onClick={onRetry}>
            Retry assignments
          </Button>
        </div>
      ) : !summary ? (
        <p role="status" className="mt-2 text-sm text-muted-foreground">
          Loading reviewer assignments and history...
        </p>
      ) : (
        <>
          {summary.current_group && (
            <p className="mt-2 text-sm">
              Current group: <strong>{summary.current_group.name}</strong>. Original allocations
              remain in assignment administration history.
            </p>
          )}
          {summary.original_group && (
            <p className="mt-1 text-sm text-muted-foreground">
              Original allocation group: {summary.original_group.name}
            </p>
          )}
          {summary.assignments.length ? (
            <ul
              aria-label={excluded ? "Excluded assigned reviewers" : "Current assigned reviewers"}
              className="mt-2 divide-y divide-border"
            >
              {summary.assignments.map((a) => (
                <li
                  key={a.assignment_id}
                  className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div className="min-w-0 break-words">
                    <p className="font-semibold">
                      {a.reviewer_name}
                      {a.reviewer_id === userId && " (You)"}
                    </p>
                    {a.replaces && (
                      <p className="mt-1 text-muted-foreground">Replacement for {a.replaces}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="whitespace-normal">
                    {excluded
                      ? `Excluded history · ${statusLabels[a.status]}`
                      : statusLabels[a.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm">No active reviewers are assigned to this application.</p>
          )}
          <details className="mt-2 border-t border-border pt-1">
            <summary className="min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Assignment &amp; conflict history (
              {summary.history.filter((e) => e.kind === "cleared" || e.kind === "replaced").length}{" "}
              resolved conflicts)
            </summary>
            <p className="mb-3 text-sm text-muted-foreground">
              Current reviewers are listed above. Earlier assignments and resolutions remain here as
              history.
            </p>
            {!!summary.excluded_transfer_reviews?.length && (
              <div className="mb-3 text-sm">
                <h3 className="font-semibold">Excluded transfer reviews</h3>
                <ul className="mt-1 space-y-1">
                  {summary.excluded_transfer_reviews.map((r, i) => (
                    <li key={i}>
                      {r.reviewer_name}: {r.review_status.replaceAll("_", " ")} · excluded
                      historical evidence; does not count toward scores or completion.
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.history.length ? (
              <ol className="divide-y divide-border text-sm">
                {summary.history.map((event) => (
                  <li key={event.id} className="space-y-1 break-words py-3">
                    <p className="font-medium">{assignmentHistoryText(event)}</p>
                    <p className="text-xs text-muted-foreground">
                      <time dateTime={event.occurred_at}>
                        {new Date(event.occurred_at).toLocaleString()}
                      </time>
                      {event.actor_name && ` · By ${event.actor_name}`}
                    </p>
                    {event.reason && <p className="whitespace-pre-wrap">Reason: {event.reason}</p>}
                    {event.kind === "replaced" && (
                      <p className="text-muted-foreground">
                        Original review retained as excluded history. It does not count toward
                        scores or completion.
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="pb-3 text-sm text-muted-foreground">
                No assignment or conflict history is recorded.
              </p>
            )}
          </details>
        </>
      )}
    </section>
  );
}
