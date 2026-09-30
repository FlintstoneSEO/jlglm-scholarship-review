import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ReviewQueue,
  reviewStatusLabel,
  type ReviewQueueColumn,
} from "@/components/review/ReviewQueue";
import { projectGrantQueue, type GrantQueueMetadata } from "@/lib/review-queue-projections";
import type { ReviewQueueItem } from "@/lib/review-domain";
import {
  grantEligibilityBadgeClass,
  grantEligibilityStatusLabel,
  type GrantEligibilityStatus,
} from "@/lib/grant-eligibility-display";
import {
  matchesGrantEligibilityFilter,
  parseGrantEligibilityFilter,
  type GrantEligibilityFilter,
} from "@/lib/grant-eligibility-filter";

export const Route = createFileRoute("/_app/grants/")({
  validateSearch: (search: Record<string, unknown>): { eligibility?: GrantEligibilityStatus } => {
    const filter = parseGrantEligibilityFilter(search.eligibility);
    return filter === "all" ? {} : { eligibility: filter };
  },
  component: GrantList,
});
type Item = ReviewQueueItem<GrantQueueMetadata>;
function GrantList() {
  const { selectedProgram, role } = useAuth();
  const { eligibility: selectedEligibility } = Route.useSearch();
  const eligibilityFilter = selectedEligibility ?? "all";
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [laraStatus, setLaraStatus] = useState("all");
  const [operatingModel, setOperatingModel] = useState("all");
  const [businessAge, setBusinessAge] = useState("all");
  const enabled = selectedProgram?.slug === "business_growth_grant";
  const isAdmin = role === "admin" || selectedProgram?.accessRole === "admin";
  const query = useQuery({
    queryKey: ["business-grants", selectedProgram?.programId],
    enabled,
    queryFn: async () => {
      const applicationsResult = await supabase
        .from("portal_applications")
        .select("*")
        .eq("program_id", selectedProgram!.programId)
        .order("submitted_at", { ascending: false });
      if (applicationsResult.error) throw applicationsResult.error;
      const ids = (applicationsResult.data ?? []).map((item) => item.id);
      const [detailsResult, assignmentsResult, reviewsResult, eligibilityResult] =
        await Promise.all([
          ids.length
            ? supabase
                .from("business_grant_application_details")
                .select(
                  "application_id, business_name, business_operating_model, business_age_range, lara_status",
                )
                .in("application_id", ids)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("reviewer_assignments")
            .select("id, application_id, reviewer_id")
            .eq("program_id", selectedProgram!.programId),
          supabase
            .from("program_reviews")
            .select("id, application_id, reviewer_id, status")
            .eq("program_id", selectedProgram!.programId),
          ids.length
            ? supabase
                .from("application_eligibility_reviews")
                .select("application_id, status")
                .in("application_id", ids)
            : Promise.resolve({ data: [], error: null }),
        ]);
      return {
        applications: applicationsResult.data ?? [],
        details: detailsResult.data ?? [],
        detailError: !!detailsResult.error,
        assignments: assignmentsResult.data ?? [],
        assignmentError: !!assignmentsResult.error,
        reviews: reviewsResult.data ?? [],
        reviewError: !!reviewsResult.error,
        eligibility: eligibilityResult.data ?? [],
        eligibilityError: !!eligibilityResult.error,
      };
    },
  });
  const projected = useMemo(
    () =>
      projectGrantQueue({
        applications: {
          data: query.data?.applications ?? null,
          state: query.isLoading ? "loading" : query.isError ? "error" : "ready",
        },
        details: {
          data: query.data?.details ?? null,
          state: query.data?.detailError
            ? "error"
            : query.isLoading
              ? "loading"
              : query.isError
                ? "error"
                : "ready",
        },
        assignments: {
          data: query.data?.assignments ?? null,
          state: query.data?.assignmentError
            ? "error"
            : query.isLoading
              ? "loading"
              : query.isError
                ? "error"
                : "ready",
        },
        reviews: {
          data: query.data?.reviews ?? null,
          state: query.data?.reviewError
            ? "error"
            : query.isLoading
              ? "loading"
              : query.isError
                ? "error"
                : "ready",
        },
      }),
    [query.data, query.isError, query.isLoading],
  );
  const eligibilityById = new Map(
    (query.data?.eligibility ?? []).map((row) => [row.application_id, row.status]),
  );
  const filtered = projected.items.filter((item) => {
    if (
      isAdmin &&
      !query.data?.eligibilityError &&
      !matchesGrantEligibilityFilter(
        eligibilityById.get(item.applicationId) as GrantEligibilityStatus | undefined,
        eligibilityFilter,
      )
    )
      return false;
    if (status !== "all" && item.status.nativeValue !== status) return false;
    if (laraStatus !== "all" && item.metadata.laraStatus !== laraStatus) return false;
    if (operatingModel !== "all" && item.metadata.operatingModel !== operatingModel) return false;
    if (businessAge !== "all" && item.metadata.businessAge !== businessAge) return false;
    const q = search.toLowerCase();
    return (
      !q ||
      item.applicantName.toLowerCase().includes(q) ||
      (item.applicantEmail ?? "").toLowerCase().includes(q) ||
      (item.metadata.businessName ?? "").toLowerCase().includes(q)
    );
  });
  const setEligibilityFilter = (value: GrantEligibilityFilter) => {
    navigate({
      to: "/grants",
      search: value === "all" ? {} : { eligibility: value },
      replace: true,
    });
  };
  const values = (field: keyof GrantQueueMetadata) =>
    [
      ...new Set(
        projected.items
          .map((i) => i.metadata[field])
          .filter((v): v is string => typeof v === "string"),
      ),
    ].sort();
  if (!enabled) return <ReviewQueue items={[]} state="unavailable" columns={[]} />;
  const columns: ReviewQueueColumn<Item>[] = [
    { id: "business", label: "Business", cell: (i) => i.metadata.businessName ?? "Unavailable" },
    { id: "age", label: "Business age", cell: (i) => i.metadata.businessAge ?? "—" },
    { id: "lara", label: "LARA status", cell: (i) => i.metadata.laraStatus ?? "—" },
    { id: "model", label: "Operating model", cell: (i) => i.metadata.operatingModel ?? "—" },
    { id: "score", label: "Average score", cell: (i) => i.metadata.averageScore ?? "—" },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business Growth Grants"
        title="Application review queue"
        description="Only applications assigned or otherwise authorized for your role are shown."
      />
      <Card className="p-4 sm:p-5">
        <div
          className={`grid min-w-0 gap-4 sm:grid-cols-2 ${isAdmin ? "xl:grid-cols-[minmax(0,1.5fr)_repeat(2,minmax(0,1fr))]" : "xl:grid-cols-2"}`}
        >
          <div className={`min-w-0 ${isAdmin ? "sm:col-span-2 xl:col-span-1" : "sm:col-span-1"}`}>
            <label htmlFor="grant-queue-search" className="mb-1.5 block text-sm font-semibold">
              Search applications
            </label>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="grant-queue-search"
                className="min-w-0 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Business, applicant, or email"
              />
            </div>
          </div>
          {isAdmin && (
            <div className="min-w-0">
              <label
                htmlFor="grant-eligibility-filter"
                className="mb-1.5 block text-sm font-semibold"
              >
                Eligibility
              </label>
              <Select
                value={eligibilityFilter}
                onValueChange={(value) => setEligibilityFilter(parseGrantEligibilityFilter(value))}
                disabled={query.isLoading || query.isError || query.data?.eligibilityError}
              >
                <SelectTrigger id="grant-eligibility-filter" className="w-full min-w-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All eligibility statuses</SelectItem>
                  {(["not_reviewed", "needs_clarification", "eligible", "ineligible"] as const).map(
                    (value) => (
                      <SelectItem key={value} value={value}>
                        {grantEligibilityStatusLabel[value]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
          <Filter
            id="grant-review-status-filter"
            title="Competitive review"
            value={status}
            set={setStatus}
            label="review states"
            values={["not_started", "in_progress", "completed"]}
          />
        </div>
        <details className="mt-4 border-t border-border pt-2 xl:hidden">
          <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            More filters
            {[laraStatus, operatingModel, businessAge].filter((value) => value !== "all").length >
              0 &&
              ` (${[laraStatus, operatingModel, businessAge].filter((value) => value !== "all").length} active)`}
          </summary>
          <div className="grid gap-4 pb-2 pt-2 sm:grid-cols-2">
            <Filter
              id="grant-lara-filter-mobile"
              title="LARA status"
              value={laraStatus}
              set={setLaraStatus}
              label="LARA states"
              values={values("laraStatus")}
            />
            <Filter
              id="grant-model-filter-mobile"
              title="Operating model"
              value={operatingModel}
              set={setOperatingModel}
              label="operating models"
              values={values("operatingModel")}
            />
            <Filter
              id="grant-age-filter-mobile"
              title="Business age"
              value={businessAge}
              set={setBusinessAge}
              label="business ages"
              values={values("businessAge")}
            />
          </div>
        </details>
        <div className="mt-5 hidden gap-4 border-t border-border pt-4 xl:grid xl:grid-cols-3">
          <Filter
            id="grant-lara-filter-desktop"
            title="LARA status"
            value={laraStatus}
            set={setLaraStatus}
            label="LARA states"
            values={values("laraStatus")}
          />
          <Filter
            id="grant-model-filter-desktop"
            title="Operating model"
            value={operatingModel}
            set={setOperatingModel}
            label="operating models"
            values={values("operatingModel")}
          />
          <Filter
            id="grant-age-filter-desktop"
            title="Business age"
            value={businessAge}
            set={setBusinessAge}
            label="business ages"
            values={values("businessAge")}
          />
        </div>
        {isAdmin && projected.state === "ready" && !query.data?.eligibilityError && (
          <p
            className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground"
            role="status"
          >
            Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
            {projected.items.length} applications
          </p>
        )}
        {isAdmin && query.data?.eligibilityError && (
          <p className="mt-4 border-t border-border pt-3 text-sm text-warning" role="status">
            Eligibility filtering is unavailable. Showing applications without that filter.
          </p>
        )}
      </Card>
      <ReviewQueue
        items={filtered}
        state={
          projected.state === "ready" && query.data?.eligibilityError
            ? "partial_error"
            : projected.state === "ready" && filtered.length === 0
              ? "empty"
              : projected.state
        }
        columns={columns}
        emptyMessage="No applications match these filters."
        onRetry={() => query.refetch()}
        showAdminWarnings={isAdmin}
        destinationSearch={
          isAdmin && eligibilityFilter !== "all"
            ? () => ({ eligibility: eligibilityFilter })
            : undefined
        }
        mobileTitle={(item) => item.metadata.businessName || item.applicantName}
        mobileDetail={(item) =>
          item.metadata.businessName ? item.applicantName : item.applicantEmail
        }
        reviewLabel={(item) => `Competitive review: ${reviewStatusLabel(item.status.value)}`}
        supplementalStatus={(item) => {
          const eligibilityStatus = eligibilityById.get(item.applicationId) as
            | GrantEligibilityStatus
            | undefined;
          return (
            <span
              className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${query.data?.eligibilityError ? "bg-muted text-muted-foreground" : grantEligibilityBadgeClass(eligibilityStatus ?? "not_reviewed")}`}
            >
              Eligibility:{" "}
              {query.data?.eligibilityError
                ? "Unavailable"
                : grantEligibilityStatusLabel[eligibilityStatus ?? "not_reviewed"]}
            </span>
          );
        }}
      />
    </div>
  );
}
function Filter({
  id,
  title,
  value,
  set,
  label,
  values,
}: {
  id: string;
  title: string;
  value: string;
  set: (v: string) => void;
  label: string;
  values: string[];
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {title}
      </label>
      <Select value={value} onValueChange={set}>
        <SelectTrigger id={id} className="w-full min-w-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label}</SelectItem>
          {values.map((v) => (
            <SelectItem key={v} value={v}>
              {v.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
