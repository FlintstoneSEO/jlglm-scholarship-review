import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TestApplicationBadge } from "./TestApplicationBadge";
import { testingChecklist } from "@/lib/testing-workflow";
import { assignReviewer } from "@/lib/reviewer-assignment-client";
import type { ProgramAccess } from "@/lib/auth-context";
import type { TestingApplication } from "@/lib/use-testing-applications";

type Search = { guide: boolean; application?: string; reviewer?: string };
export function GuidedTesting({
  open,
  programs,
  program,
  userId,
  application,
  profiles,
  reviewerId,
  requestedApplication,
  loading,
  failed,
  busy,
  chooseProgram,
  create,
  update,
  refresh,
  reset,
}: {
  open: boolean;
  programs: ProgramAccess[];
  program: ProgramAccess;
  userId: string | undefined;
  application?: TestingApplication;
  profiles: { id: string; full_name: string | null; email: string | null }[];
  reviewerId?: string;
  requestedApplication?: string;
  loading: boolean;
  failed: boolean;
  busy: boolean;
  chooseProgram: (slug: ProgramAccess["slug"]) => void;
  create: () => Promise<void>;
  update: (search: Search) => void;
  refresh: () => void;
  reset: (app: TestingApplication) => void;
}) {
  const qc = useQueryClient();
  const [creatingStep, setCreatingStep] = useState(false);
  const [selectedReviewer, setSelectedReviewer] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");
  const [manual, setManual] = useState<string[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const result = application?.progress.find((p) => p.assignment.reviewer_id === reviewerId);
  const reviewer = profiles.find((p) => p.id === reviewerId);
  const step =
    !failed && result?.completed
      ? 5
      : result?.assignment.lifecycle === "active"
        ? 4
        : application
          ? 3
          : creatingStep
            ? 2
            : 1;
  useEffect(() => {
    if (open) heading.current?.focus();
  }, [open, step]);
  useEffect(() => {
    setManual([]);
    setSelectedReviewer("");
    setError("");
  }, [application?.id]);
  async function assign() {
    if (
      !application ||
      !selectedReviewer ||
      assigning ||
      failed ||
      loading ||
      !profiles.some((p) => p.id === selectedReviewer)
    )
      return;
    setAssigning(true);
    setError("");
    try {
      const existing = application.progress.find(
        (p) => p.assignment.reviewer_id === selectedReviewer,
      );
      if (existing && existing.assignment.lifecycle !== "active")
        throw new Error(
          "This assignment is inactive. Choose another reviewer or ask an administrator to check its history.",
        );
      if (!existing)
        await assignReviewer({
          application_id: application.id,
          program_id: program.programId,
          reviewer_id: selectedReviewer,
          assigned_by: userId ?? null,
        });
      await qc.invalidateQueries();
      update({ guide: true, application: application.id, reviewer: selectedReviewer });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Assignment could not be confirmed. Try again.");
    } finally {
      setAssigning(false);
    }
  }
  const unavailable = !!requestedApplication && !application && !loading;
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && !busy && !assigning)
          update({ guide: false, application: application?.id, reviewer: reviewerId });
      }}
    >
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl [&_button]:min-h-11 [&_a]:min-h-11"
        onOpenAutoFocus={(e) => {
          if (document.activeElement instanceof HTMLElement)
            returnFocus.current = document.activeElement;
          e.preventDefault();
          heading.current?.focus();
        }}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (returnFocus.current?.isConnected) returnFocus.current.focus();
        }}
        onEscapeKeyDown={(e) => {
          if (busy || assigning) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (busy || assigning) e.preventDefault();
        }}
      >
        <DialogHeader>
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
            Step {step} of 5
          </p>
          <DialogTitle ref={heading} tabIndex={-1}>
            {
              [
                "",
                "What would you like to test?",
                "Create a Practice Application",
                "Assign a Reviewer",
                "Complete the Review",
                "Testing Complete",
              ][step]
            }
          </DialogTitle>
          <DialogDescription>
            Practice the normal review process with fictional information. Real program results are
            unaffected.
          </DialogDescription>
        </DialogHeader>
        {(loading || failed || unavailable) && (
          <div className="space-y-3">
            <p role={failed || unavailable ? "alert" : "status"}>
              {loading
                ? "Checking practice progress..."
                : failed
                  ? "Practice progress could not be loaded. Retry before continuing."
                  : "This practice application is no longer available in this program."}
            </p>
            <Button variant="outline" onClick={refresh}>
              Refresh Progress
            </Button>
          </div>
        )}
        {!failed && !unavailable && (
          <>
            {step === 1 && (
              <div className="space-y-4">
                <fieldset disabled={busy}>
                  <legend className="mb-2 font-medium">Program</legend>
                  {programs.map((p) => (
                    <label key={p.programId} className="flex min-h-11 items-center gap-3">
                      <input
                        type="radio"
                        name="guided-program"
                        checked={program.programId === p.programId}
                        onChange={() => chooseProgram(p.slug)}
                      />
                      {p.name}
                    </label>
                  ))}
                </fieldset>
                <Button onClick={() => setCreatingStep(true)}>Continue</Button>
              </div>
            )}
            {step === 2 && (
              <div className="space-y-3">
                <p>
                  A fictional application will be created for {program.name} using the same review
                  screens and rubric as real applications.
                </p>
                <p className="text-sm text-muted-foreground">
                  Normal screening is still required. No real applicant information is copied.
                </p>
                <Button disabled={busy || loading} onClick={create}>
                  {busy ? "Creating..." : "Create Practice Application"}
                </Button>
              </div>
            )}
            {application && (
              <div className="space-y-2">
                <TestApplicationBadge isTest />
                <h3 className="break-words font-semibold">{application.displayName}</h3>
                <p className="text-sm text-muted-foreground">
                  {program.name} - Practice Application
                </p>
              </div>
            )}
            {step === 3 && application && (
              <div className="space-y-4">
                <p role="status">
                  Practice application created. Choose the person who will practice reviewing it.
                </p>
                <p className="text-sm">
                  Before reviewing, open this application and complete its normal screening.
                  Scholarship screening requires a global administrator and may already assign the
                  program’s reviewers.
                </p>
                <Button variant="outline" asChild>
                  <Link
                    to={application.applicantId ? "/applicants/$id" : "/grants/$id"}
                    params={{ id: application.applicantId ?? application.id }}
                  >
                    Open Application for Screening
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground">
                  Return to Testing and select Continue Guided Test on this application.
                </p>
                <label className="block space-y-2">
                  <span className="font-medium">Reviewer</span>
                  <select
                    className="min-h-11 w-full rounded-md border bg-background px-3"
                    value={selectedReviewer}
                    onChange={(e) => setSelectedReviewer(e.target.value)}
                    disabled={assigning || loading}
                  >
                    <option value="">Choose reviewer</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email || "Reviewer unavailable"}
                      </option>
                    ))}
                  </select>
                </label>
                <Button disabled={!selectedReviewer || assigning || loading} onClick={assign}>
                  {assigning ? "Assigning..." : "Assign Reviewer"}
                </Button>
              </div>
            )}
            {step === 4 && application && (
              <div className="space-y-3">
                <p>
                  {reviewer?.full_name || reviewer?.email || "The selected reviewer"} must complete
                  this practice review from their own account, just like a real application.
                </p>
                {reviewerId === userId ? (
                  <Button asChild>
                    <Link to={program.slug === "scholarship" ? "/applicants" : "/grants"}>
                      Open Review Queue
                    </Link>
                  </Button>
                ) : (
                  <p className="font-medium">
                    The selected reviewer must sign in and open their Review Queue. You are not
                    signed in as that reviewer.
                  </p>
                )}
                <p className="text-sm">
                  Complete any required screening, open the evidence, score the rubric, add
                  comments, save a draft, then submit. Grant reviewers also declare conflicts and
                  complete certification.
                </p>
                <p role="status">
                  Status: {result?.label ?? "Not Started"}. Completion is checked every 10 seconds
                  while Testing is open.
                </p>
                <Button variant="outline" onClick={refresh} disabled={loading}>
                  Refresh Progress
                </Button>
                <p className="text-sm text-muted-foreground">
                  Return to Testing and choose Continue Guided Test to confirm the result.
                </p>
              </div>
            )}
            {step === 5 && application && (
              <div className="space-y-3">
                <p role="status">The practice review was successfully submitted.</p>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                  <dt>Reviewer</dt>
                  <dd className="break-words">
                    {reviewer?.full_name || reviewer?.email || "Selected reviewer"}
                  </dd>
                  <dt>Program</dt>
                  <dd>{program.name}</dd>
                  <dt>Status</dt>
                  <dd>Completed</dd>
                  {result?.score !== null && result?.score !== undefined && (
                    <>
                      <dt>Score</dt>
                      <dd>{result.score}</dd>
                    </>
                  )}
                </dl>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setManual([]);
                      reset(application);
                    }}
                  >
                    Reset and Test Again
                  </Button>
                  <Button
                    onClick={() =>
                      update({ guide: false, application: application.id, reviewer: reviewerId })
                    }
                  >
                    Finish
                  </Button>
                </div>
              </div>
            )}
            {application && step >= 4 && (
              <Button
                variant="outline"
                onClick={() => update({ guide: true, application: application.id })}
              >
                Choose Another Reviewer
              </Button>
            )}
            {application && (
              <details className="space-y-3 rounded-md border p-3">
                <summary className="min-h-11 cursor-pointer font-semibold">
                  Testing Checklist (optional)
                </summary>
                <p className="text-sm">Observed from saved progress:</p>
                <ul className="text-sm">
                  <li>Practice application created: Yes</li>
                  <li>
                    Reviewer assigned:{" "}
                    {result?.assignment.lifecycle === "active" ? "Yes" : "Not yet"}
                  </li>
                  <li>Review started: {result?.started ? "Yes" : "Not yet"}</li>
                  <li>Review completed: {result?.completed ? "Yes" : "Not yet"}</li>
                </ul>
                <p className="text-sm">
                  Check these only after observing them yourself. They are not automatically
                  verified or saved as review results.
                </p>
                {testingChecklist.map((item) => (
                  <label key={item} className="flex min-h-11 items-start gap-3 text-sm">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={manual.includes(item)}
                      onChange={(e) =>
                        setManual(
                          e.target.checked ? [...manual, item] : manual.filter((x) => x !== item),
                        )
                      }
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </details>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="break-words text-destructive">
            {error}
          </p>
        )}
        <Link to="/help" hash="testing" className="inline-flex items-center text-sm underline">
          View Testing Guide
        </Link>
      </DialogContent>
    </Dialog>
  );
}
