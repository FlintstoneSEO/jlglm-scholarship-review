import { AlertTriangle } from "lucide-react";
import type { ReviewProgress as ReviewProgressData } from "@/lib/review-domain";

export function ReviewProgress({
  progress,
  showAdminWarning = false,
}: {
  progress: ReviewProgressData;
  showAdminWarning?: boolean;
}) {
  if (progress.state === "error" || progress.state === "pending")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {progress.state === "pending"
          ? "Loading review progress..."
          : "Review progress unavailable. Retry assignments below."}
      </p>
    );
  if (progress.scope === "personal")
    return (
      <div className="text-sm">
        <p className="font-medium">
          Your review:{" "}
          {progress.completedReviews
            ? "submitted"
            : progress.startedReviews
              ? "in progress"
              : "not started"}
        </p>
        <p className="mt-1 text-muted-foreground">Application review coverage unavailable.</p>
      </div>
    );
  const assigned = progress.assignedReviewers ?? "—";
  const started = progress.startedReviews ?? "—";
  const completed = progress.completedReviews ?? "—";
  const remaining = progress.remainingReviews ?? "—";
  const denominator = progress.denominator.value;
  const summary =
    progress.denominator.kind === "fixed"
      ? `${completed} of ${denominator ?? "—"} reviews completed`
      : `${completed} of ${denominator ?? "—"} assigned reviews completed`;
  const completedCount = progress.completedReviews ?? 0;
  const completion =
    denominator && denominator > 0
      ? Math.min(100, Math.max(0, (completedCount / denominator) * 100))
      : 0;
  return (
    <div
      className="min-w-44 text-sm"
      aria-label={`${summary}; ${assigned} assigned, ${started} started, ${remaining} remaining`}
    >
      <div className="font-medium">{summary}</div>
      {denominator && denominator > 0 && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div className="h-full bg-success" style={{ width: `${completion}%` }} />
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        {assigned} assigned · {started} started · {remaining} remaining
      </div>
      {showAdminWarning && progress.anomalies.length > 0 && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-destructive" role="status">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Review data needs attention
        </div>
      )}
    </div>
  );
}
