import type { Database } from "@/integrations/supabase/types";

export type GrantRequirementStatus = Database["public"]["Enums"]["grant_requirement_status"];
export type GrantEligibilityStatus = Database["public"]["Enums"]["grant_eligibility_status"];

export const grantRequirementStatusLabel: Record<GrantRequirementStatus, string> = {
  pending: "Pending verification",
  verified: "Verified",
  missing: "Missing",
  failed: "Failed",
  needs_clarification: "Needs clarification",
};

export const grantEligibilityStatusLabel: Record<GrantEligibilityStatus, string> = {
  not_reviewed: "Not reviewed",
  eligible: "Eligible",
  needs_clarification: "Needs clarification",
  ineligible: "Ineligible",
};

export function grantRequirementBadgeClass(status: GrantRequirementStatus): string {
  if (status === "verified") return "bg-primary/10 text-primary";
  if (status === "failed") return "bg-destructive/10 text-destructive";
  if (status === "pending") return "bg-muted text-muted-foreground";
  return "bg-warning/15 text-warning";
}

export function grantEligibilityBadgeClass(status: GrantEligibilityStatus): string {
  if (status === "eligible") return "bg-primary/10 text-primary";
  if (status === "ineligible") return "bg-destructive/10 text-destructive";
  if (status === "not_reviewed") return "bg-muted text-muted-foreground";
  return "bg-warning/15 text-warning";
}
