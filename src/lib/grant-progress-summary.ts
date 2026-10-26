import type { GroupSnapshot } from "./grant-committee.ts";
import type { projectGrantAllocationProgress } from "./grant-allocation-progress.ts";

type ProgressEntry = ReturnType<typeof projectGrantAllocationProgress>[number];
export type ProgressAllocation = {
  id: string;
  applied_at: string | null;
  sourceGroups: GroupSnapshot[];
  entries: ProgressEntry[];
  pool: { id: string; name: string }[];
};

export function summarizeGrantProgress(allocations: ProgressAllocation[]) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      entries: (ProgressEntry & { allocationId: string; applicationName: string })[];
    }
  >();
  const seenApplications = new Set<string>();
  const duplicates = new Set<string>();
  // Latest applied snapshot supplies the label, rather than today's mutable group name.
  for (const allocation of [...allocations].sort((a, b) =>
    (b.applied_at ?? "").localeCompare(a.applied_at ?? ""),
  )) {
    for (const entry of allocation.entries) {
      if (entry.pair === null) continue;
      const source = allocation.sourceGroups[entry.pair - 1];
      const id = source
        ? `group:${source.id}`
        : `legacy:${JSON.stringify([...entry.reviewers].sort())}`;
      let group = groups.get(id);
      if (!group) {
        group = { id, name: source?.name ?? `Reviewer pair ${entry.pair}`, entries: [] };
        groups.set(id, group);
      }
      if (seenApplications.has(entry.applicationId)) duplicates.add(entry.applicationId);
      seenApplications.add(entry.applicationId);
      group.entries.push({
        ...entry,
        allocationId: allocation.id,
        applicationName:
          allocation.pool.find((p) => p.id === entry.applicationId)?.name ??
          "Allocated application",
      });
    }
  }
  const rows = [...groups.values()].map((group) => {
    const slots = group.entries.flatMap((entry) => entry.slots);
    const completed = slots.filter((slot) => slot.completed).length;
    return {
      ...group,
      slots,
      // A replacement owns the review, but does not become a member of its source group.
      reviewers: [...new Set(slots.map((slot) => slot.originalReviewerId))].map((id) => {
        const allocated = slots.filter((slot) => slot.originalReviewerId === id);
        const direct = allocated.filter((slot) => slot.reviewerId === id);
        const reassigned = allocated.filter((slot) => slot.reviewerId !== id);
        return {
          id,
          completed: direct.filter((slot) => slot.completed).length,
          outstanding: direct.filter((slot) => !slot.completed).length,
          reassignedCompleted: reassigned.filter((slot) => slot.completed).length,
          reassignedOutstanding: reassigned.filter((slot) => !slot.completed).length,
        };
      }),
      completed,
      expected: slots.length,
      remaining: slots.length - completed,
      held: slots.filter((slot) => slot.held).length,
      unavailable: slots.filter((slot) => slot.assignment?.lifecycle !== "active").length,
    };
  });
  return {
    groups: rows,
    entries: rows.flatMap((group) =>
      group.entries.map((entry) => ({ ...entry, groupId: group.id, groupName: group.name })),
    ),
    completed: rows.reduce((total, group) => total + group.completed, 0),
    expected: rows.reduce((total, group) => total + group.expected, 0),
    duplicateApplications: [...duplicates],
  };
}
