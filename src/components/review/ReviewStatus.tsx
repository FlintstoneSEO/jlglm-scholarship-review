import { Badge } from "@/components/ui/badge";
import type { ReviewStatus as ReviewStatusModel } from "@/lib/review-domain";

export function reviewStatusLabel(status: ReviewStatusModel["value"]) {
  if (status === "submitted") return "Submitted";
  if (status === "in_progress") return "In progress";
  if (status === "not_started" || status === "assigned" || status === "unassigned")
    return "Not started";
  return "Unavailable";
}

export function ReviewStatus({ status }: { status: ReviewStatusModel }) {
  return <Badge variant="outline">Review: {reviewStatusLabel(status.value)}</Badge>;
}
