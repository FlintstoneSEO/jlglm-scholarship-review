import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function GrantConflictResolution({
  reportId,
  onResolved,
}: {
  reportId: string;
  onResolved: () => Promise<void>;
}) {
  const candidates = useQuery({
    queryKey: ["grant-conflict-candidates", reportId],
    queryFn: async () => {
      const result = await supabase.rpc("grant_conflict_replacement_candidates", {
        p_report: reportId,
      });
      if (result.error) throw result.error;
      return result.data;
    },
  });
  const [decision, setDecision] = useState("");
  const [replacement, setReplacement] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const [refreshFailed, setRefreshFailed] = useState(false);
  async function refreshResolution() {
    setRefreshFailed(false);
    try {
      await onResolved();
    } catch {
      setRefreshFailed(true);
    }
  }
  const validReplacement =
    !!candidates.data?.some((p) => p.id === replacement) &&
    !candidates.isError &&
    !candidates.isFetching;
  const requirements = [
    ...(!decision ? ["Choose a decision."] : []),
    ...(reason.trim().length < 10 || reason.trim().length > 4000
      ? ["Enter a resolution reason of 10–4000 characters."]
      : []),
    ...(decision === "replaced" && !validReplacement
      ? ["Choose a currently eligible replacement reviewer after the list loads."]
      : []),
  ];
  const reasonHelpId = useId();
  const reasonLength = reason.trim().length;
  async function resolve() {
    if (busy || result || requirements.length > 0) return;
    setBusy(true);
    setError("");
    setResult("");
    try {
      const r = await supabase.rpc("resolve_grant_conflict", {
        p_report: reportId,
        p_decision: decision,
        p_reason: reason,
        ...(decision === "replaced" ? { p_replacement: replacement } : {}),
      });
      if (r.error) throw r.error;
      const replacedName = candidates.data?.find((p) => p.id === replacement)?.full_name;
      setResult(
        decision === "replaced"
          ? "Resolution recorded. Replacement assigned; original review retained as excluded history."
          : "Resolution recorded. Reviewer must record no known conflict before continuing.",
      );
      await refreshResolution();
      toast.success(
        decision === "replaced"
          ? `${replacedName || "Replacement reviewer"} assigned. The original review history is retained and the other reviewer continues.`
          : "Conflict cleared. The reviewer can record no known conflict and continue.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  const control =
    "mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <fieldset className="min-w-0 space-y-3 border-t pt-3" disabled={busy}>
      <legend className="font-semibold">Resolve report</legend>
      <label className="block">
        Decision
        <select
          aria-label="Decision"
          className={control}
          value={decision}
          disabled={!!result}
          onChange={(e) => setDecision(e.target.value)}
        >
          <option value="">Choose a decision</option>
          <option value="replaced">Confirm conflict and replace this reviewer</option>
          <option value="cleared">No conflict found; clear the report</option>
        </select>
      </label>
      {decision === "replaced" && (
        <label className="block">
          Replacement reviewer
          <select
            aria-label="Replacement reviewer"
            className={control}
            disabled={!!result || candidates.isFetching || candidates.isError}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          >
            <option value="">Choose an authorized reviewer</option>
            {candidates.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} - {p.active_applications} active real applications
              </option>
            ))}
          </select>
        </label>
      )}
      {decision === "replaced" && candidates.isLoading && (
        <p role="status">Loading eligible replacements...</p>
      )}
      {decision === "replaced" && candidates.isError && (
        <p role="alert">
          Replacement eligibility is unavailable.{" "}
          <Button variant="outline" onClick={() => candidates.refetch()}>
            Retry
          </Button>
        </p>
      )}
      {decision === "replaced" && candidates.data?.length === 0 && (
        <p>No eligible replacement is available. Check program access and existing assignments.</p>
      )}
      <label className="block">
        Resolution reason (10–4000 characters)
        <Textarea
          className="mt-1"
          aria-describedby={reasonHelpId}
          aria-invalid={reason.length > 0 && reasonLength < 10}
          minLength={10}
          maxLength={4000}
          value={reason}
          disabled={!!result}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p id={reasonHelpId} className="text-sm text-muted-foreground" role="status">
        {reasonLength}/4000 characters (excluding leading and trailing spaces).
        {reasonLength < 10 &&
          ` Add at least ${10 - reasonLength} more ${10 - reasonLength === 1 ? "character" : "characters"} to enable Record resolution.`}
      </p>
      <p>
        Replacement preserves the original review as excluded history. The other reviewer continues.
        A cleared report still requires the reviewer’s recorded no-conflict decision.
      </p>
      {requirements.length > 0 && (
        <div className="text-sm">
          <p className="font-semibold">Before recording resolution</p>
          <ul className="list-disc space-y-1 pl-5">
            {requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
      )}
      {result && (
        <p role="status" className="text-sm">
          {result}
        </p>
      )}
      {refreshFailed && (
        <div role="alert" className="text-sm">
          Resolution was recorded, but the list could not refresh. Do not record it again.{" "}
          <Button variant="outline" onClick={refreshResolution}>
            Retry refresh
          </Button>
        </div>
      )}
      <Button
        className="min-h-11"
        disabled={busy || !!result || requirements.length > 0}
        onClick={resolve}
      >
        {busy ? "Resolving…" : "Record resolution"}
      </Button>
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
