import type { GrantEligibilityStatus } from "@/lib/grant-eligibility-display";

export type GrantEligibilityFilter = GrantEligibilityStatus | "all";

export function parseGrantEligibilityFilter(value: unknown): GrantEligibilityFilter {
  return value === "not_reviewed" ||
    value === "needs_clarification" ||
    value === "eligible" ||
    value === "ineligible"
    ? value
    : "all";
}

export function matchesGrantEligibilityFilter(
  status: GrantEligibilityStatus | undefined,
  filter: GrantEligibilityFilter,
): boolean {
  return filter === "all" || (status ?? "not_reviewed") === filter;
}
