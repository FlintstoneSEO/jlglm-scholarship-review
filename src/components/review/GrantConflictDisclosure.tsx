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
  onStartReview,
  submitted = false,
}: {
  assignmentId?: string;
  held: boolean;
  cleared: boolean;
  onReported: (conflicted: boolean) => Promise<void>;
  onStartReview: () => void;
  submitted?: boolean;
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
      await onReported(false);
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
      await onReported(true);
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  const completed = !!assignmentId && cleared && !held;
  const guidance = (
    <>
      <p className="text-sm">{grantCertificationExpectations[5]}</p>
      <p className="text-sm text-muted-foreground">
        Random allocation does not eliminate conflicts. Report a potential conflict before
        competitive scoring. Your report pauses your competitive saves and submissions; it preserves
        assignments, drafts, submitted scores and history. An administrator can clear the report or
        replace only the conflicted reviewer. Approved conflicted reviews are retained and excluded
        from totals.
      </p>
    </>
  );
  const reportForm = (
    <div className="space-y-3">
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
        className="min-h-11 w-full whitespace-normal sm:w-auto"
        onClick={report}
        disabled={busy || reason.trim().length < 10}
      >
        {busy ? "Reporting..." : "Report a conflict"}
      </Button>
    </div>
  );
  return (
    <Card id="grant-conflict-disclosure" className="min-w-0 space-y-3 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 className="font-display text-xl">Conflict disclosure</h2>
          {completed && (
            <p role="status" className="text-sm text-muted-foreground">
              No known conflict recorded.
            </p>
          )}
        </div>
        {completed && (
          <Button
            className="min-h-11 w-full whitespace-normal sm:w-auto sm:shrink-0"
            disabled={busy}
            onClick={onStartReview}
          >
            {submitted ? "View review" : "Start review"}
          </Button>
        )}
      </div>
      {completed ? (
        <details>
          <summary className="min-h-11 cursor-pointer rounded-sm py-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Report a newly discovered conflict / view disclosure
          </summary>
          <div className="space-y-3 pt-2">
            {guidance}
            <p className="text-sm text-muted-foreground">
              You can report a conflict if circumstances change.
            </p>
            {reportForm}
          </div>
        </details>
      ) : (
        <>
          {guidance}
          {held ? (
            <p role="status" className="font-semibold">
              Your competitive review is on hold. An unresolved conflict report is recorded.
            </p>
          ) : assignmentId ? (
            <>
              {!cleared && (
                <>
                  <p>
                    Review the applicant and business information first. Competitive scoring and
                    draft saves require your recorded decision.
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
              {reportForm}
            </>
          ) : (
            <p className="text-sm">
              An active personal assignment is required to report a conflict or score.
              Administrative visibility does not assign a competitive review.
            </p>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
    </Card>
  );
}
