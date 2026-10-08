import type { GrantEligibilityStatus } from "./grant-eligibility-display";
import { parseGrantEligibilityFilter } from "./grant-eligibility-filter.ts";
import type { ReviewQueueItem } from "./review-domain";
import type { GrantQueueMetadata } from "./review-queue-projections";

export type GrantQueueSearch = {
  scope?: "real" | "test" | "all";
  section?: "overview" | "application" | "documents" | "rubric";
  eligibility?: GrantEligibilityStatus;
  q?: string;
  scoring?: "not_started" | "in_progress" | "completed";
  lara?: string;
  model?: string;
  age?: string;
};
export function parseGrantQueueSearch(search: Record<string, unknown>): GrantQueueSearch {
  const result: GrantQueueSearch = {};
  if (search.scope === "real" || search.scope === "test" || search.scope === "all")
    result.scope = search.scope;
  if (
    search.section === "overview" ||
    search.section === "application" ||
    search.section === "documents" ||
    search.section === "rubric"
  )
    result.section = search.section;
  const eligibility = parseGrantEligibilityFilter(search.eligibility);
  if (eligibility !== "all") result.eligibility = eligibility;
  if (
    search.scoring === "not_started" ||
    search.scoring === "in_progress" ||
    search.scoring === "completed"
  )
    result.scoring = search.scoring;
  for (const key of ["q", "lara", "model", "age"] as const) {
    const value = search[key];
    if (typeof value === "string" && value.trim() && value !== "all")
      result[key] = value.slice(0, 200);
  }
  return result;
}
export const screeningViews = [
  { value: "not_reviewed", label: "Needs screening" },
  { value: "needs_clarification", label: "Needs clarification" },
  { value: "eligible", label: "Eligible" },
  { value: "ineligible", label: "Ineligible" },
  { value: "all", label: "All applications" },
] as const;
export function grantScreeningCounts(
  applicationIds: string[],
  eligibility: { application_id: string; status: GrantEligibilityStatus }[],
) {
  const byId = new Map(eligibility.map((row) => [row.application_id, row.status]));
  const counts = {
    not_reviewed: 0,
    needs_clarification: 0,
    eligible: 0,
    ineligible: 0,
    all: applicationIds.length,
  };
  for (const id of applicationIds) counts[byId.get(id) ?? "not_reviewed"]++;
  return counts;
}
export function matchesGrantQueueSearch(
  item: ReviewQueueItem<GrantQueueMetadata>,
  search: GrantQueueSearch,
  eligibility: GrantEligibilityStatus | undefined,
  filterEligibility: boolean,
) {
  if (
    filterEligibility &&
    search.eligibility &&
    (eligibility ?? "not_reviewed") !== search.eligibility
  )
    return false;
  if (search.scoring && item.status.nativeValue !== search.scoring) return false;
  if (search.lara && item.metadata.laraStatus !== search.lara) return false;
  if (search.model && item.metadata.operatingModel !== search.model) return false;
  if (search.age && item.metadata.businessAge !== search.age) return false;
  const q = (search.q ?? "").toLowerCase();
  return (
    !q ||
    [item.applicantName, item.applicantEmail, item.metadata.businessName].some((value) =>
      value?.toLowerCase().includes(q),
    )
  );
}
// Continue from the saved applicant's position, then wrap once. Never reopen that applicant.
export function nextScreeningApplication(
  orderedIds: string[],
  matchingIds: string[],
  currentId: string,
): string | null {
  const position = orderedIds.indexOf(currentId);
  const candidates =
    position < 0
      ? orderedIds
      : [...orderedIds.slice(position + 1), ...orderedIds.slice(0, position)];
  const matching = new Set(matchingIds);
  return candidates.find((id) => id !== currentId && matching.has(id)) ?? null;
}
