import { transferOwnershipSchema } from "@/lib/grant-group-transfer";
import { Link } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  groupReadiness,
  groupUnavailableForSlot,
  type DistributionTab,
} from "@/lib/review-distribution";
import { GrantConflictResolution } from "@/components/review/GrantConflictResolution";
import { GrantReviewerGroups } from "@/components/review/GrantReviewerGroups";
import { useGrantReviewerGroups } from "@/lib/use-grant-reviewer-groups";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  projectGrantCurrentAllocations,
  projectGrantAllocationProgress,
} from "@/lib/grant-allocation-progress";
import { GrantProgressDashboard } from "@/components/review/GrantProgressDashboard";
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
  applications = [],
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
  applications?: { id: string; display_name: string; applicant_name: string }[];
  assignments: Assignment[];
  reviews: Review[];
  tab?: DistributionTab;
  attention?: boolean;
  conflictId?: string;
  onTabChange?: (tab: DistributionTab, attention?: boolean) => void;
}) {
  const qc = useQueryClient();
  const [localTab, setLocalTab] = useState<DistributionTab>("groups");
  const requestedTab = onTabChange ? tab : localTab;
  const activeTab =
    requestedTab === "progress" && (attention || conflictId) ? "conflicts" : requestedTab;
  const changeTab = (next: DistributionTab, showAttention?: boolean) => {
    setMessage("");
    setLocalTab(next);
    onTabChange?.(next, showAttention);
  };
  const [selectedConflict, setSelectedConflict] = useState(conflictId ?? "");
  const [allocationStep, setAllocationStep] = useState<"choose" | "review" | "confirm">("choose");
  const focusedConflict = useRef<string | null>(null);

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
  const [mode, setMode] = useState("balanced");
  const [capacity, setCapacity] = useState("13");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [applyConfirmed, setApplyConfirmed] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["grant-committee", programId, practiceSessionId],
    queryFn: async () => {
      const [previews, conflicts, resolutions, poolSummary, transfers] = await Promise.all([
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
        supabase
          .from("grant_group_transfer_events")
          .select("id,application_id,occurred_at,group_snapshot")
          .eq("program_id", programId),
      ]);
      if (transfers.error) throw transfers.error;
      if (previews.error || conflicts.error || resolutions.error || poolSummary.error)
        throw previews.error ?? conflicts.error ?? resolutions.error ?? poolSummary.error;
      return {
        previews: (previews.data ?? []).map((p) => ({
          ...p,
          entries: allocationEntries(p.allocation),
          pool: poolEntries(p.snapshot),
          sourceGroups: groupSnapshots(p.group_snapshot),
        })),
        transfers: transferOwnershipSchema.parse(transfers.data ?? []),
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
  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const applicationName = (id: string) =>
    applicationById.get(id)?.display_name ||
    data?.previews.flatMap((p) => p.pool).find((p) => p.id === id)?.name ||
    id;
  const applicantName = (id: string) => applicationById.get(id)?.applicant_name;
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
      (action === "apply" &&
        (!preview ||
          !!preview.applied_at ||
          !!preview.superseded_at ||
          !applyConfirmed ||
          groupStale ||
          groupCheckUnavailable))
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
      if (action === "preview" && typeof result.data === "string") {
        setSelectedPreviewId(result.data);
        setAllocationStep("review");
      }
      await qc.invalidateQueries();
      setMessage(
        action === "preview"
          ? "Allocation preview created. Review both reviewers and coverage before confirming."
          : `Assigned ${allocationSummary(preview!.entries).covered} applications to 3 groups (${allocationSummary(preview!.entries).covered * 2} reviewer assignments).`,
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
  useEffect(() => {
    if (conflictId) setSelectedConflict(conflictId);
  }, [conflictId]);
  useEffect(() => {
    if (activeTab !== "conflicts") {
      return;
    }
    if (!selectedConflict || !data || focusedConflict.current === selectedConflict) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(`conflict-${selectedConflict}`);
      if (target && !target.hidden) {
        target.focus();
        focusedConflict.current = selectedConflict;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, selectedConflict, data]);
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
          className="sticky top-0 z-20 grid h-auto w-full grid-cols-2 border bg-muted sm:grid-cols-4"
        >
          <TabsTrigger className="min-h-11 whitespace-normal text-xs sm:text-sm" value="conflicts">
            Conflicts needing action {data ? `(${unresolved.length})` : ""}
          </TabsTrigger>
          <TabsTrigger className="min-h-11 whitespace-normal text-xs sm:text-sm" value="progress">
            Review Progress
          </TabsTrigger>
          <TabsTrigger className="min-h-11 whitespace-normal text-xs sm:text-sm" value="groups">
            Reviewer Groups
          </TabsTrigger>
          <TabsTrigger className="min-h-11 whitespace-normal text-xs sm:text-sm" value="allocation">
            Random Allocation
          </TabsTrigger>
        </TabsList>
        <TabsContent forceMount value="groups" className="space-y-4 data-[state=inactive]:hidden">
          <GrantReviewerGroups
            key={programId}
            programId={programId}
            profiles={profiles}
            assignments={assignments}
          />
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
        <TabsContent forceMount value="allocation" className="data-[state=inactive]:hidden">
          <Card className="min-w-0 space-y-4 p-4 sm:p-5">
            <h2 className="font-display text-xl">Random Allocation</h2>
            <nav aria-label="Allocation steps" className="grid grid-cols-3 gap-2">
              {(["choose", "review", "confirm"] as const).map((step, index) => (
                <Button
                  key={step}
                  variant={allocationStep === step ? "default" : "outline"}
                  className="h-auto min-h-11 whitespace-normal text-xs sm:text-sm"
                  aria-current={allocationStep === step ? "step" : undefined}
                  disabled={
                    busy ||
                    (step !== "choose" && !preview) ||
                    (step === "confirm" && (!!preview?.applied_at || !!preview?.superseded_at))
                  }
                  onClick={() => setAllocationStep(step)}
                >
                  {index + 1}.{" "}
                  {step === "choose"
                    ? "Choose groups"
                    : step === "review"
                      ? "Review assignments"
                      : "Confirm"}
                </Button>
              ))}
            </nav>
            <div hidden={allocationStep !== "choose"} className="space-y-3">
              {data?.poolSummary?.map((pool) => (
                <dl key="pool-summary" className="grid grid-cols-3 gap-3 border-y py-3 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Total applications</dt>
                    <dd className="text-xl font-semibold">{pool.total_applications}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Eligible & available</dt>
                    <dd className="text-xl font-semibold">{pool.eligible_applications}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Excluded from this pool</dt>
                    <dd className="text-xl font-semibold">
                      {pool.total_applications - pool.eligible_applications}
                    </dd>
                  </div>
                </dl>
              ))}
              <p className="text-sm text-muted-foreground">
                Only confirmed eligible applications without assignments or review history enter the
                pool. Existing finalized assignments stay intact.
              </p>
              {data?.poolSummary?.[0]?.eligible_applications === 0 && (
                <p role="status" className="text-sm">
                  No applications are currently available. Review eligibility or view finalized
                  allocations below.
                </p>
              )}
            </div>
            <div hidden={allocationStep !== "choose"}>
              <fieldset disabled={busy || isLoading || isError} className="min-w-0 space-y-4">
                <legend className="font-semibold">Select three distinct reviewer groups</legend>
                <div className="grid gap-3 lg:grid-cols-3">
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
                            disabled={groupUnavailableForSlot(
                              g,
                              pair,
                              chosenGroups,
                              profiles.map((p) => p.id),
                            )}
                          >
                            {g.name} ({g.members.length} members)
                          </option>
                        ))}
                      </select>
                      {chosenGroups[pair]?.members.map((id) => (
                        <span
                          key={id}
                          className="mt-1 block break-words text-xs text-muted-foreground"
                        >
                          {name(id)}
                        </span>
                      ))}
                    </label>
                  ))}
                </div>
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
                  I confirmed the six reviewer identities and Grant access against committee
                  records.
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

                <Button
                  disabled={!valid || busy || data?.poolSummary?.[0]?.eligible_applications === 0}
                  onClick={() => run("preview")}
                  className="min-h-11 w-full whitespace-normal sm:w-auto"
                >
                  {busy
                    ? "Working..."
                    : preview
                      ? "Create a new allocation preview"
                      : "Preview Random Allocation"}
                </Button>
              </fieldset>
            </div>
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
            {data && data.previews.length > 0 && (
              <details>
                <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                  Saved previews &amp; finalized allocations
                </summary>
                <label className="block text-sm">
                  Saved allocation / preview
                  <select
                    className={control}
                    value={preview?.id ?? ""}
                    onChange={(e) => {
                      setSelectedPreviewId(e.target.value);
                      setAllocationStep("review");
                      setApplyConfirmed(false);
                    }}
                  >
                    {data.previews.map((p) => (
                      <option key={p.id} value={p.id}>
                        {new Date(p.created_at).toLocaleString()} -{" "}
                        {p.applied_at ? "Finalized" : p.superseded_at ? "Superseded" : "Preview"}
                      </option>
                    ))}
                  </select>
                </label>
              </details>
            )}
            {preview && summary && allocationStep !== "choose" && (
              <section
                className="min-w-0 space-y-3 border-t pt-4"
                aria-label="Allocation preview and confirmation"
              >
                <h3 className="font-semibold">
                  {preview.applied_at ? "Finalized allocation" : "Preview - not yet assigned"}
                </h3>
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
                <details>
                  <summary className="min-h-11 cursor-pointer text-sm font-medium">
                    Allocation record details
                  </summary>
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
                </details>
                <p className="text-sm">
                  At preview creation: {preview.pool.length} total applications - {summary.pool} in
                  pool - {summary.covered} covered - {summary.unallocated} unallocated -{" "}
                  {preview.pool.filter((p) => p.exclusion).length} excluded
                </p>
                <ul className="space-y-2 text-sm">
                  {summary.pairs.map((count, i) => (
                    <li key={i} className="break-words">
                      {preview.sourceGroups[i]?.name ?? `Pair ${i + 1}`}: {count} applications -{" "}
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
                <ul
                  tabIndex={0}
                  aria-label="Application assignments"
                  hidden={allocationStep === "confirm"}
                  className="max-h-[28rem] overflow-y-auto divide-y border-y focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {preview.entries.map((entry) => {
                    const individual = projectGrantAllocationProgress(
                      [entry],
                      assignments,
                      reviews,
                      data?.conflicts ?? [],
                      data?.resolutions ?? [],
                    )[0].slots;
                    return (
                      <li
                        key={entry.applicationId}
                        className="grid min-w-0 gap-2 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
                      >
                        <div className="min-w-0">
                          <p className="break-words font-semibold">
                            {applicationName(entry.applicationId)}
                          </p>
                          <p className="break-words text-xs text-muted-foreground">
                            Applicant: {applicantName(entry.applicationId) || "Name unavailable"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {entry.pair
                              ? preview.sourceGroups[entry.pair - 1]?.name || "Pair " + entry.pair
                              : "Unassigned - fixed capacity"}
                          </p>
                        </div>
                        <div className="min-w-0">
                          {individual.map(({ reviewerId, originalReviewerId }) => (
                            <p className="break-words" key={originalReviewerId}>
                              {name(reviewerId)}
                              {originalReviewerId !== reviewerId &&
                                ` (replacement for ${name(originalReviewerId)})`}
                            </p>
                          ))}
                        </div>
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
                          {applicationName(p.id)} · Applicant:{" "}
                          {applicantName(p.id) || "Name unavailable"}: {p.exclusion} -{" "}
                          {p.eligibility}
                        </li>
                      ))}
                  </ul>
                </details>
                {preview.superseded_at && (
                  <p role="status">
                    Stale preview: superseded by an explicit reshuffle. It cannot be applied.
                  </p>
                )}
                {!preview.applied_at && !preview.superseded_at && allocationStep === "review" && (
                  <Button
                    disabled={!summary.covered || groupStale || groupCheckUnavailable}
                    onClick={() => setAllocationStep("confirm")}
                    className="min-h-11"
                  >
                    Continue to confirmation
                  </Button>
                )}
                {!preview.applied_at && !preview.superseded_at && allocationStep === "confirm" && (
                  <>
                    <label className="flex min-h-11 items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={applyConfirmed}
                        onChange={(e) => setApplyConfirmed(e.target.checked)}
                      />
                      I reviewed this reviewer roster, explicit capacity choice, coverage,
                      exclusions, and both reviewers per application.
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
                      {busy ? "Applying..." : "Confirm & assign applications"}
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
        <TabsContent forceMount value="progress" className="space-y-4 data-[state=inactive]:hidden">
          {historyProfiles.isError && (
            <p role="alert">
              Historical names could not be loaded.{" "}
              <Button variant="outline" onClick={() => historyProfiles.refetch()}>
                Retry names
              </Button>
            </p>
          )}
          <GrantProgressDashboard
            key={programId + (practiceSessionId ?? "real")}
            allocations={projectGrantCurrentAllocations({
              allocations: appliedAllocations,
              activeApplicationIds: new Set(applicationById.keys()),
              assignments,
              reviews,
              conflicts: data?.conflicts ?? [],
              resolutions: data?.resolutions ?? [],
              transfers: data?.transfers ?? [],
              applicationName,
            })}
            name={name}
            applicantName={applicantName}
            isTest={!!practiceSessionId}
            loading={isLoading}
            error={isError}
            conflicts={unresolved}
            onConflict={(id) => {
              focusedConflict.current = null;
              setSelectedConflict(id);
              changeTab("conflicts");
              requestAnimationFrame(() => document.getElementById(`conflict-${id}`)?.focus());
            }}
          />
        </TabsContent>
        <TabsContent
          forceMount
          value="conflicts"
          className="space-y-4 data-[state=inactive]:hidden"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-display text-xl">Conflict reports</h2>
            {data && (
              <p className="text-sm" role="status">
                {unresolved.length}{" "}
                {unresolved.length === 1 ? "conflict requires" : "conflicts require"} attention
              </p>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            The count shows unresolved conflict reports only. Reassigned and cleared reports appear
            in resolved history below. The other reviewer can continue; original review history is
            retained.
          </p>
          {data && !unresolved.length && (
            <p className="rounded-lg border p-4">
              No conflicts need action. Previously resolved reports remain in the history below.
            </p>
          )}
          {!!unresolved.length && (
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(0,2fr)]">
              <ul
                aria-label="Unresolved conflicts"
                id="conflict-queue"
                tabIndex={-1}
                className="self-start max-h-72 overflow-y-auto divide-y rounded-lg border lg:max-h-[32rem]"
              >
                {unresolved.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="w-full space-y-1 p-3 text-left text-sm hover:bg-muted focus-visible:outline focus-visible:outline-2 aria-pressed:bg-muted"
                      aria-pressed={
                        r.id ===
                        (unresolved.some((item) => item.id === selectedConflict)
                          ? selectedConflict
                          : unresolved[0]?.id)
                      }
                      onClick={() => {
                        setSelectedConflict(r.id);
                        requestAnimationFrame(() =>
                          document.getElementById(`conflict-${r.id}`)?.focus(),
                        );
                      }}
                    >
                      <span className="block break-words font-semibold">
                        {applicationName(r.application_id)}
                      </span>
                      <span className="block break-words">
                        Applicant: {applicantName(r.application_id) || "Name unavailable"}
                      </span>
                      <span className="block break-words">Reviewer: {name(r.reviewer_id)}</span>
                      <span className="block text-xs text-muted-foreground">
                        Needs attention - {new Date(r.reported_at).toLocaleDateString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="min-w-0">
                <Button
                  variant="outline"
                  className="mb-2 lg:hidden"
                  onClick={() => document.getElementById("conflict-queue")?.focus()}
                >
                  Back to conflict list
                </Button>
                <ul>
                  {unresolved.map((r) => (
                    <li
                      key={r.id}
                      id={`conflict-${r.id}`}
                      tabIndex={-1}
                      hidden={
                        r.id !==
                        (unresolved.some((item) => item.id === selectedConflict)
                          ? selectedConflict
                          : unresolved[0]?.id)
                      }
                      className="space-y-3 rounded-lg border bg-card p-4 text-sm focus-visible:outline focus-visible:outline-2"
                    >
                      <h3 className="break-words font-semibold">
                        {applicationName(r.application_id)} - {name(r.reviewer_id)}
                      </h3>
                      <p>Applicant: {applicantName(r.application_id) || "Name unavailable"}</p>
                      <p className="text-xs text-muted-foreground">
                        Reported {new Date(r.reported_at).toLocaleString()} - affected review on
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
            </div>
          )}
          <details>
            <summary className="min-h-11 cursor-pointer font-semibold">
              Resolved conflict history ({scopedConflicts.filter((r) => r.resolved_at).length})
            </summary>
            <p className="mb-3 text-sm text-muted-foreground">
              Reassignment replaces only the conflicted reviewer, not the entire reviewer group.
              Current reviewers are shown separately from the historical resolution.
            </p>
            <ul className="space-y-3">
              {scopedConflicts
                .filter((r) => r.resolved_at)
                .map((r) => {
                  const z = data?.resolutions.find((z) => z.report_id === r.id);
                  const replacement = assignments.find(
                    (a) => a.id === z?.replacement_assignment_id,
                  );
                  return (
                    <li key={r.id} className="space-y-2 rounded-lg border p-4 text-sm break-words">
                      <h3 className="font-semibold">
                        <Link
                          to="/grants/$id"
                          params={{ id: r.application_id }}
                          search={{ scope: practiceSessionId ? "test" : "real" }}
                          className="underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {applicationName(r.application_id)}
                        </Link>
                      </h3>
                      <p>Applicant: {applicantName(r.application_id) || "Name unavailable"}</p>
                      <p className="font-medium">
                        {z?.decision === "replaced"
                          ? "Resolved: reviewer reassigned"
                          : z?.decision === "cleared"
                            ? "Resolved: conflict cleared"
                            : "Resolved report"}
                      </p>
                      <p>Original reviewer: {name(r.reviewer_id)}</p>
                      {z?.decision === "replaced" && (
                        <p>
                          Replacement reviewer:{" "}
                          {replacement ? name(replacement.reviewer_id) : "Assignment unavailable"}
                        </p>
                      )}
                      <p>
                        Current active reviewers:{" "}
                        {assignments
                          .filter(
                            (a) =>
                              a.application_id === r.application_id && a.lifecycle === "active",
                          )
                          .map((a) => name(a.reviewer_id))
                          .join(" / ") || "None recorded"}
                      </p>
                      <p className="text-muted-foreground">
                        Resolved{" "}
                        {z?.resolved_at
                          ? new Date(z.resolved_at).toLocaleString()
                          : "at an unavailable date"}
                        {z && ` by ${name(z.resolved_by)}`}
                      </p>
                      <p>Resolution reason: {z?.reason || "Unavailable"}</p>
                      {z?.decision === "replaced" && (
                        <p className="text-muted-foreground">
                          Original review retained as excluded history. It does not count toward
                          scores or completion.
                        </p>
                      )}
                    </li>
                  );
                })}
            </ul>
          </details>
        </TabsContent>
      </Tabs>
    </div>
  );
}
