import type { AllocationEntry, GroupSnapshot } from "./grant-committee.ts";
import { projectAssignmentProgress } from "./review-queue-projections.ts";
import { latestTransfer, type TransferOwnership } from "./grant-group-transfer.ts";

type Assignment = { id: string; application_id: string; reviewer_id: string; lifecycle: string };
type Review = { id: string; assignment_id: string; status: string };
type Conflict = { id: string; assignment_id: string; resolved_at?: string | null };
type Resolution = { report_id: string; decision: string; replacement_assignment_id: string | null };

/** Reconcile current ownership, including transfers of individually assigned work. */
export function projectGrantCurrentAllocations(input: {
  allocations: {
    id: string;
    applied_at: string | null;
    sourceGroups: GroupSnapshot[];
    entries: AllocationEntry[];
    pool: { id: string; name: string }[];
  }[];
  activeApplicationIds: ReadonlySet<string>;
  assignments: Assignment[];
  reviews: Review[];
  conflicts: Conflict[];
  resolutions: Resolution[];
  transfers: TransferOwnership[];
  applicationName: (id: string) => string;
}) {
  const {
    allocations,
    activeApplicationIds,
    assignments,
    reviews,
    conflicts,
    resolutions,
    transfers,
    applicationName,
  } = input;
  const project = (entries: AllocationEntry[]) =>
    projectGrantAllocationProgress(
      entries,
      assignments,
      reviews,
      conflicts,
      resolutions,
      transfers,
    );
  const allocated = new Set(
    allocations.flatMap((a) =>
      a.entries.filter((e) => e.pair !== null).map((e) => e.applicationId),
    ),
  );
  return [
    ...allocations.map((a) => ({
      ...a,
      pool: a.pool.map((p) => ({ ...p, name: applicationName(p.id) })),
      entries: project(activeAllocationEntries(a.entries, activeApplicationIds)),
    })),
    ...transfers
      .filter(
        (t) =>
          latestTransfer(transfers, t.application_id)?.id === t.id &&
          activeApplicationIds.has(t.application_id) &&
          !allocated.has(t.application_id),
      )
      .map((t) => ({
        id: `transfer:${t.id}`,
        applied_at: t.occurred_at,
        sourceGroups: [t.group_snapshot],
        pool: [{ id: t.application_id, name: applicationName(t.application_id) }],
        entries: project([
          { applicationId: t.application_id, pair: 1, reviewers: t.group_snapshot.members },
        ]),
      })),
  ];
}

/** Project current work without rewriting the frozen allocation snapshot. */
export function activeAllocationEntries(
  entries: AllocationEntry[],
  activeApplicationIds: ReadonlySet<string>,
) {
  return entries.filter(
    (entry) => entry.pair !== null && activeApplicationIds.has(entry.applicationId),
  );
}

export function projectGrantAllocationProgress(
  entries: AllocationEntry[],
  assignments: Assignment[],
  reviews: Review[],
  conflicts: Conflict[],
  resolutions: Resolution[],
  transfers: TransferOwnership[] = [],
) {
  return entries.map((entry) => {
    const transfer = latestTransfer(transfers, entry.applicationId);
    const currentReviewers = transfer?.group_snapshot.members ?? entry.reviewers;
    return {
      ...entry,
      currentGroup: transfer?.group_snapshot,
      transferId: transfer?.id,
      slots: currentReviewers.map((originalReviewerId) => {
        let assignment = assignments.find(
          (a) => a.application_id === entry.applicationId && a.reviewer_id === originalReviewerId,
        );
        const seen = new Set<string>();
        while (assignment?.lifecycle === "suspended" && !seen.has(assignment.id)) {
          seen.add(assignment.id);
          const reportIds = new Set(
            conflicts.filter((r) => r.assignment_id === assignment!.id).map((r) => r.id),
          );
          const resolution = resolutions.find(
            (r) => reportIds.has(r.report_id) && r.decision === "replaced",
          );
          const next = assignments.find(
            (a) =>
              a.id === resolution?.replacement_assignment_id &&
              a.application_id === entry.applicationId,
          );
          if (!next) break;
          assignment = next;
        }
        const reviewerId = assignment?.reviewer_id ?? originalReviewerId;
        const review = assignment && reviews.find((r) => r.assignment_id === assignment.id);
        const progress = assignment
          ? projectAssignmentProgress(
              "business_growth_grant",
              assignment,
              review
                ? [{ ...review, application_id: entry.applicationId, reviewer_id: reviewerId }]
                : [],
              [],
            )
          : null;
        const held =
          !!assignment &&
          conflicts.some((c) => c.assignment_id === assignment.id && c.resolved_at === null);
        const completed =
          assignment?.lifecycle === "active" && !held && progress?.completedReviews === 1;
        return { originalReviewerId, reviewerId, assignment, progress, completed, held };
      }),
    };
  });
}
