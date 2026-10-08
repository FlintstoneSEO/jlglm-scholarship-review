import { StatusBadge } from "@/components/brand";
import type { ReviewStatus as ReviewStatusModel } from "@/lib/review-domain";

export function reviewStatusLabel(status: ReviewStatusModel["value"]) {
  if (status === "submitted") return "Submitted";
  if (status === "in_progress") return "In progress";
  if (status === "not_started" || status === "assigned" || status === "unassigned")
    return "Not started";
  return "Unavailable";
}

export function ReviewStatus({ status }: { status: ReviewStatusModel }) {
  const tone = status.value === "submitted" ? "completed" : status.value === "in_progress" ? "in_progress" : status.value === "unavailable" || status.value === "reopened" ? "error" : "not_started";
  return <span className="inline-flex items-center gap-1 text-xs font-medium">Review: <StatusBadge status={tone} label={reviewStatusLabel(status.value)} className="normal-case" /></span>;
}
