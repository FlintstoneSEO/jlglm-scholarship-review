import { AlertTriangle } from "lucide-react";
import type { ReviewProgress as ReviewProgressData } from "@/lib/review-domain";

export function ReviewProgress({
  progress,
  showAdminWarning = false,
}: {
  progress: ReviewProgressData;
  showAdminWarning?: boolean;
}) {
  const assigned = progress.assignedReviewers ?? "—";
  const started = progress.startedReviews ?? "—";
  const completed = progress.completedReviews ?? "—";
  const remaining = progress.remainingReviews ?? "—";
  const denominator = progress.denominator.value;
  const summary =
    progress.denominator.kind === "fixed"
      ? `${completed} of ${denominator ?? "—"} reviews completed`
      : `${completed} of ${denominator ?? "—"} assigned reviews completed`;
  return (
    <div
      className="min-w-44 text-sm"
      aria-label={`${summary}; ${assigned} assigned, ${started} started, ${remaining} remaining`}
    >
      <div className="font-medium">{summary}</div>
      <div className="mt-1 text-xs text-muted-foreground">
        {assigned} assigned · {started} started · {remaining} remaining
      </div>
      {showAdminWarning && progress.anomalies.length > 0 && (
        <div className="mt-1 inline-flex items-center gap-1 text-xs text-warning" role="status">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> Review data needs attention
        </div>
      )}
    </div>
  );
}
