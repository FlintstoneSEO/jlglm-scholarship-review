import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { StatusBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Capability, ReadState, ReviewQueueItem } from "@/lib/review-domain";
import { capabilityAllows } from "@/lib/review-domain";
import type { GrantQueueSearch } from "@/lib/grant-screening";

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
  mobileTitle,
  mobileDetail,
  reviewLabel,
  supplementalStatus,
  destinationSearch,
  actionLabel,
}: {
  items: T[];
  state: ReadState;
  columns: ReviewQueueColumn<T>[];
  emptyMessage?: string;
  onRetry?: () => void;
  showAdminWarnings?: boolean;
  leadingColumn?: ReviewQueueLeadingColumn<T>;
  rowActions?: (item: T) => ReactNode;
  mobileTitle?: (item: T) => ReactNode;
  mobileDetail?: (item: T) => ReactNode;
  reviewLabel?: (item: T) => string;
  supplementalStatus?: (item: T) => ReactNode;
  destinationSearch?: (item: T) => GrantQueueSearch;
  actionLabel?: (item: T) => string;
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
    <Card className="overflow-hidden">
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
      <ul className="grid gap-3 p-3 lg:grid-cols-2">
        {items.map((item) => (
          <li
            key={`${item.program}:${item.applicationId}`}
            className="min-w-0 rounded-md border border-border"
          >
            {leadingColumn && <div className="px-4 pt-3">{leadingColumn.cell(item)}</div>}
            <Link
              to={item.destination}
              search={destinationSearch?.(item)}
              aria-label={`${actionLabel?.(item) ?? "View application"}: ${item.applicantName}`}
              className="block min-h-11 min-w-0 px-4 py-4 transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block break-words font-semibold">
                    {mobileTitle?.(item) ?? item.applicantName}
                  </span>
                  <span className="mt-0.5 block break-words text-sm text-muted-foreground">
                    {mobileDetail?.(item) ?? item.applicantEmail}
                  </span>
                </span>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              </span>
              <span className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                <StatusBadge
                  status={
                    item.status.value === "submitted"
                      ? "completed"
                      : item.status.value === "in_progress"
                        ? "in_progress"
                        : item.status.value === "unavailable" || item.status.value === "reopened"
                          ? "error"
                          : "not_started"
                  }
                  label={reviewLabel?.(item) ?? reviewStatusLabel(item.status.value)}
                  className="normal-case"
                />
                {supplementalStatus?.(item)}
                <span className="min-w-0 text-xs text-muted-foreground">
                  {item.progress.completedReviews ?? "—"} of{" "}
                  {item.progress.denominator.value ?? "—"} reviews complete
                </span>
              </span>
              <span className="mt-2 block text-xs font-semibold text-primary">
                {actionLabel?.(item) ?? "View application"}
              </span>
              {columns.length > 0 && (
                <span className="mt-4 hidden gap-x-5 gap-y-3 border-t border-border pt-3 sm:grid sm:grid-cols-2">
                  {columns.map((column) => (
                    <span key={column.id} className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {column.label}
                      </span>
                      <span className="mt-1 block break-words text-sm text-foreground">
                        {column.cell(item)}
                      </span>
                    </span>
                  ))}
                </span>
              )}
              {showAdminWarnings && item.progress.anomalies.length > 0 && (
                <span className="mt-2 block text-xs font-medium text-destructive">
                  Review data needs attention
                </span>
              )}
            </Link>
            {rowActions && <div className="px-4 pb-3">{rowActions(item)}</div>}
          </li>
        ))}
      </ul>
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
