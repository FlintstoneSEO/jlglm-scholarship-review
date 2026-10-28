import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  duplicateCandidatesSchema,
  duplicateImpactSchema,
  duplicateImpactCounts,
  duplicateExclusionExplanation,
  validDuplicateReason,
  type DuplicateCandidate,
  type DuplicateImpact,
} from "@/lib/application-duplicates";

const message = (error: unknown) =>
  error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Could not complete this action. Try again.";

export function MarkGrantDuplicate({
  applicationId,
  businessName,
  applicantName,
}: {
  applicationId: string;
  businessName: string;
  applicantName: string;
}) {
  const qc = useQueryClient();
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [retained, setRetained] = useState<DuplicateCandidate | null>(null);
  const [reason, setReason] = useState("");
  const [impact, setImpact] = useState<DuplicateImpact | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidates = useQuery({
    queryKey: ["duplicate-candidates", applicationId, search],
    enabled: open && !impact,
    retry: false,
    queryFn: async () => {
      const result = await supabase.rpc("grant_duplicate_candidates", {
        p_application: applicationId,
        p_search: search,
      });
      if (result.error) throw result.error;
      return duplicateCandidatesSchema.parse(result.data);
    },
  });
  async function prepare() {
    if (!retained || !validDuplicateReason(reason) || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("grant_duplicate_impact", { p_application: applicationId });
      if (result.error) throw result.error;
      setImpact(duplicateImpactSchema.parse(result.data));
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!retained || !impact || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await supabase.rpc("mark_grant_application_duplicate", {
        p_application: applicationId,
        p_retained: retained.id,
        p_reason: reason.trim(),
        p_expected_impact: impact,
      });
      if (result.error) throw result.error;
      setOpen(false);
      await qc.invalidateQueries();
    } catch (e) {
      setError(message(e));
      setImpact(null);
    } finally {
      setBusy(false);
    }
  }
  const counts = impact && duplicateImpactCounts(impact);
  return (
    <>
      <Button
        ref={trigger}
        variant="outline"
        className="min-h-11 whitespace-normal"
        onClick={() => {
          setRetained(null);
          setReason("");
          setSearch("");
          setImpact(null);
          setError("");
          setOpen(true);
        }}
      >
        Mark as duplicate
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!busy) setOpen(next);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            trigger.current?.focus();
          }}
          className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          onEscapeKeyDown={(e) => {
            if (busy) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {impact ? "Confirm duplicate exclusion" : "Mark as duplicate"}
            </DialogTitle>
            <DialogDescription>
              Exclude this application from active review while preserving its history.
            </DialogDescription>
          </DialogHeader>
          <div className="min-w-0 space-y-4 text-sm">
            <div className="break-words">
              <strong>Application to exclude</strong>
              <p>{businessName}</p>
              <p>Applicant: {applicantName}</p>
            </div>
            {!impact ? (
              <>
                <label
                  className="block font-semibold"
                  htmlFor={`duplicate-search-${applicationId}`}
                >
                  Search retained application by business or applicant
                </label>
                <Input
                  id={`duplicate-search-${applicationId}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  maxLength={200}
                />
                {retained && (
                  <p className="break-words" role="status">
                    Retain: <strong>{retained.business_name}</strong> · Applicant:{" "}
                    {retained.applicant_name}
                  </p>
                )}
                {candidates.isFetching && !candidates.data ? (
                  <p role="status">Loading compatible applications…</p>
                ) : candidates.isError ? (
                  <p role="alert">
                    Applications could not be loaded.{" "}
                    <Button variant="outline" onClick={() => void candidates.refetch()}>
                      Retry
                    </Button>
                  </p>
                ) : (
                  <fieldset className="max-h-56 overflow-y-auto rounded-md border px-3">
                    <legend className="px-1 font-semibold">Retained application (required)</legend>
                    {!candidates.data?.length && (
                      <p className="py-3">No compatible applications found.</p>
                    )}
                    {candidates.data?.map((candidate) => (
                      <label
                        key={candidate.id}
                        className="flex min-h-11 cursor-pointer items-start gap-3 border-b py-3 last:border-0"
                      >
                        <input
                          type="radio"
                          className="mt-1"
                          name={`retained-${applicationId}`}
                          checked={retained?.id === candidate.id}
                          onChange={() => setRetained(candidate)}
                        />
                        <span className="min-w-0 break-words">
                          <strong>{candidate.business_name}</strong>
                          <br />
                          Applicant: {candidate.applicant_name}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <p className="text-muted-foreground">
                  Showing up to 50 matches in the same program and test/practice scope. Refine your
                  search to find another application.
                </p>
                <label
                  className="block font-semibold"
                  htmlFor={`duplicate-reason-${applicationId}`}
                >
                  Reason (required, 10–4000 characters)
                </label>
                <textarea
                  id={`duplicate-reason-${applicationId}`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={4000}
                  rows={3}
                  className="w-full rounded-md border bg-background p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </>
            ) : (
              <>
                <div className="break-words">
                  <strong>Application to retain</strong>
                  <p>{retained?.business_name}</p>
                  <p>Applicant: {retained?.applicant_name}</p>
                </div>
                <p>
                  {counts?.assignments} affected assignments: {counts?.completed} completed reviews,{" "}
                  {counts?.drafts} drafts, {counts?.notStarted} not started.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  {impact.assignments.map((a) => (
                    <li key={a.id}>
                      {a.reviewer_name}: {a.review_status.replaceAll("_", " ")} ({a.lifecycle})
                    </li>
                  ))}
                </ul>
                <p>{duplicateExclusionExplanation}</p>
                <p>
                  This application will leave active reviewer queues, workloads, allocation
                  eligibility, dashboard totals and rankings. The retained application and its
                  existing reviews stay unchanged.
                </p>
                <p className="break-words">
                  <strong>Reason:</strong> {reason.trim()}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="break-words text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              {impact ? (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => setImpact(null)}>
                    Back
                  </Button>
                  <Button disabled={busy} onClick={() => void confirm()}>
                    {busy ? "Marking…" : "Confirm mark as duplicate"}
                  </Button>
                </>
              ) : (
                <Button
                  disabled={busy || !retained || !validDuplicateReason(reason)}
                  onClick={() => void prepare()}
                >
                  {busy ? "Loading impact…" : "Review impact"}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
