import { ApplicationScopeFilter } from "@/components/review/ApplicationScopeFilter";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { loadGrantQueue } from "@/lib/grant-queue-client";
import {
  parseGrantQueueSearch,
  screeningViews,
  grantScreeningCounts,
  matchesGrantQueueSearch,
  type GrantQueueSearch,
} from "@/lib/grant-screening";
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
import { type GrantEligibilityFilter } from "@/lib/grant-eligibility-filter";

export const Route = createFileRoute("/_app/grants/")({
  validateSearch: parseGrantQueueSearch,
  component: GrantList,
});
type Item = ReviewQueueItem<GrantQueueMetadata>;
function GrantList() {
  const { selectedProgram, role } = useAuth();
  const queueSearch = Route.useSearch();
  const eligibilityFilter = queueSearch.eligibility ?? "all";
  const navigate = useNavigate();
  const updateFilters = (changes: Partial<Record<keyof GrantQueueSearch, string>>) =>
    navigate({
      to: "/grants",
      search: parseGrantQueueSearch({ ...queueSearch, ...changes }),
      replace: true,
    });
  const search = queueSearch.q ?? "";
  const status = queueSearch.scoring ?? "all";
  const laraStatus = queueSearch.lara ?? "all";
  const operatingModel = queueSearch.model ?? "all";
  const businessAge = queueSearch.age ?? "all";
  const setSearch = (q: string) => updateFilters({ q });
  const setStatus = (scoring: string) => updateFilters({ scoring });
  const setLaraStatus = (lara: string) => updateFilters({ lara });
  const setOperatingModel = (model: string) => updateFilters({ model });
  const setBusinessAge = (age: string) => updateFilters({ age });
  const enabled = selectedProgram?.slug === "business_growth_grant";
  const isAdmin = role === "admin" || selectedProgram?.accessRole === "admin";
  const effectiveScope = queueSearch.scope ?? (isAdmin ? "real" : "all");
  const query = useQuery({
    queryKey: ["business-grants", selectedProgram?.programId, effectiveScope],
    enabled,
    queryFn: () => loadGrantQueue(selectedProgram!.programId, effectiveScope),
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
  const filtered = projected.items.filter((item) =>
    matchesGrantQueueSearch(
      item,
      queueSearch,
      eligibilityById.get(item.applicationId),
      isAdmin && !query.data?.eligibilityError,
    ),
  );
  const counts = grantScreeningCounts(
    (query.data?.applications ?? []).map((application) => application.id),
    query.data?.eligibility ?? [],
  );
  const screeningAvailable = !!query.data && !query.isError && !query.data.eligibilityError;
  const setEligibilityFilter = (value: GrantEligibilityFilter) =>
    updateFilters({ eligibility: value });
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
      {isAdmin && (
        <ApplicationScopeFilter
          value={effectiveScope}
          onChange={(scope) => updateFilters({ scope })}
        />
      )}
      <PageHeader
        eyebrow="Business Growth Grants"
        title={isAdmin ? "Eligibility screening & review" : "Application review queue"}
        description={
          isAdmin
            ? "Start with eligibility screening, then track competitive scoring. Only applications authorized for your role are shown."
            : "Only applications assigned or otherwise authorized for your role are shown."
        }
      />
      {isAdmin && (
        <section
          aria-labelledby="screening-queue-heading"
          className="rounded-lg border border-border bg-card p-4 sm:p-5"
        >
          <h2 id="screening-queue-heading" className="font-semibold">
            Eligibility screening
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Needs screening includes new applications and checks awaiting reconfirmation. Counts
            cover all real applications in your authorized queue.
          </p>
          <div
            role="group"
            aria-label="Eligibility screening views"
            className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          >
            {screeningViews.map((view) => (
              <button
                key={view.value}
                type="button"
                aria-pressed={eligibilityFilter === view.value}
                disabled={!screeningAvailable}
                onClick={() => setEligibilityFilter(view.value)}
                className={`min-h-11 min-w-0 rounded-md border px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${eligibilityFilter === view.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
              >
                {view.label}{" "}
                <span className="ml-1">
                  (
                  {screeningAvailable
                    ? counts[view.value]
                    : query.isLoading
                      ? "..."
                      : "Unavailable"}
                  )
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
      <Card className="p-4 sm:p-5">
        <div className={`grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-2`}>
          <div className={`min-w-0 sm:col-span-1`}>
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
        destinationSearch={() => ({ ...queueSearch, section: "overview" })}
        actionLabel={(item) =>
          isAdmin &&
          screeningAvailable &&
          ["not_reviewed", "needs_clarification"].includes(
            eligibilityById.get(item.applicationId) ?? "not_reviewed",
          )
            ? "Review eligibility"
            : "View application"
        }
        mobileTitle={(item) => item.metadata.businessName || item.applicantName}
        mobileDetail={(item) =>
          item.metadata.businessName ? item.applicantName : item.applicantEmail
        }
        reviewLabel={(item) =>
          item.status.nativeValue === "not_started"
            ? "Scoring not started"
            : `Competitive review: ${reviewStatusLabel(item.status.value)}`
        }
        supplementalStatus={(item) => {
          const eligibilityStatus = eligibilityById.get(item.applicationId) as
            GrantEligibilityStatus | undefined;
          return (
            <span
              className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${query.data?.eligibilityError ? "bg-muted text-muted-foreground" : grantEligibilityBadgeClass(eligibilityStatus ?? "not_reviewed")}`}
            >
              Eligibility:{" "}
              {query.data?.eligibilityError
                ? "Unavailable"
                : (eligibilityStatus ?? "not_reviewed") === "not_reviewed"
                  ? "Needs eligibility screening"
                  : grantEligibilityStatusLabel[eligibilityStatus!]}
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
              {id === "grant-review-status-filter" && v === "not_started"
                ? "Scoring not started"
                : v.replaceAll("_", " ")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
