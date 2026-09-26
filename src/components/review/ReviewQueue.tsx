import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Capability, ReadState, ReviewQueueItem } from "@/lib/review-domain";
import { capabilityAllows } from "@/lib/review-domain";
import { ReviewProgress } from "./ReviewProgress";

export type ReviewQueueColumn<T> = {
  id: string;
  label: string;
  cell: (item: T) => ReactNode;
  className?: string;
};
export const reviewStatusLabel = (value: ReviewQueueItem["status"]["value"]) =>
  ({
    assigned: "Assigned",
    not_started: "Not started",
    in_progress: "In progress",
    submitted: "Submitted",
    unavailable: "Unavailable",
    unassigned: "Not assigned",
    reopened: "Unavailable",
  })[value];
export function mayPresentPrivilegedAction(capability: Capability) {
  return capabilityAllows(capability);
}

export type ReviewQueueLeadingColumn<T> = {
  label: string;
  cell: (item: T) => ReactNode;
  header?: ReactNode;
  className?: string;
};
export function ReviewQueue<T extends ReviewQueueItem>({
  items,
  state,
  columns,
  emptyMessage = "No applications match this view.",
  onRetry,
  showAdminWarnings = false,
  leadingColumn,
  rowActions,
}: {
  items: T[];
  state: ReadState;
  columns: ReviewQueueColumn<T>[];
  emptyMessage?: string;
  onRetry?: () => void;
  showAdminWarnings?: boolean;
  leadingColumn?: ReviewQueueLeadingColumn<T>;
  rowActions?: (item: T) => ReactNode;
}) {
  if (state === "loading")
    return (
      <QueueState title="Loading applications…" detail="Please wait while the queue loads." busy />
    );
  if (state === "unavailable")
    return (
      <QueueState
        title="Queue unavailable"
        detail="This queue is not available in the current program context."
      />
    );
  if (state === "error")
    return (
      <QueueState
        title="We couldn't load the applications."
        detail="Try again. If the problem continues, contact an administrator."
        onRetry={onRetry}
      />
    );
  if (state === "empty" || (state === "ready" && items.length === 0))
    return <QueueState title={emptyMessage} detail="Adjust the filters or check again later." />;
  return (
    <Card className="rounded-xl border-border/60 overflow-hidden">
      {state === "partial_error" && (
        <div
          className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 p-4 text-sm"
          role="status"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <strong>Some application details couldn't be loaded.</strong>
            <div>
              Core queue results remain available. Retry before making decisions that depend on
              missing details.
            </div>
          </div>
          {onRetry && (
            <Button size="sm" variant="outline" className="ml-auto" onClick={onRetry}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Retry
            </Button>
          )}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {leadingColumn && (
                <th scope="col" className={`px-4 py-3 text-left ${leadingColumn.className ?? ""}`}>
                  {leadingColumn.header ?? leadingColumn.label}
                </th>
              )}
              <th scope="col" className="px-4 py-3 text-left">
                Applicant
              </th>
              {columns.map((c) => (
                <th scope="col" key={c.id} className={`px-4 py-3 text-left ${c.className ?? ""}`}>
                  {c.label}
                </th>
              ))}
              <th scope="col" className="px-4 py-3 text-left">
                Status
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Progress
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <tr key={`${item.program}:${item.applicationId}`} className="hover:bg-muted/30">
                {leadingColumn && (
                  <td className={`px-4 py-3 ${leadingColumn.className ?? ""}`}>
                    {leadingColumn.cell(item)}
                  </td>
                )}
                <th scope="row" className="px-4 py-3 text-left font-medium">
                  <span className="block max-w-64 break-words">{item.applicantName}</span>
                  {item.applicantEmail && (
                    <span className="block text-xs font-normal text-muted-foreground break-all">
                      {item.applicantEmail}
                    </span>
                  )}
                </th>
                {columns.map((c) => (
                  <td key={c.id} className={`px-4 py-3 ${c.className ?? ""}`}>
                    {c.cell(item)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <Badge variant="outline">{reviewStatusLabel(item.status.value)}</Badge>
                </td>
                <td className="px-4 py-3">
                  <ReviewProgress progress={item.progress} showAdminWarning={showAdminWarnings} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {rowActions?.(item)}
                    <Link
                      to={item.destination}
                      aria-label={`Open ${item.applicantName}'s application`}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function QueueState({
  title,
  detail,
  busy = false,
  onRetry,
}: {
  title: string;
  detail: string;
  busy?: boolean;
  onRetry?: () => void;
}) {
  return (
    <Card className="p-8 text-center" role="status" aria-live="polite" aria-busy={busy}>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </Button>
      )}
    </Card>
  );
}
