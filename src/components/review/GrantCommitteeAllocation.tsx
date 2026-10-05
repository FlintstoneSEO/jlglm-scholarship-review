import { GrantReviewerGroups } from "@/components/review/GrantReviewerGroups";
import { useGrantReviewerGroups } from "@/lib/use-grant-reviewer-groups";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import { projectAssignmentProgress } from "@/lib/review-queue-projections";
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
  profiles,
  assignments,
  reviews,
}: {
  programId: string;
  profiles: Profile[];
  assignments: Assignment[];
  reviews: Review[];
}) {
  const qc = useQueryClient();
  const [selectedPreviewId, setSelectedPreviewId] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>(Array(3).fill(""));
  const groups = useGrantReviewerGroups(programId);
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
    queryKey: ["grant-committee", programId],
    queryFn: async () => {
      const [previews, conflicts] = await Promise.all([
        supabase
          .from("grant_allocation_previews")
          .select("*")
          .eq("program_id", programId)
          .order("created_at", { ascending: false }),
        supabase
          .from("grant_conflict_reports")
          .select("*")
          .eq("program_id", programId)
          .is("resolved_at", null)
          .order("reported_at", { ascending: false }),
      ]);
      if (previews.error || conflicts.error) throw previews.error ?? conflicts.error;
      return {
        previews: (previews.data ?? []).map((p) => ({
          ...p,
          entries: allocationEntries(p.allocation),
          pool: poolEntries(p.snapshot),
          sourceGroups: groupSnapshots(p.group_snapshot),
        })),
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
  const name = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    return p ? (p.full_name || p.email) + " (" + p.email + ")" : id;
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
          ? await supabase.rpc("preview_grant_group_allocation", {
              p_program: programId,
              p_groups: selectedGroups,
              p_mode: mode,
              ...(mode === "fixed" ? { p_capacity: Number(capacity) } : {}),
            })
          : await supabase.rpc("apply_grant_pair_allocation", { p_preview: preview!.id });
      if (result.error) throw result.error;
      setApplyConfirmed(false);
      if (action === "preview" && typeof result.data === "string")
        setSelectedPreviewId(result.data);
      await qc.invalidateQueries();
      setMessage(
        action === "preview"
          ? "Frozen preview created. Review coverage and both reviewers before Apply."
          : "Both individual assignments were applied together.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  const summary = preview && allocationSummary(preview.entries);
  return (
    <div id="grant-committee-allocation" className="min-w-0 space-y-5">
      <GrantReviewerGroups key={programId} programId={programId} profiles={profiles} />
      <Card className="min-w-0 space-y-4 p-4 sm:p-5">
        <h2 className="font-display text-xl">Grant paired allocation</h2>
        <p className="text-sm text-muted-foreground">
          Random allocation does not eliminate conflicts. Two reviewers independently score each
          allocated application. Administrator visibility includes program applications and scores;
          your competitive reviews require your own active assignments.
        </p>
        <p className="text-sm">
          Committee reference: Tony Willis / Willye Bryan; Sean Holland / Prince Solace; Betty
          Sanford / Courney Minor. Confirm identities against committee records. Names do not
          establish account matches.
        </p>
        <p className="text-sm text-muted-foreground">
          Existing accounts with Grant reviewer/admin membership only. Reuse individual invitations
          and password setup if access is missing; allocation sends no invitations.
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
                  {name(id)} - ID: {id}
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
            I confirmed all six account IDs, identities and Grant memberships against committee
            records.
          </label>
          <label className="block text-sm">
            Capacity choice
            <select
              aria-label="Capacity choice"
              className={control}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="">Choose explicitly</option>
              <option value="balanced">Balanced coverage of entire actual pool</option>
              <option value="fixed">Fixed capacity per pair; show unallocated</option>
            </select>
          </label>
          {mode === "fixed" && (
            <label className="block text-sm">
              Applications per pair
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
            Pool: confirmed Eligible applications without assignments or review activity/history.
            Balanced coverage of 40 gives 14 / 13 / 13; fixed 13 leaves one visibly unallocated.
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
                : "Create frozen preview"}
          </Button>
        </fieldset>
        {isLoading && <p role="status">Loading saved previews and conflicts...</p>}
        {isError && (
          <div role="alert">
            <p>Committee data could not be loaded. Verify the local/test migration is installed.</p>
            <Button onClick={() => refetch()} variant="outline">
              Retry
            </Button>
          </div>
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
                    Frozen pair {i + 1}: {g.name} (revision {g.revision})
                  </li>
                ))}
              </ul>
            )}
            {!preview.applied_at && groupStale && (
              <p role="alert" className="text-sm text-destructive">
                Stale preview: a saved group changed. Explicitly create a new preview before Apply.
              </p>
            )}
            {!preview.applied_at && groupCheckUnavailable && (
              <p role="status" className="text-sm">
                Saved group configuration must be loaded before Apply.
              </p>
            )}
            <p className="break-words text-sm">
              Created {new Date(preview.created_at).toLocaleString()} by {name(preview.actor_id)}.
              Capacity:{" "}
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
              {preview.pool.length} total applications - {summary.pool} in pool - {summary.covered}{" "}
              covered - {summary.unallocated} unallocated -{" "}
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
                No confirmed Eligible applications without assignments or activity are available.
              </p>
            )}
            <ul className="divide-y border-y">
              {preview.entries.map((entry) => {
                const pool = preview.pool.find((p) => p.id === entry.applicationId);
                const individual = entry.reviewers.map((reviewerId) => {
                  const assignment = assignments.find(
                    (a) => a.application_id === entry.applicationId && a.reviewer_id === reviewerId,
                  );
                  const review =
                    assignment && reviews.find((r) => r.assignment_id === assignment.id);
                  const progress = assignment
                    ? projectAssignmentProgress(
                        "business_growth_grant",
                        assignment,
                        review
                          ? [
                              {
                                ...review,
                                application_id: entry.applicationId,
                                reviewer_id: reviewerId,
                              },
                            ]
                          : [],
                        [],
                      )
                    : null;
                  return { reviewerId, assignment, progress };
                });
                const completed = individual.filter(
                  (p) => p.assignment?.lifecycle === "active" && p.progress?.completedReviews === 1,
                ).length;
                return (
                  <li key={entry.applicationId} className="min-w-0 space-y-2 py-3 text-sm">
                    <p className="break-words font-semibold">
                      {pool?.name || entry.applicationId} -{" "}
                      {entry.pair ? "Pair " + entry.pair : "UNALLOCATED: fixed capacity"}
                    </p>
                    {individual.map(({ reviewerId, assignment, progress }) => (
                      <div key={reviewerId} className="break-words">
                        <p>
                          {name(reviewerId)}{" "}
                          {assignment && assignment.lifecycle !== "active" ? "- suspended" : ""}
                        </p>
                        {preview.applied_at && progress && <ReviewProgress progress={progress} />}
                      </div>
                    ))}
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
                  I reviewed this frozen roster, explicit capacity choice, coverage, exclusions, and
                  both reviewers per application.
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
                  {busy ? "Applying..." : "Apply frozen paired allocation"}
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
      <Card className="min-w-0 space-y-3 p-4 sm:p-5">
        <h2 className="font-display text-xl">Unresolved conflict reports</h2>
        <p className="text-sm text-muted-foreground">
          Resolution, replacement allocation, and treatment of existing activity remain pending
          committee policy. Preserve assignments, drafts, submitted reviews and history. Do not use
          Reset Review to resolve a conflict.
        </p>
        {data && !data.conflicts.length && <p className="text-sm">No unresolved reports.</p>}
        <ul className="divide-y">
          {data?.conflicts.map((r) => (
            <li key={r.id} className="space-y-1 py-3 text-sm">
              <p className="break-words font-semibold">
                {data.previews.flatMap((p) => p.pool).find((p) => p.id === r.application_id)
                  ?.name ?? r.application_id}{" "}
                - {name(r.reviewer_id)}
              </p>
              <p>{new Date(r.reported_at).toLocaleString()} - Reviewer-specific competitive hold</p>
              <p className="whitespace-pre-wrap break-words">{r.reason}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
