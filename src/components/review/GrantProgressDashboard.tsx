import { useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { summarizeGrantProgress, type ProgressAllocation } from "@/lib/grant-progress-summary";
import { matchesDistributionProgress } from "@/lib/review-distribution";
import "./grant-progress-dashboard.css";

const statuses = [
  ["all", "All"],
  ["outstanding", "Outstanding reviews"],
  ["in_progress", "In progress"],
  ["completed", "Completed"],
  ["attention", "Needs attention"],
] as const;

export function GrantProgressDashboard({
  allocations,
  name,
  loading,
  error,
  conflicts,
  onConflict,
}: {
  allocations: ProgressAllocation[];
  name: (id: string) => string;
  loading: boolean;
  error: boolean;
  conflicts: { id: string; application_id: string }[];
  onConflict: (id: string) => void;
}) {
  const summary = summarizeGrantProgress(allocations);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [groupId, setGroupId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [reviewerGroup, setReviewerGroup] = useState<string | null>(null);
  const [applicationKey, setApplicationKey] = useState<string | null>(null);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const reviewerTrigger = useRef<HTMLButtonElement | null>(null);
  const applicationTrigger = useRef<HTMLButtonElement | null>(null);
  const percentage = summary.expected
    ? Math.round((100 * summary.completed) / summary.expected)
    : 0;
  const reviewers = [
    ...new Set(summary.groups.flatMap((group) => group.slots.map((slot) => slot.reviewerId))),
  ];
  const filtered = summary.entries.filter((entry) => {
    const complete = entry.slots.every((slot) => slot.completed);
    const attention =
      conflicts.some((conflict) => conflict.application_id === entry.applicationId) ||
      entry.slots.some((slot) => slot.held || slot.assignment?.lifecycle !== "active");
    return (
      matchesDistributionProgress(
        {
          text: [
            entry.applicationName,
            entry.groupName,
            ...entry.slots.map((slot) => name(slot.reviewerId)),
          ].join(" "),
          completed: entry.slots.filter((slot) => slot.completed).length,
          expected: entry.slots.length,
          issue: attention,
          groupId: entry.groupId,
          reviewerIds: entry.slots.map((slot) => slot.reviewerId),
        },
        {
          search,
          group: groupId,
          reviewer: reviewerId,
          status: status === "in_progress" ? "all" : status,
        },
      ) &&
      (status !== "in_progress" ||
        (!complete && entry.slots.some((slot) => slot.progress?.startedReviews)))
    );
  });
  const detailGroup = summary.groups.find((group) => group.id === reviewerGroup);
  const detailApplication = summary.entries.find(
    (entry) => `${entry.allocationId}:${entry.applicationId}` === applicationKey,
  );
  const filteredActive = !!(search || groupId || reviewerId || status !== "all");

  if (loading) return <p role="status">Loading overall review progress…</p>;
  if (error) return <p role="alert">Overall review progress is unavailable. Use Retry above.</p>;

  return (
    <div className="review-monitor">
      <section className="review-overview" aria-labelledby="overall-progress-heading">
        <div className="review-overview-main">
          <h2 id="overall-progress-heading">Overall review progress</h2>
          <p className="review-overview-count">
            <strong>
              {summary.completed}
              <span> / {summary.expected}</span>
            </strong>
            <span>independent reviews completed</span>
          </p>
          <div className="review-completion-track" aria-hidden="true">
            <div style={{ width: `${percentage}%` }} />
          </div>
          <p className="review-overview-caption">
            {summary.expected ? `${percentage}% complete` : "No allocated reviews yet"} · Across all
            applied allocations
          </p>
        </div>
        <dl className="review-overview-metrics">
          <div>
            <dt>Applications</dt>
            <dd>{summary.entries.length}</dd>
          </div>
          <div>
            <dt>Reviews remaining</dt>
            <dd>{summary.expected - summary.completed}</dd>
          </div>
          <div>
            <dt>Conflicts to resolve</dt>
            <dd>{conflicts.length}</dd>
          </div>
        </dl>
      </section>

      {summary.duplicateApplications.length > 0 && (
        <p role="alert" className="review-data-warning">
          Review data needs attention: an application appears in multiple applied allocations.
          Totals retain the existing allocation counts; check allocation history before relying on
          them.
        </p>
      )}

      <section className="review-workload" aria-labelledby="group-workload-heading">
        <div className="review-section-title">
          <h2 id="group-workload-heading">Group workload</h2>
          <p>Combined across applied allocations</p>
        </div>
        {!summary.groups.length ? (
          <p className="p-5 text-sm text-muted-foreground">
            Group workload will appear after an allocation is applied. Frozen previews are not
            assigned workload.
          </p>
        ) : (
          <table className="review-workload-table">
            <caption className="sr-only">
              Overall group workload and independent review completion
            </caption>
            <thead>
              <tr>
                <th scope="col">Reviewer group</th>
                <th scope="col">Applications</th>
                <th scope="col">Review completion</th>
                <th scope="col">Remaining</th>
                <th scope="col">
                  <span className="sr-only">Group actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.groups.map((group) => (
                <tr key={group.id}>
                  <th scope="row">
                    <span>{group.name}</span>
                    <small>
                      {group.reviewers.map((reviewer) => name(reviewer.id)).join(" / ")}
                    </small>
                  </th>
                  <td>
                    <span className="review-mobile-label" aria-hidden="true">
                      Applications
                    </span>
                    {group.entries.length}
                  </td>
                  <td>
                    <span className="review-mobile-label" aria-hidden="true">
                      Review completion
                    </span>
                    <span className="font-semibold">
                      {group.completed} / {group.expected}
                    </span>
                    <div className="review-completion-track" aria-hidden="true">
                      <div
                        style={{
                          width: `${group.expected ? (group.completed * 100) / group.expected : 0}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td>
                    <span className="review-mobile-label" aria-hidden="true">
                      Remaining
                    </span>
                    <strong>{group.remaining}</strong>
                    {(group.held > 0 || group.unavailable > 0) && (
                      <small>
                        {group.held > 0 && `${group.held} on conflict hold`}
                        {group.held > 0 && group.unavailable > 0 && " · "}
                        {group.unavailable > 0 && `${group.unavailable} inactive or missing`}
                      </small>
                    )}
                  </td>
                  <td className="review-group-actions">
                    <Button
                      variant="outline"
                      aria-label={`View applications for ${group.name}`}
                      onClick={() => {
                        setGroupId(group.id);
                        setStatus("all");
                        setSearch("");
                        setReviewerId("");
                        requestAnimationFrame(() => {
                          resultsHeading.current?.scrollIntoView({
                            block: "start",
                            behavior: "instant",
                          });
                          resultsHeading.current?.focus();
                        });
                      }}
                    >
                      View applications
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label={`View reviewers for ${group.name}`}
                      onClick={(event) => {
                        reviewerTrigger.current = event.currentTarget;
                        setReviewerGroup(group.id);
                      }}
                    >
                      View reviewers
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {summary.entries.length > 0 && (
        <section aria-labelledby="application-progress-heading" className="review-applications">
          <div className="review-filter-toolbar">
            <div className="review-section-title">
              <h2>Filter applications</h2>
              {filteredActive && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch("");
                    setStatus("all");
                    setGroupId("");
                    setReviewerId("");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
            <label className="review-search-label">
              Search applications or reviewers
              <span className="review-search-field">
                <Search size={18} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Application or reviewer name"
                />
              </span>
            </label>
            <fieldset className="review-status-filter">
              <legend>Review status</legend>
              <div>
                {statuses.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="review-select-filters">
              <label>
                Reviewer group
                <select value={groupId} onChange={(event) => setGroupId(event.target.value)}>
                  <option value="">All groups</option>
                  {summary.groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reviewer
                <select value={reviewerId} onChange={(event) => setReviewerId(event.target.value)}>
                  <option value="">All reviewers</option>
                  {reviewers.map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="review-section-title review-results-title">
            <h2 id="application-progress-heading" tabIndex={-1} ref={resultsHeading}>
              Application review progress
            </h2>
            <p role="status">
              {filtered.length} of {summary.entries.length} applications
            </p>
          </div>
          {!filtered.length ? (
            <p className="p-5 text-sm">
              No applications match these filters. Clear filters to see all allocated applications.
            </p>
          ) : (
            <ul className="review-application-list">
              {filtered.map((entry) => (
                <li key={`${entry.allocationId}:${entry.applicationId}`}>
                  <div>
                    <h3>{entry.applicationName}</h3>
                    <p>
                      {entry.groupName} ·{" "}
                      {entry.slots.map((slot) => name(slot.reviewerId)).join(" / ")}
                    </p>
                  </div>
                  <div className="review-application-status">
                    <strong>
                      {entry.slots.filter((slot) => slot.completed).length} / {entry.slots.length}{" "}
                      complete
                    </strong>
                    {entry.slots.some(
                      (slot) => slot.held || slot.assignment?.lifecycle !== "active",
                    ) && <span>Needs administrator attention</span>}
                  </div>
                  <Button
                    variant="outline"
                    aria-label={`View review details for ${entry.applicationName}`}
                    onClick={(event) => {
                      applicationTrigger.current = event.currentTarget;
                      setApplicationKey(`${entry.allocationId}:${entry.applicationId}`);
                    }}
                  >
                    View review details
                  </Button>
                  {conflicts
                    .filter((conflict) => conflict.application_id === entry.applicationId)
                    .map((conflict) => (
                      <Button
                        key={conflict.id}
                        variant="outline"
                        onClick={() => onConflict(conflict.id)}
                      >
                        Resolve conflict
                      </Button>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <Dialog
        open={!!detailGroup}
        onOpenChange={(open) => {
          if (!open) setReviewerGroup(null);
        }}
      >
        <DialogContent
          className="review-progress-dialog max-h-[85vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            reviewerTrigger.current?.focus();
          }}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{detailGroup?.name} — reviewer workload</DialogTitle>
            <DialogDescription>
              Reviews stay with their original allocation group after reassignment. Only original
              group reviewers are listed here. Replacement details are available in Conflicts.
            </DialogDescription>
          </DialogHeader>
          <ul className="divide-y">
            {detailGroup &&
              detailGroup.reviewers.map((reviewer) => {
                const reassigned = reviewer.reassignedCompleted + reviewer.reassignedOutstanding;
                return (
                  <li key={reviewer.id} className="space-y-1 py-3 text-sm">
                    <p className="break-words font-semibold">{name(reviewer.id)}</p>
                    <p>
                      {reviewer.completed} completed · {reviewer.outstanding} outstanding
                    </p>
                    {reassigned > 0 && (
                      <p className="text-muted-foreground">
                        {reassigned} reassigned: {reviewer.reassignedCompleted} completed ·{" "}
                        {reviewer.reassignedOutstanding} outstanding. Included in group progress.
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
          <Button variant="outline" onClick={() => setReviewerGroup(null)}>
            Close reviewer details
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detailApplication}
        onOpenChange={(open) => {
          if (!open) setApplicationKey(null);
        }}
      >
        <DialogContent
          className="review-progress-dialog max-h-[85vh] overflow-y-auto"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            applicationTrigger.current?.focus();
          }}
        >
          <DialogHeader className="pr-8">
            <DialogTitle>{detailApplication?.applicationName}</DialogTitle>
            <DialogDescription>
              {detailApplication?.groupName} · Independent review progress
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            {detailApplication?.slots.map((slot) => (
              <div key={slot.originalReviewerId} className="space-y-2 text-sm">
                <h3 className="break-words font-semibold">{name(slot.reviewerId)}</h3>
                {slot.held ? (
                  <p>Conflict reported — administrator action required</p>
                ) : slot.assignment?.lifecycle !== "active" ? (
                  <p>Inactive or missing assignment — administrator action required</p>
                ) : (
                  slot.progress && <ReviewProgress progress={slot.progress} />
                )}
                {slot.reviewerId !== slot.originalReviewerId && (
                  <p className="text-muted-foreground">
                    Replacement for {name(slot.originalReviewerId)}. Original review history
                    retained.
                  </p>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Allocation applied{" "}
            {allocations.find((allocation) => allocation.id === detailApplication?.allocationId)
              ?.applied_at
              ? new Date(
                  allocations.find(
                    (allocation) => allocation.id === detailApplication?.allocationId,
                  )!.applied_at!,
                ).toLocaleString()
              : "at an unavailable date"}
          </p>
          <Button variant="outline" onClick={() => setApplicationKey(null)}>
            Close review details
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
