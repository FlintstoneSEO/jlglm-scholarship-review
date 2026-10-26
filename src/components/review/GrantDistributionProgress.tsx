import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import type { projectGrantAllocationProgress } from "@/lib/grant-allocation-progress";
import { matchesDistributionProgress } from "@/lib/review-distribution";

type Entry = ReturnType<typeof projectGrantAllocationProgress>[number];
type Allocation = {
  entries: { applicationId: string }[];
  pool: { id: string; name: string }[];
  sourceGroups: { id: string; name: string }[];
};
const control =
  "min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2";

export function GrantDistributionProgress({
  entries,
  allocations,
  conflicts,
  name,
  onConflict,
}: {
  entries: Entry[];
  allocations: Allocation[];
  conflicts: { id: string; application_id: string }[];
  name: (id: string) => string;
  onConflict: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [group, setGroup] = useState("");
  const [reviewer, setReviewer] = useState("");
  const rows = entries.map((entry) => {
    const allocation = allocations.find((a) =>
      a.entries.some((e) => e.applicationId === entry.applicationId),
    );
    const assignedGroup = allocation?.sourceGroups[(entry.pair ?? 1) - 1];
    const title =
      allocation?.pool.find((p) => p.id === entry.applicationId)?.name || "Allocated application";
    const conflict = conflicts.find((r) => r.application_id === entry.applicationId);
    return {
      entry,
      title,
      assignedGroup,
      conflict,
      completed: entry.slots.filter((s) => s.completed).length,
      issue: !!conflict || entry.slots.some((s) => s.assignment?.lifecycle !== "active"),
    };
  });
  const visible = rows.filter((row) =>
    matchesDistributionProgress(
      {
        text: [
          row.title,
          row.assignedGroup?.name,
          ...row.entry.slots.map((s) => name(s.reviewerId)),
        ].join(" "),
        completed: row.completed,
        expected: row.entry.slots.length,
        issue: row.issue,
        groupId: row.assignedGroup?.id ?? "",
        reviewerIds: row.entry.slots.map((s) => s.reviewerId),
      },
      { search, status, group, reviewer },
    ),
  );
  const groupOptions = [
    ...new Map(allocations.flatMap((a) => a.sourceGroups).map((g) => [g.id, g])).values(),
  ];
  const reviewers = [...new Set(entries.flatMap((e) => e.slots.map((s) => s.reviewerId)))];
  return (
    <section aria-label="Application review progress" className="min-w-0 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          Search applications or reviewers
          <input
            className={control}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          Review status
          <select className={control} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All applications</option>
            <option value="outstanding">Outstanding reviews</option>
            <option value="completed">Completed</option>
            <option value="attention">Needs Attention</option>
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Reviewer group
          <select className={control} value={group} onChange={(e) => setGroup(e.target.value)}>
            <option value="">All groups</option>
            {groupOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          Reviewer
          <select
            className={control}
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
          >
            <option value="">All reviewers</option>
            {reviewers.map((id) => (
              <option key={id} value={id}>
                {name(id)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p role="status" className="text-sm text-muted-foreground">
        {visible.length} of {rows.length} applications
      </p>
      {!visible.length && (
        <p className="rounded-lg border p-4 text-sm">
          {rows.length
            ? "No applications match these filters."
            : "Application progress appears after an allocation is finalized."}
        </p>
      )}
      <ul className="divide-y rounded-lg border bg-card">
        {visible.map(({ entry, title, assignedGroup, completed, issue, conflict }) => (
          <li key={entry.applicationId} className="min-w-0 p-3 sm:p-4">
            <details>
              <summary className="grid min-h-11 cursor-pointer gap-2 focus-visible:outline focus-visible:outline-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1fr)]">
                <span className="min-w-0">
                  <span className="block break-words text-sm font-semibold">{title}</span>
                  <span className="text-xs text-muted-foreground">
                    {assignedGroup?.name ?? `Group ${entry.pair}`} · View details
                  </span>
                </span>
                <span className="min-w-0 break-words text-sm">
                  {entry.slots.map((s) => name(s.reviewerId)).join(" / ")}
                </span>
                <span className="text-sm">
                  <span className="block font-medium">
                    {completed}/{entry.slots.length} complete
                  </span>
                  {issue && <span className="block text-xs">Needs attention</span>}
                </span>
              </summary>
              <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2">
                {entry.slots.map((slot) => (
                  <div key={slot.originalReviewerId} className="min-w-0 space-y-1 text-sm">
                    <p className="break-words font-medium">{name(slot.reviewerId)}</p>
                    {slot.held ? (
                      <p>Conflict reported — review on hold</p>
                    ) : slot.assignment?.lifecycle !== "active" ? (
                      <p>Inactive or missing assignment — administrator action required</p>
                    ) : (
                      slot.progress && <ReviewProgress progress={slot.progress} />
                    )}
                    {slot.reviewerId !== slot.originalReviewerId && (
                      <p className="break-words text-xs text-muted-foreground">
                        Replaced {name(slot.originalReviewerId)}. Original review history retained.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </details>
            {conflict && (
              <Button
                variant="outline"
                className="mt-2 min-h-11"
                onClick={() => onConflict(conflict.id)}
              >
                Resolve conflict
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
