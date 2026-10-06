import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { grantCertificationExpectations } from "@/lib/grant-review-certification";
export function GrantConflictDisclosure({
  assignmentId,
  held,
  cleared,
  onReported,
}: {
  assignmentId?: string;
  held: boolean;
  cleared: boolean;
  onReported: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function declare() {
    if (!assignmentId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("declare_grant_no_conflict", {
        p_assignment: assignmentId,
      });
      if (result.error) throw result.error;
      await onReported();
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  async function report() {
    if (!assignmentId || busy || reason.trim().length < 10) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("report_grant_conflict", {
        p_assignment: assignmentId,
        p_reason: reason.trim(),
      });
      if (result.error) throw result.error;
      await onReported();
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card id="grant-conflict-disclosure" className="min-w-0 space-y-3 p-4 sm:p-5">
      <h2 className="font-display text-xl">Conflict disclosure</h2>
      <p className="text-sm">{grantCertificationExpectations[5]}</p>
      <p className="text-sm text-muted-foreground">
        Random allocation does not eliminate conflicts. Report a potential conflict before
        competitive scoring. Your report pauses your competitive saves and submissions; it preserves
        assignments, drafts, submitted scores and history. An administrator can clear the report or
        replace only the conflicted reviewer. Approved conflicted reviews are retained and excluded
        from totals.
      </p>
      {held ? (
        <p role="status" className="font-semibold">
          Your competitive review is on hold. An unresolved conflict report is recorded.
        </p>
      ) : assignmentId ? (
        <>
          {cleared ? (
            <p role="status">
              No known conflict recorded. You can report a conflict if circumstances change.
            </p>
          ) : (
            <>
              <p>
                Review the applicant and business information first. Competitive scoring and draft
                saves require your recorded decision.
              </p>
              <Button
                className="min-h-11 w-full whitespace-normal sm:w-auto"
                disabled={busy}
                onClick={declare}
              >
                No known conflict identified
              </Button>
            </>
          )}
          <Label htmlFor="grant-conflict-reason">Conflict reason (10-4000 characters)</Label>
          <Textarea
            id="grant-conflict-reason"
            minLength={10}
            maxLength={4000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
          <Button
            className="min-h-11"
            onClick={report}
            disabled={busy || reason.trim().length < 10}
          >
            {busy ? "Reporting..." : "Report a conflict"}
          </Button>
        </>
      ) : (
        <p className="text-sm">
          An active personal assignment is required to report a conflict or score. Administrative
          visibility does not assign a competitive review.
        </p>
      )}
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
