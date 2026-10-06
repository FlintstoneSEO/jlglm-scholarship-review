import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function GrantConflictResolution({
  reportId,
  profiles,
  onResolved,
}: {
  reportId: string;
  profiles: { id: string; full_name: string | null; email: string | null }[];
  onResolved: () => Promise<void>;
}) {
  const [decision, setDecision] = useState("");
  const [replacement, setReplacement] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function resolve() {
    setBusy(true);
    setError("");
    try {
      const r = await supabase.rpc("resolve_grant_conflict", {
        p_report: reportId,
        p_decision: decision,
        p_reason: reason,
        ...(decision === "replaced" ? { p_replacement: replacement } : {}),
      });
      if (r.error) throw r.error;
      await onResolved();
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
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
          >
            <option value="">Choose an authorized reviewer</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email} · {p.email}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block">
        Resolution reason (10–4000 characters)
        <Textarea
          className="mt-1"
          maxLength={4000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <p>
        Replacement preserves the original review as excluded history. The other reviewer continues.
        A cleared report still requires the reviewer’s recorded no-conflict decision.
      </p>
      <Button
        className="min-h-11"
        disabled={
          !decision || reason.trim().length < 10 || (decision === "replaced" && !replacement)
        }
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
