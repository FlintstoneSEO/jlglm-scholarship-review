import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { groupReadiness, type DistributionTab } from "@/lib/review-distribution";
import { GrantConflictResolution } from "@/components/review/GrantConflictResolution";
import { GrantReviewerGroups } from "@/components/review/GrantReviewerGroups";
import { useGrantReviewerGroups } from "@/lib/use-grant-reviewer-groups";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import { projectGrantAllocationProgress } from "@/lib/grant-allocation-progress";
import { GrantGroupWorkload } from "@/components/review/GrantGroupWorkload";
import {
  allocationEntries,
  allocationSummary,
  poolEntries,
  groupSnapshots,
  validPairRoster,
} from "@/lib/grant-committee";

type Profile = { id: string; full_name: string | null; email: string | null };
type Assignment = { id: string; application_id: string; reviewer_id: string; lifecycle: string };
type Review = { id: string; assignment_id: string; status: string };
const control =
  "mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
export function GrantCommitteeAllocation({
  programId,
  practiceSessionId,
  profiles,
  assignments,
  reviews,
  tab = "groups",
  attention,
  conflictId,
  onTabChange,
}: {
  programId: string;
  practiceSessionId?: string;
  profiles: Profile[];
  assignments: Assignment[];
  reviews: Review[];
  tab?: DistributionTab;
  attention?: boolean;
  conflictId?: string;
  onTabChange?: (tab: DistributionTab, attention?: boolean) => void;
}) {
  const qc = useQueryClient();
  const [localTab, setLocalTab] = useState<DistributionTab>("groups");
  const activeTab = onTabChange ? tab : localTab;
  const changeTab = (next: DistributionTab, showAttention?: boolean) => {
    setLocalTab(next);
    onTabChange?.(next, showAttention);
  };
  const attentionRef = useRef<HTMLDetailsElement>(null);
  const focusedConflict = useRef<string | null>(null);
  const [progressFilter, setProgressFilter] = useState("all");
  const [selectedPreviewId, setSelectedPreviewId] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(Array(3).fill(""));
  const groups = useGrantReviewerGroups(programId);
  const readiness = groupReadiness(
    groups.data ?? [],
    profiles.map((p) => p.id),
  );
  const chosenGroups = selectedGroups.map((id) => groups.data?.find((g) => g.id === id));
  const roster = chosenGroups.flatMap((g) => g?.members ?? []);
  const [confirmed, setConfirmed] = useState("");
  const rosterStamp = chosenGroups
    .map((g) => (g ? [g.id, g.revision, ...g.members].join(":") : ""))
    .join("|");
  const [mode, setMode] = useState("");
  const [capacity, setCapacity] = useState("13");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["grant-committee", programId, practiceSessionId],
    queryFn: async () => {
      const [previews, conflicts, resolutions, poolSummary] = await Promise.all([
        supabase
          .from("grant_allocation_previews")
          .select("*")
          .filter("practice_session_id", practiceSessionId ? "eq" : "is", practiceSessionId ?? null)
          .eq("program_id", programId)
          .order("created_at", { ascending: false }),
        supabase
          .from("grant_conflict_reports")
          .select("*")
          .eq("program_id", programId)
          .order("reported_at", { ascending: false }),
        supabase.from("grant_conflict_resolutions").select("*"),
        supabase.rpc("grant_distribution_pool_summary", {
          p_program: programId,
          ...(practiceSessionId ? { p_session: practiceSessionId } : {}),
        }),
      ]);
      if (previews.error || conflicts.error || resolutions.error || poolSummary.error)
        throw previews.error ?? conflicts.error ?? resolutions.error ?? poolSummary.error;
      return {
        previews: (previews.data ?? []).map((p) => ({
          ...p,
          entries: allocationEntries(p.allocation),
          pool: poolEntries(p.snapshot),
          sourceGroups: groupSnapshots(p.group_snapshot),
        })),
        poolSummary: poolSummary.data,
        resolutions: resolutions.data ?? [],
        conflicts: conflicts.data ?? [],
      };
    },
  });
  const preview =
    data?.previews.find((p) => p.id === selectedPreviewId) ??
    data?.previews.find((p) => !p.superseded_at);
  const groupStale =
    !!preview?.sourceGroups.length &&
    !groups.isLoading &&
    !groups.isError &&
    preview.sourceGroups.some((g) => {
      const current = groups.data?.find((row) => row.id === g.id);
      return (
        !current ||
        current.revision !== g.revision ||
        current.name !== g.name ||
        current.members.join() !== g.members.join()
      );
    });
  const groupCheckUnavailable =
    !!preview?.sourceGroups.length && (groups.isLoading || groups.isError);
  const historyProfiles = useQuery({
    queryKey: [
      "grant-distribution-identities",
      programId,
      data?.previews.map((p) => p.id).join(),
      data?.conflicts.map((r) => r.id).join(),
    ],
    enabled: !!data,
    queryFn: async () => {
      const ids = [
        ...new Set([
          ...(data?.previews.flatMap((p) => [
            ...p.roster,
            p.actor_id,
            ...(p.applied_by ? [p.applied_by] : []),
          ]) ?? []),
          ...assignments.map((a) => a.reviewer_id),
          ...(data?.conflicts.map((r) => r.reviewer_id) ?? []),
          ...(data?.resolutions.map((r) => r.resolved_by) ?? []),
        ]),
      ];
      if (!ids.length) return [];
      const result = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const name = (id: string) => {
    const p = [...profiles, ...(historyProfiles.data ?? [])].find((p) => p.id === id);
    return p?.full_name || p?.email || "Former or unavailable account";
  };
  const valid =
    !groups.isLoading &&
    !groups.isError &&
    new Set(selectedGroups).size === 3 &&
    chosenGroups.every((g) => g?.members.length === 2) &&
    validPairRoster(
      roster,
      profiles.map((p) => p.id),
    ) &&
    confirmed === rosterStamp &&
    !!confirmed &&
    (mode === "balanced" ||
      (mode === "fixed" && Number.isInteger(Number(capacity)) && Number(capacity) > 0));
  async function run(action: "preview" | "apply") {
    if (
      busy ||
      isLoading ||
      isError ||
      (action === "preview" && !valid) ||
      (action === "apply" && (!preview || !applyConfirmed || groupStale || groupCheckUnavailable))
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result =
        action === "preview"
          ? practiceSessionId
            ? await supabase.rpc("preview_grant_practice_allocation", {
                p_session: practiceSessionId,
                p_groups: selectedGroups,
                p_mode: mode,
                ...(mode === "fixed" ? { p_capacity: Number(capacity) } : {}),
              })
            : await supabase.rpc("preview_grant_group_allocation", {
                p_program: programId,
                p_groups: selectedGroups,
                p_mode: mode,
                ...(mode === "fixed" ? { p_capacity: Number(capacity) } : {}),
              })
          : await supabase.rpc("apply_grant_pair_allocation", { p_preview: preview!.id });
      if (result.error) throw result.error;
      if (action === "apply") changeTab("progress");
      setApplyConfirmed(false);
      if (action === "preview" && typeof result.data === "string")
        setSelectedPreviewId(result.data);
      await qc.invalidateQueries();
      setMessage(
        action === "preview"
          ? "Frozen preview created. Review coverage and both reviewers before Apply."
          : `Allocation applied. ${allocationSummary(preview!.entries).covered} applications were distributed across 3 reviewer groups. ${allocationSummary(preview!.entries).covered * 2} individual reviewer assignments are now active.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  const summary = preview && allocationSummary(preview.entries);
  const scopedConflicts = (data?.conflicts ?? []).filter((r) =>
    assignments.some((a) => a.application_id === r.application_id),
  );
  const unresolved = scopedConflicts.filter((r) => !r.resolved_at);
  const appliedAllocations = (data?.previews ?? []).filter(
    (p) =>
      p.applied_at &&
      (!practiceSessionId ||
        p.entries.some((entry) =>
          assignments.some((a) => a.application_id === entry.applicationId),
        )),
  );
  const allProgress = appliedAllocations.flatMap((p) =>
    projectGrantAllocationProgress(
      p.entries.filter((e) => e.pair !== null),
      assignments,
      reviews,
      data?.conflicts ?? [],
      data?.resolutions ?? [],
    ),
  );
  const expectedReviews = allProgress.flatMap((e) => e.slots).length;
  const completedReviews = allProgress.flatMap((e) => e.slots).filter((s) => s.completed).length;
  useEffect(() => {
    if (activeTab === "progress" && conflictId && data && focusedConflict.current !== conflictId) {
      const target = document.getElementById(`conflict-${conflictId}`);
      if (target) {
        target.focus();
        focusedConflict.current = conflictId;
      }
    }
  }, [activeTab, conflictId, data]);
  return (
    <div id="grant-committee-allocation" className="min-w-0 space-y-5">
      {isError && (
        <div role="alert">
          <p>Review distribution data could not be loaded.</p>
          <Button className="min-h-11" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {isLoading && <p role="status">Loading review distribution...</p>}
      {!!unresolved.length && (
        <Card className="space-y-2 p-4" role="status">
          <p className="font-semibold">
            {unresolved.length}{" "}
            {unresolved.length === 1 ? "conflict requires" : "conflicts require"} attention
          </p>
          <p className="text-sm">
            A reviewer reported a potential conflict. The affected review is held; the other
            reviewer can continue.
          </p>
          <Button
            className="min-h-11"
            onClick={() => {
              changeTab("progress", true);
              requestAnimationFrame(() => {
                if (attentionRef.current) {
                  attentionRef.current.open = true;
                  attentionRef.current.querySelector("summary")?.focus();
                }
              });
            }}
          >
            Review {unresolved.length === 1 ? "Conflict" : "Conflicts"}
          </Button>
        </Card>
      )}
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="break-words">
          {message}
        </p>
      )}
      <Tabs value={activeTab} onValueChange={(value) => changeTab(value as DistributionTab)}>
        <TabsList
          aria-label="Review Distribution workflow"
          className="grid h-auto w-full grid-cols-3"
        >
          <TabsTrigger
            className="min-h-11 whitespace-normal px-1 text-xs sm:text-sm"
            value="groups"
          >
            Reviewer Groups
          </TabsTrigger>
          <TabsTrigger
            className="min-h-11 whitespace-normal px-1 text-xs sm:text-sm"
            value="allocation"
          >
            Random Allocation
          </TabsTrigger>
          <TabsTrigger
            className="min-h-11 whitespace-normal px-1 text-xs sm:text-sm"
            value="progress"
          >
            Review Progress
          </TabsTrigger>
        </TabsList>
        <TabsContent value="groups" className="space-y-4">
          <GrantReviewerGroups key={programId} programId={programId} profiles={profiles} />
          {!groups.isLoading && !groups.isError && (
            <Card className="space-y-2 p-4" role="status">
              <h2 className="font-semibold">
                {readiness.ready ? "Ready for allocation" : "Action required"}
              </h2>
              <p>
                {groups.data?.length ?? 0} groups - {readiness.reviewers} eligible reviewers
              </p>
              {readiness.ready ? (
                <p>No duplicate reviewers.</p>
              ) : (
                <ul className="list-inside list-disc text-sm">
                  {readiness.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
              <Button
                className="min-h-11 whitespace-normal"
                variant="outline"
                onClick={() => changeTab("allocation")}
              >
                Continue to Random Allocation
              </Button>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="allocation">
          <Card className="min-w-0 space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-xl">Random Allocation</h2>
            {data?.poolSummary?.map((pool) => (
              <p key="pool-summary" className="font-semibold">
                {pool.eligible_applications} eligible applications ready for allocation -{" "}
                {groups.data?.length ?? 0} saved reviewer groups - {profiles.length} authorized
                reviewers
              </p>
            ))}
            {data?.poolSummary?.[0]?.eligible_applications === 0 && (
              <p>
                No applications are currently ready for allocation. Check application eligibility
                and existing assignment history before continuing.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Random allocation does not eliminate conflicts. Two reviewers independently score each
              allocated application. Administrator visibility includes program applications and
              scores; your competitive reviews require your own active assignments.
            </p>
            <p className="text-sm text-muted-foreground">
              Existing accounts with Grant reviewer/admin membership only. Reuse individual
              invitations and password setup if access is missing; allocation sends no invitations.
            </p>
            <fieldset disabled={busy || isLoading || isError} className="min-w-0 space-y-4">
              <legend className="font-semibold">Configure three pairs</legend>
              {[0, 1, 2].map((pair) => (
                <label key={pair} className="block min-w-0 text-sm">
                  Pair {pair + 1} saved group
                  <select
                    className={control}
                    aria-label={"Pair " + (pair + 1) + " saved group"}
                    value={selectedGroups[pair]}
                    disabled={groups.isLoading || groups.isError}
                    onChange={(e) => {
                      setSelectedGroups(
                        selectedGroups.map((id, i) => (i === pair ? e.target.value : id)),
                      );
                      setConfirmed("");
                    }}
                  >
                    <option value="">Choose a saved group</option>
                    {groups.data?.map((g) => (
                      <option
                        key={g.id}
                        value={g.id}
                        disabled={
                          g.members.length !== 2 ||
                          g.members.some((id) => !profiles.some((p) => p.id === id))
                        }
                      >
                        {g.name} ({g.members.length} members)
                      </option>
                    ))}
                  </select>
                  {chosenGroups[pair]?.members.map((id) => (
                    <span key={id} className="mt-1 block break-words text-xs text-muted-foreground">
                      {name(id)}
                    </span>
                  ))}
                </label>
              ))}
              {groups.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Group data unavailable. Retry groups before creating a preview.
                </p>
              )}
              {roster.length === 6 && new Set(roster).size !== 6 && (
                <p role="alert" className="text-sm text-destructive">
                  Selected groups overlap. Each of the six reviewers must be distinct.
                </p>
              )}
              <label className="flex min-h-11 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={!!confirmed && confirmed === rosterStamp}
                  onChange={(e) => setConfirmed(e.target.checked ? rosterStamp : "")}
                />
                I confirmed the six reviewer identities and Grant access against committee records.
              </label>
              <fieldset className="space-y-3">
                <legend className="font-semibold">Distribution strategy</legend>
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="distribution-strategy"
                    value="balanced"
                    checked={mode === "balanced"}
                    onChange={() => setMode("balanced")}
                  />
                  Balanced Distribution - cover all eligible applications
                </label>
                <details open={mode === "fixed" ? true : undefined}>
                  <summary className="min-h-11 cursor-pointer text-sm font-semibold focus-visible:outline focus-visible:outline-2">
                    Advanced: fixed capacity
                  </summary>
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="distribution-strategy"
                      value="fixed"
                      checked={mode === "fixed"}
                      onChange={() => setMode("fixed")}
                    />
                    Limit the number of applications per group
                  </label>
                  {mode === "fixed" && (
                    <label className="block text-sm">
                      Applications per group
                      <input
                        className={control}
                        type="number"
                        min="1"
                        step="1"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                      />
                    </label>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Applications beyond this limit remain unallocated. Inspect coverage before
                    applying.
                  </p>
                </details>
              </fieldset>
              <p className="text-sm">
                Distribute all eligible applications as evenly as possible across the reviewer
                groups. Each allocated application receives two independent reviews.
              </p>
              {mode === "fixed" && (
                <p role="status" className="text-sm">
                  Fixed capacity limits each group. Applications beyond that limit remain
                  unallocated and need a later distribution decision.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Pool: confirmed Eligible applications without assignments or review
                activity/history. Balanced coverage of 40 gives 14 / 13 / 13; fixed 13 leaves one
                visibly unallocated.
              </p>
              <Button
                disabled={!valid || busy}
                onClick={() => run("preview")}
                className="min-h-11 w-full whitespace-normal sm:w-auto"
              >
                {busy
                  ? "Working..."
                  : preview
                    ? "Explicitly reshuffle / replace preview"
                    : "Preview Random Allocation"}
              </Button>
            </fieldset>
            {isLoading && <p role="status">Loading saved previews and conflicts...</p>}
            {isError && (
              <div role="alert">
                <p>
                  Committee data could not be loaded. Verify the local/test migration is installed.
                </p>
                <Button onClick={() => refetch()} variant="outline">
                  Retry
                </Button>
              </div>
            )}
            {data && data.previews.length > 1 && (
              <label className="block text-sm">
                Saved allocation / preview
                <select
                  className={control}
                  value={preview?.id ?? ""}
                  onChange={(e) => {
                    setSelectedPreviewId(e.target.value);
                    setApplyConfirmed(false);
                  }}
                >
                  {data.previews.map((p) => (
                    <option key={p.id} value={p.id}>
                      {new Date(p.created_at).toLocaleString()} -{" "}
                      {p.applied_at ? "Applied" : p.superseded_at ? "Superseded" : "Frozen"}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {preview && summary && (
              <section
                className="min-w-0 space-y-3 border-t pt-4"
                aria-label="Frozen allocation preview"
              >
                <h3 className="font-semibold">
                  {preview.applied_at ? "Applied allocation" : "Frozen preview"}
                </h3>
                {!!preview.sourceGroups.length && (
                  <ul className="space-y-1 text-sm">
                    {preview.sourceGroups.map((g, i) => (
                      <li key={g.id} className="break-words">
                        {g.name}: {summary.pairs[i]} applications (frozen revision {g.revision})
                      </li>
                    ))}
                  </ul>
                )}
                {!preview.applied_at && groupStale && (
                  <p role="alert" className="text-sm text-destructive">
                    Stale preview: a saved group changed. Explicitly create a new preview before
                    Apply.
                  </p>
                )}
                {!preview.applied_at && groupCheckUnavailable && (
                  <p role="status" className="text-sm">
                    Saved group configuration must be loaded before Apply.
                  </p>
                )}
                <p className="break-words text-sm">
                  Created {new Date(preview.created_at).toLocaleString()} by{" "}
                  {name(preview.actor_id)}. Capacity:{" "}
                  {preview.capacity_mode === "balanced"
                    ? "balanced coverage"
                    : preview.capacity + " per pair"}
                  .{" "}
                  {preview.applied_at &&
                    "Applied " +
                      new Date(preview.applied_at).toLocaleString() +
                      " by " +
                      name(preview.applied_by ?? "")}
                  .
                </p>
                <p className="text-sm">
                  {preview.pool.length} total applications - {summary.pool} in pool -{" "}
                  {summary.covered} covered - {summary.unallocated} unallocated -{" "}
                  {preview.pool.filter((p) => p.exclusion).length} excluded
                </p>
                <ul className="space-y-2 text-sm">
                  {summary.pairs.map((count, i) => (
                    <li key={i} className="break-words">
                      Pair {i + 1}: {count} applications -{" "}
                      {preview.roster
                        .slice(i * 2, i * 2 + 2)
                        .map(name)
                        .join(" / ")}
                    </li>
                  ))}
                </ul>
                {!summary.pool && (
                  <p>
                    No confirmed Eligible applications without assignments or activity are
                    available.
                  </p>
                )}
                <ul className="divide-y border-y">
                  {preview.entries.map((entry) => {
                    const pool = preview.pool.find((p) => p.id === entry.applicationId);
                    const individual = projectGrantAllocationProgress(
                      [entry],
                      assignments,
                      reviews,
                      data?.conflicts ?? [],
                      data?.resolutions ?? [],
                    )[0].slots;
                    const completed = individual.filter((p) => p.completed).length;
                    return (
                      <li key={entry.applicationId} className="min-w-0 space-y-2 py-3 text-sm">
                        <p className="break-words font-semibold">
                          {pool?.name || entry.applicationId} -{" "}
                          {entry.pair ? "Pair " + entry.pair : "UNALLOCATED: fixed capacity"}
                        </p>
                        {individual.map(
                          ({ reviewerId, originalReviewerId, assignment, progress }) => (
                            <div key={reviewerId} className="break-words">
                              <p>
                                {name(reviewerId)}{" "}
                                {originalReviewerId !== reviewerId &&
                                  ` — replacement for ${name(originalReviewerId)}`}
                                {assignment && assignment.lifecycle !== "active"
                                  ? "- suspended"
                                  : ""}
                              </p>
                              {preview.applied_at && progress && (
                                <ReviewProgress progress={progress} />
                              )}
                            </div>
                          ),
                        )}
                        {preview.applied_at && entry.pair && (
                          <p>
                            {completed}/2 independent active reviews completed.{" "}
                            {individual.some((p) => !p.assignment) &&
                              "Assignment missing; administrator follow-up required."}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <details>
                  <summary className="min-h-11 cursor-pointer font-semibold">
                    Excluded applications ({preview.pool.filter((p) => p.exclusion).length})
                  </summary>
                  <ul className="space-y-2 text-sm">
                    {preview.pool
                      .filter((p) => p.exclusion)
                      .map((p) => (
                        <li className="break-words" key={p.id}>
                          {p.name}: {p.exclusion} - {p.eligibility}
                        </li>
                      ))}
                  </ul>
                </details>
                {preview.superseded_at && (
                  <p role="status">
                    Stale preview: superseded by an explicit reshuffle. It cannot be applied.
                  </p>
                )}
                {!preview.applied_at && !preview.superseded_at && (
                  <>
                    <label className="flex min-h-11 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={applyConfirmed}
                        onChange={(e) => setApplyConfirmed(e.target.checked)}
                      />
                      I reviewed this frozen roster, explicit capacity choice, coverage, exclusions,
                      and both reviewers per application.
                    </label>
                    <Button
                      disabled={
                        !applyConfirmed ||
                        !summary.covered ||
                        busy ||
                        isLoading ||
                        isError ||
                        groupStale ||
                        groupCheckUnavailable
                      }
                      onClick={() => run("apply")}
                      className="min-h-11 w-full whitespace-normal sm:w-auto"
                    >
                      {busy ? "Applying..." : "Apply Allocation"}
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Apply revalidates the snapshot and memberships. Stale previews fail without
                      partial assignments. Reopening does not reshuffle.
                    </p>
                  </>
                )}
              </section>
            )}
          </Card>
        </TabsContent>
        <TabsContent value="progress" className="space-y-5">
          {historyProfiles.isError && (
            <p role="alert">
              Historical reviewer names could not be loaded.{" "}
              <Button onClick={() => historyProfiles.refetch()} variant="outline">
                Retry names
              </Button>
            </p>
          )}
          {!isLoading && !isError && (
            <Card className="space-y-2 p-4">
              <h2 className="font-display text-xl">Review Progress</h2>
              <p>
                {allProgress.length} applications - {expectedReviews} expected independent reviews
              </p>
              <p className="font-semibold">
                {completedReviews} completed - {expectedReviews - completedReviews} remaining
              </p>
              <p>
                {appliedAllocations.reduce((count, p) => count + (p.sourceGroups.length || 3), 0)}{" "}
                frozen groups - {unresolved.length} conflicts require attention
              </p>
            </Card>
          )}
          <section className="min-w-0 space-y-4" aria-label="Group workload and progress">
            <h2 className="font-display text-xl">Group workload and progress</h2>
            {isLoading && (
              <p role="status" className="text-sm">
                Loading group progress...
              </p>
            )}
            {isError && (
              <p role="alert" className="text-sm">
                Group progress is unavailable. Use Retry above.
              </p>
            )}
            {!isLoading &&
              !isError &&
              !data?.previews.some(
                (p) =>
                  p.applied_at &&
                  (!practiceSessionId ||
                    p.entries.some((entry) =>
                      assignments.some((a) => a.application_id === entry.applicationId),
                    )),
              ) && (
                <p className="text-sm text-muted-foreground">
                  Group progress will appear after an allocation is applied. Frozen previews are not
                  assigned workload.
                </p>
              )}
            {(data?.previews ?? [])
              .filter(
                (p) =>
                  p.applied_at &&
                  (!practiceSessionId ||
                    p.entries.some((entry) =>
                      assignments.some((a) => a.application_id === entry.applicationId),
                    )),
              )
              .map((applied) => (
                <div key={applied.id} className="min-w-0 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Allocation applied {new Date(applied.applied_at!).toLocaleString()}
                  </p>
                  <GrantGroupWorkload
                    entries={projectGrantAllocationProgress(
                      applied.entries,
                      assignments,
                      reviews,
                      data?.conflicts ?? [],
                      data?.resolutions ?? [],
                    )}
                    sourceGroups={applied.sourceGroups}
                    roster={applied.roster}
                    name={name}
                  />
                </div>
              ))}
          </section>
          {!!allProgress.length && (
            <section className="space-y-3" aria-label="Application review progress">
              <label className="block text-sm">
                Show applications
                <select
                  className={control}
                  value={progressFilter}
                  onChange={(e) => setProgressFilter(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="attention">Needs Attention</option>
                </select>
              </label>
              <ul className="divide-y">
                {allProgress
                  .filter((entry) => {
                    const issue =
                      unresolved.some((r) => r.application_id === entry.applicationId) ||
                      entry.slots.some((slot) => slot.assignment?.lifecycle !== "active");
                    const complete = entry.slots.every((slot) => slot.completed);
                    return (
                      progressFilter === "all" ||
                      (progressFilter === "attention" && issue) ||
                      (progressFilter === "completed" && complete) ||
                      (progressFilter === "in_progress" &&
                        !complete &&
                        entry.slots.some((slot) => slot.progress?.startedReviews))
                    );
                  })
                  .map((entry) => (
                    <li key={entry.applicationId} className="space-y-2 py-3 text-sm">
                      <h3 className="break-words font-semibold">
                        {data?.previews
                          .flatMap((p) => p.pool)
                          .find((p) => p.id === entry.applicationId)?.name ||
                          "Allocated application"}
                      </h3>
                      <p>
                        {appliedAllocations.find((p) =>
                          p.entries.some((e) => e.applicationId === entry.applicationId),
                        )?.sourceGroups[(entry.pair ?? 1) - 1]?.name || `Group ${entry.pair}`}
                      </p>
                      {entry.slots.map((slot) => (
                        <div key={slot.originalReviewerId} className="break-words">
                          <p>
                            {name(slot.reviewerId)}
                            {slot.reviewerId !== slot.originalReviewerId
                              ? ` - replacement for ${name(slot.originalReviewerId)}`
                              : ""}
                          </p>
                          {unresolved.some((r) => r.assignment_id === slot.assignment?.id) ? (
                            <p className="font-semibold">
                              Conflict reported - administrator action required
                            </p>
                          ) : slot.assignment?.lifecycle !== "active" ? (
                            <p>Inactive or missing assignment - administrator action required</p>
                          ) : (
                            slot.progress && <ReviewProgress progress={slot.progress} />
                          )}
                          {slot.reviewerId !== slot.originalReviewerId && (
                            <p>
                              {name(slot.originalReviewerId)} was replaced on this application.
                              Original review history retained.
                            </p>
                          )}
                        </div>
                      ))}
                    </li>
                  ))}
              </ul>
            </section>
          )}
          <details
            ref={attentionRef}
            open={attention || !!conflictId}
            className="min-w-0 rounded-xl border bg-card p-4"
          >
            <summary className="min-h-11 cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2">
              Needs Attention ({unresolved.length})
            </summary>
            <div className="min-w-0 space-y-3 pt-3">
              <h2 className="font-display text-xl">Conflict reports</h2>
              <p className="text-sm text-muted-foreground">
                Resolve each report with a recorded reason. Replace only the conflicted reviewer;
                their historical review is retained and excluded from totals. The unaffected
                reviewer continues. Do not use Reset Review to resolve a conflict.
              </p>
              {data && !scopedConflicts.some((r) => !r.resolved_at) && (
                <p className="text-sm">No unresolved reports.</p>
              )}
              <details>
                <summary className="min-h-11 cursor-pointer font-semibold">
                  Resolved conflict history
                </summary>
                <ul className="space-y-3">
                  {scopedConflicts
                    .filter((r) => r.resolved_at)
                    .map((r) => {
                      const z = data?.resolutions.find((z) => z.report_id === r.id);
                      const replacement = assignments.find(
                        (a) => a.id === z?.replacement_assignment_id,
                      );
                      return (
                        <li key={r.id} className="break-words text-sm">
                          <p>
                            {name(r.reviewer_id)} · {z?.decision} ·{" "}
                            {z?.resolved_at && new Date(z.resolved_at).toLocaleString()} · by{" "}
                            {z && name(z.resolved_by)}
                          </p>
                          <p>{z?.reason}</p>
                          {replacement && (
                            <p>
                              Replacement: {name(replacement.reviewer_id)}. Original review retained
                              as excluded history.
                            </p>
                          )}
                        </li>
                      );
                    })}
                </ul>
              </details>
              <ul className="divide-y">
                {scopedConflicts
                  .filter((r) => !r.resolved_at)
                  .map((r) => (
                    <li
                      key={r.id}
                      id={`conflict-${r.id}`}
                      tabIndex={-1}
                      className="space-y-1 py-3 text-sm focus-visible:outline focus-visible:outline-2"
                    >
                      <p className="break-words font-semibold">
                        {data?.previews
                          .flatMap((p) => p.pool)
                          .find((p) => p.id === r.application_id)?.name ?? r.application_id}{" "}
                        - {name(r.reviewer_id)}
                      </p>
                      <p className="text-sm">
                        {data?.previews
                          .flatMap((p) => p.entries.map((e) => ({ e, groups: p.sourceGroups })))
                          .find(({ e }) => e.applicationId === r.application_id && e.pair)?.groups[
                          (data?.previews
                            .flatMap((p) => p.entries)
                            .find((e) => e.applicationId === r.application_id)?.pair ?? 1) - 1
                        ]?.name ?? "Individual assignment"}{" "}
                        - Conflict reported - Other reviewer continues
                      </p>
                      <p>
                        {new Date(r.reported_at).toLocaleString()} - Reviewer-specific competitive
                        hold
                      </p>
                      <p className="whitespace-pre-wrap break-words">{r.reason}</p>
                      <GrantConflictResolution
                        reportId={r.id}
                        onResolved={async () => {
                          await qc.invalidateQueries();
                        }}
                      />
                    </li>
                  ))}
              </ul>
            </div>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
