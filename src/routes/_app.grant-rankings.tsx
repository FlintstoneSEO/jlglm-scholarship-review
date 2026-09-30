import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildGrantRankingSummary, type GrantRankingRow } from "@/lib/grant-ranking-summary";
import {
  grantEligibilityStatusLabel,
  type GrantEligibilityStatus,
} from "@/lib/grant-eligibility-display";

export const Route = createFileRoute("/_app/grant-rankings")({ component: GrantRankings });

async function loadGrantRankings(programId: string) {
  const [applications, assignments, reviews, eligibility] = await Promise.all([
    supabase.from("portal_applications").select("id, applicant_name").eq("program_id", programId),
    supabase
      .from("reviewer_assignments")
      .select("id, application_id, lifecycle")
      .eq("program_id", programId),
    supabase
      .from("program_reviews")
      .select("id, assignment_id, status, rubric_version_id, version")
      .eq("program_id", programId),
    supabase
      .from("application_eligibility_reviews")
      .select("id, application_id, status")
      .eq("program_id", programId),
  ]);
  for (const result of [applications, assignments, reviews, eligibility])
    if (result.error) throw result.error;
  const applicationIds = new Set((applications.data ?? []).map((row) => row.id));
  const details = applicationIds.size
    ? await supabase
        .from("business_grant_application_details")
        .select("application_id, business_name")
        .in("application_id", [...applicationIds])
    : { data: [], error: null };
  if (details.error) throw details.error;
  const completed = (reviews.data ?? []).filter((row) => row.status === "completed");
  const versions = [
    ...new Set(completed.map((row) => row.rubric_version_id).filter((id): id is string => !!id)),
  ];
  const reviewIds = completed.map((row) => row.id);
  const eligibilityIds = (eligibility.data ?? []).map((row) => row.id);
  const [criteria, scores, overrides, certifications] = await Promise.all([
    versions.length
      ? supabase
          .from("rubric_criteria")
          .select("id, rubric_version_id, maximum_points, active")
          .in("rubric_version_id", versions)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length
      ? supabase
          .from("review_scores")
          .select("review_id, criterion_id, points")
          .in("review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
    eligibilityIds.length
      ? supabase
          .from("eligibility_scoring_overrides")
          .select("eligibility_review_id, event_number, scoring_allowed")
          .in("eligibility_review_id", eligibilityIds)
      : Promise.resolve({ data: [], error: null }),
    reviewIds.length
      ? supabase
          .from("grant_review_certifications")
          .select("program_review_id, review_version")
          .in("program_review_id", reviewIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const result of [criteria, scores, overrides, certifications])
    if (result.error) throw result.error;
  const businessNames = new Map(
    (details.data ?? [])
      .filter((row) => applicationIds.has(row.application_id))
      .map((row) => [row.application_id, row.business_name]),
  );
  return buildGrantRankingSummary({
    applications: (applications.data ?? []).map((row) => ({
      ...row,
      business_name: businessNames.get(row.id) ?? null,
    })),
    assignments: assignments.data ?? [],
    reviews: reviews.data ?? [],
    criteria: criteria.data ?? [],
    scores: scores.data ?? [],
    eligibility: eligibility.data ?? [],
    overrides: overrides.data ?? [],
    certifications: certifications.data ?? [],
  });
}

function scoreLabel(row: GrantRankingRow) {
  if (row.averageScore === null) return "—";
  return `${row.averageScore.toFixed(1)} / 100${row.state === "pending_reviews" ? " current" : ""}`;
}
function rangeLabel(row: GrantRankingRow) {
  if (row.minimumScore === null || row.maximumScore === null) return "—";
  if (row.completedScores.length === 1) return row.minimumScore.toFixed(1);
  return `${row.minimumScore.toFixed(1)}–${row.maximumScore.toFixed(1)}`;
}
function statusLabel(row: GrantRankingRow) {
  switch (row.state) {
    case "ranked":
      return row.eligibilityException
        ? "Review complete · Eligibility exception"
        : "Review complete";
    case "pending_reviews":
      return `${row.completedReviewCount ? "" : "No completed reviews yet · "}${row.outstandingReviewCount} review${row.outstandingReviewCount === 1 ? "" : "s"} outstanding`;
    case "score_unavailable":
      return "Score data unavailable · Administrator attention";
    case "no_assignments":
      return "No reviewers assigned";
    case "eligibility_unresolved":
      return "Eligibility unresolved";
  }
}

function GrantRankings() {
  const { selectedProgram, role } = useAuth();
  const [filter, setFilter] = useState("all");
  const admin =
    selectedProgram?.slug === "business_growth_grant" &&
    (selectedProgram.accessRole === "admin" || role === "admin");
  const query = useQuery({
    queryKey: ["grant-rankings-v2", selectedProgram?.programId],
    enabled: !!admin,
    queryFn: () => loadGrantRankings(selectedProgram!.programId),
  });
  if (!admin)
    return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;
  const rows = query.data ?? [];
  const shown = rows.filter(
    (row) =>
      filter === "all" ||
      (filter === "complete" && row.state === "ranked") ||
      (filter === "outstanding" && row.state === "pending_reviews") ||
      (filter === "unable" && !["ranked", "pending_reviews"].includes(row.state)),
  );
  const fullyReviewed = rows.filter((row) => row.reviewComplete).length;
  const outstanding = rows.reduce((sum, row) => sum + row.outstandingReviewCount, 0);
  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-warning font-semibold">
          Decision Support Only
        </p>
        <h1 className="font-display text-3xl mt-1">Business Growth Grant rankings</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-3xl">
          Rankings summarize completed reviewer scores and review progress. They do not
          automatically determine grant recipients. Final funding decisions remain with the
          authorized committee.
        </p>
      </header>
      {!query.isLoading && !query.isError && (
        <div
          className="grid grid-cols-2 gap-x-5 gap-y-3 border-y border-border py-4 text-sm sm:grid-cols-4"
          aria-label="Ranking summary"
        >
          <div>
            <span className="block text-muted-foreground">Applications</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span className="block text-muted-foreground">Fully reviewed</span>
            <strong>{fullyReviewed}</strong>
          </div>
          <div>
            <span className="block text-muted-foreground">Reviews outstanding</span>
            <strong>{outstanding}</strong>
          </div>
          <div>
            <span className="block text-muted-foreground">Eligible for ranking</span>
            <strong>{rows.filter((row) => row.rank !== null).length}</strong>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="ranking-status" className="text-sm font-medium">
          Review status
        </label>
        <select
          id="ranking-status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          className="min-h-11 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">All applications</option>
          <option value="complete">Ranked</option>
          <option value="outstanding">Reviews outstanding</option>
          <option value="unable">Unable to rank</option>
        </select>
      </div>
      {query.isError && (
        <Card className="p-6" role="alert">
          <p>Rankings could not be loaded.</p>
          <Button variant="outline" className="mt-3" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Card>
      )}
      {query.isLoading && <p role="status">Loading rankings…</p>}
      {!query.isLoading && !query.isError && rows.length === 0 && (
        <Card className="p-6">No Business Growth Grant applications yet.</Card>
      )}
      {!query.isLoading && !query.isError && rows.length > 0 && shown.length === 0 && (
        <Card className="p-6">No applications match this review status.</Card>
      )}
      {!query.isLoading &&
        !query.isError &&
        rows.length > 0 &&
        !rows.some((row) => row.rank !== null) && (
          <p className="text-sm text-muted-foreground">
            No applications have completed all required reviews and eligibility checks yet.
          </p>
        )}
      {!query.isLoading && !query.isError && shown.length > 0 && (
        <Card className="rounded-xl border-border/60 overflow-hidden">
          <div className="record-table-wrap overflow-x-auto">
            <table className="record-table w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="text-left px-4 py-3">
                    Rank
                  </th>
                  <th scope="col" className="text-left px-4 py-3">
                    Business
                  </th>
                  <th scope="col" className="text-right px-4 py-3">
                    Reviews
                  </th>
                  <th scope="col" className="text-right px-4 py-3">
                    Average score
                  </th>
                  <th scope="col" className="text-right px-4 py-3">
                    Scores
                  </th>
                  <th scope="col" className="text-left px-4 py-3">
                    Average tier
                  </th>
                  <th scope="col" className="text-left px-4 py-3">
                    Status
                  </th>
                  <th scope="col" className="text-left px-4 py-3">
                    Details
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map((row) => (
                  <tr key={row.applicationId}>
                    <td data-label="Rank" className="px-4 py-3 font-display text-xl">
                      {row.rank === null
                        ? row.state === "pending_reviews"
                          ? "Pending"
                          : "Unranked"
                        : `#${row.rank}`}
                    </td>
                    <td data-label="Business" data-primary className="px-4 py-3">
                      <span className="font-medium break-words">{row.businessName}</span>
                      <span className="block text-xs text-muted-foreground break-words">
                        {row.applicantName}
                      </span>
                    </td>
                    <td data-label="Reviews" className="px-4 py-3 text-right">
                      {row.completedReviewCount} of {row.assignedReviewCount}
                    </td>
                    <td
                      data-label={
                        row.state === "pending_reviews" ? "Current average" : "Average score"
                      }
                      className="px-4 py-3 text-right font-semibold"
                    >
                      {scoreLabel(row)}
                    </td>
                    <td
                      data-label={row.completedScores.length === 1 ? "Score" : "Score range"}
                      className="px-4 py-3 text-right"
                      aria-label={
                        row.completedScores.length > 1 && row.minimumScore !== null
                          ? `Scores from ${row.minimumScore.toFixed(1)} to ${row.maximumScore!.toFixed(1)}`
                          : undefined
                      }
                    >
                      {rangeLabel(row)}
                    </td>
                    <td data-label="Average tier" className="px-4 py-3">
                      {row.averageScoreTier?.tier ?? "Pending final review"}
                    </td>
                    <td data-label="Status" className="px-4 py-3">
                      <Badge variant="outline">{statusLabel(row)}</Badge>
                      <span className="block mt-1 text-xs text-muted-foreground">
                        {row.eligibilityException
                          ? "Eligibility exception"
                          : grantEligibilityStatusLabel[
                              row.eligibilityStatus as GrantEligibilityStatus
                            ]}
                        {row.uncertifiedReviewCount
                          ? ` · ${row.uncertifiedReviewCount} completed certification${row.uncertifiedReviewCount === 1 ? "" : "s"} not recorded`
                          : ""}
                        {row.scoreIssue ? ` · ${row.scoreIssue}` : ""}
                        {row.rank !== null &&
                        rows.filter((other) => other.rank === row.rank).length > 1
                          ? " · Tied rank"
                          : ""}
                      </span>
                    </td>
                    <td data-label="Details" data-action className="px-4 py-3">
                      <Link
                        to="/grants/$id"
                        params={{ id: row.applicationId }}
                        className="inline-flex min-h-11 items-center text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        View application
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
