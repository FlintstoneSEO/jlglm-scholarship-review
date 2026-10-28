import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  transferGroupsSchema,
  transferImpactSchema,
  validTransferReason,
  transferExplanation,
  type TransferImpact,
} from "@/lib/grant-group-transfer";
import type { GrantAssignmentSummary } from "@/lib/grant-assignment-summary";

const errorMessage = (e: unknown) =>
  e && typeof e === "object" && "message" in e
    ? String(e.message)
    : "The transfer could not be confirmed. Retry the same request to check its outcome.";
export function TransferGrantGroup({
  applicationId,
  businessName,
  summary,
}: {
  applicationId: string;
  businessName: string;
  summary: GrantAssignmentSummary | null;
}) {
  const qc = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState("");
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<TransferImpact | null>(null);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const groups = useQuery({
    queryKey: ["grant-transfer-groups", applicationId],
    enabled: open,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      const result = await supabase.rpc("grant_transfer_groups", { p_application: applicationId });
      if (result.error) throw result.error;
      return transferGroupsSchema.parse(result.data);
    },
  });
  async function prepare() {
    if (pending.current || !group || !validTransferReason(reason)) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("grant_transfer_impact", {
        p_application: applicationId,
        p_group: group,
      });
      if (result.error) throw result.error;
      setImpact(transferImpactSchema.parse(result.data));
      setRequest(crypto.randomUUID());
      setUncertain(false);
    } catch (e) {
      setError(errorMessage(e));
      void groups.refetch();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function confirm() {
    if (pending.current || !impact) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setUncertain(true);
    try {
      const result = await supabase.rpc("transfer_grant_application", {
        p_application: applicationId,
        p_group: group,
        p_reason: reason.trim(),
        p_request: request,
        p_expected_impact: impact as Json,
      });
      if (result.error) {
        // A returned database error rolled back. Network failures can have an unknown outcome.
        if (result.error.code && result.error.code !== "") {
          setImpact(null);
          setUncertain(false);
        } else setUncertain(true);
        throw result.error;
      }
      setUncertain(false);
      setOpen(false);
      toast.success("Application transferred. Destination reviewers can begin fresh reviews.");
      await qc.invalidateQueries();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        className="min-h-11 whitespace-normal"
        onClick={() => {
          if (!uncertain) {
            setGroup("");
            setReason("");
            setImpact(null);
            setError("");
          }
          setOpen(true);
        }}
      >
        Transfer to another group
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {impact ? "Confirm group transfer" : "Transfer to another group"}
            </DialogTitle>
            <DialogDescription>
              Move this application to two fresh reviewers and preserve the evaluation history.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4 break-words text-sm" aria-busy={busy}>
            <p className="font-semibold">{businessName}</p>
            <div>
              <h3 className="font-semibold">Current ownership</h3>
              <p>
                {impact?.current_group?.name ??
                  summary?.current_group?.name ??
                  "Individual assignments / no saved group attribution"}
              </p>
              {summary?.original_group && (
                <p className="mt-1 text-muted-foreground">
                  Original allocation group: {summary.original_group.name}
                </p>
              )}
              {!summary && (
                <p role="status">Current reviewers will be loaded in the impact preview.</p>
              )}
              {!impact && (
                <ul className="mt-1 space-y-1">
                  {summary?.assignments.map((a) => (
                    <li key={a.assignment_id}>
                      {a.reviewer_name}
                      {a.replaces && ` (replacement for ${a.replaces})`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {!impact ? (
              <>
                {groups.isFetching ? (
                  <p role="status">Loading saved groups…</p>
                ) : groups.isError ? (
                  <div role="alert">
                    Saved groups could not be loaded.{" "}
                    <Button variant="outline" onClick={() => void groups.refetch()}>
                      Retry groups
                    </Button>
                  </div>
                ) : (
                  <>
                    {!groups.data?.some((g) => !g.unavailable_reason) && (
                      <p role="status">
                        No eligible destination groups. Create or update a saved group with two
                        available reviewers who have never been assigned this application.
                      </p>
                    )}
                    <label
                      className="block font-semibold"
                      htmlFor={`transfer-group-${applicationId}`}
                    >
                      Destination saved group
                    </label>
                    <select
                      id={`transfer-group-${applicationId}`}
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Choose another group</option>
                      {groups.data?.map((g) => (
                        <option key={g.id} value={g.id} disabled={!!g.unavailable_reason}>
                          {g.name}
                          {g.unavailable_reason ? " (unavailable)" : ""}
                        </option>
                      ))}
                    </select>
                    <details>
                      <summary className="min-h-11 cursor-pointer py-3 focus-visible:ring-2 focus-visible:ring-ring">
                        Group availability
                      </summary>
                      <ul className="space-y-2">
                        {groups.data
                          ?.filter((g) => g.unavailable_reason)
                          .map((g) => (
                            <li key={g.id}>
                              <strong>{g.name}:</strong> {g.unavailable_reason}
                            </li>
                          ))}
                      </ul>
                    </details>
                  </>
                )}
                <label className="block font-semibold" htmlFor={`transfer-reason-${applicationId}`}>
                  Reason (required, 10–4000 characters)
                </label>
                <textarea
                  id={`transfer-reason-${applicationId}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-describedby={`transfer-reason-help-${applicationId}`}
                />
                <p id={`transfer-reason-help-${applicationId}`} className="text-muted-foreground">
                  {[...reason.trim()].length} trimmed characters. The reason is recorded in
                  administrator history.
                </p>
              </>
            ) : (
              <>
                <div>
                  <h3 className="font-semibold">Departing reviewers</h3>
                  <ul className="mt-1 space-y-1">
                    {impact.assignments
                      .filter((a) => a.lifecycle === "active")
                      .map((a) => (
                        <li key={a.id}>
                          {a.reviewer_name}: {a.review_status.replaceAll("_", " ")}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold">Destination: {impact.group.name}</h3>
                  <ul className="mt-1 space-y-1">
                    {impact.group.members.map((m) => (
                      <li key={m.id}>{m.name}: fresh review, not started</li>
                    ))}
                  </ul>
                </div>
                <p>
                  {impact.completed_review_count} current completed reviews → 0. Current average
                  score → no completed scores.
                </p>
                <p>{transferExplanation}</p>
                <p>
                  Only this application moves. The original allocation and all conflict history
                  remain preserved. Previous assignments stop granting active review access.
                </p>
                <p className="whitespace-pre-wrap">
                  <strong>Reason:</strong> {reason.trim()}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-destructive">
                {error}
              </p>
            )}
            {uncertain && (
              <p role="status">
                The outcome is unconfirmed. Retry this same confirmation to recover its result
                safely before starting another transfer.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {impact ? (
                <>
                  <Button
                    variant="outline"
                    disabled={busy || uncertain}
                    onClick={() => setImpact(null)}
                  >
                    Back
                  </Button>
                  <Button disabled={busy} onClick={() => void confirm()}>
                    {busy
                      ? "Transferring…"
                      : uncertain
                        ? "Retry same transfer"
                        : "Confirm transfer"}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={
                    busy ||
                    groups.isFetching ||
                    groups.isError ||
                    !groups.data?.some((g) => g.id === group && !g.unavailable_reason) ||
                    !validTransferReason(reason)
                  }
                  onClick={() => void prepare()}
                >
                  {busy ? "Loading impact…" : "Review transfer impact"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
