import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  applicationEmailWorkspaceSchema,
  isDecisionEmailTrackingUnavailable,
  type ApplicationEmailWorkspace,
} from "@/lib/application-email-schema";
import {
  applicationEmailDraftLink,
  applicationEmailTemplate,
  emailBlockedReason,
  validateApplicantEmail,
} from "@/lib/application-email-templates";
import { downloadApplicantLetter } from "@/lib/application-email.server";

const statusLabels = {
  reserved: "Reserved — delivery has not started",
  sending: "Sending — awaiting outcome",
  accepted: "Accepted by Gmail (delivery not confirmed)",
  failed: "Not sent",
  unknown: "Outcome unknown — check the mailbox",
};

export function ApplicantEmails({ applicationId }: { applicationId: string }) {
  const query = useQuery({
    queryKey: ["applicant-email", applicationId],
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const result = await supabase.rpc("application_email_workspace", {
        p_application: applicationId,
      });
      if (result.error) throw new Error(result.error.message);
      return applicationEmailWorkspaceSchema.parse(result.data);
    },
  });
  if (query.isPending) return <p role="status">Loading applicant email details…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>{query.error.message}</p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Reload email details
        </Button>
      </div>
    );
  return (
    <EmailEditor
      key={applicationId + query.data.fingerprint}
      state={query.data}
      refresh={() => query.refetch()}
    />
  );
}

function EmailEditor({
  state,
  refresh,
}: {
  state: ApplicationEmailWorkspace;
  refresh: () => Promise<unknown>;
}) {
  const kind = state.recipient ? "recipient" : "decision";
  const queryClient = useQueryClient();
  const initial = applicationEmailTemplate(kind, state.name);
  const [subject, setSubject] = useState(initial.subject),
    [body, setBody] = useState(initial.body);
  const [preview, setPreview] = useState(false),
    [reason, setReason] = useState("");
  const [reconcileId, setReconcileId] = useState(""),
    [evidence, setEvidence] = useState("");
  const [confirmSent, setConfirmSent] = useState(false);
  const sent = useQuery({
    queryKey: [
      "grant-decision-email-record",
      state.applicationId,
      state.decisionId,
      state.recipient,
    ],
    enabled: state.recipient || state.notSelected,
    queryFn: async () => {
      const request = supabase
        .from("grant_decision_email_sent")
        .select("recorded_at,recorded_by,recorded_by_name")
        .eq("application_id", state.applicationId);
      const result = await (
        state.recipient
          ? request.is("decision_id", null)
          : request.eq("decision_id", state.decisionId!)
      ).maybeSingle();
      if (result.error && isDecisionEmailTrackingUnavailable(result.error))
        return "unavailable" as const;
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });
  const trackingUnavailable = sent.data === "unavailable";
  const sentRecord = sent.data === "unavailable" ? null : sent.data;
  const markSent = useMutation({
    mutationFn: async () => {
      const result = await supabase.rpc("record_grant_decision_email_sent", {
        p_application: state.applicationId,
        p_fingerprint: state.fingerprint,
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        sent.refetch(),
        queryClient.invalidateQueries({
          queryKey: ["grant-decision-email-status", state.programId],
        }),
      ]);
      setConfirmSent(false);
    },
    onError: () => {
      void refresh();
    },
  });
  const decision = useMutation({
    mutationFn: async (notSelected: boolean) => {
      const result = await supabase.rpc("record_application_non_selection", {
        p_application: state.applicationId,
        p_fingerprint: state.fingerprint,
        p_not_selected: notSelected,
        p_reason: reason,
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      await Promise.all([
        refresh(),
        queryClient.invalidateQueries({
          queryKey: ["grant-application-decisions", state.programId],
        }),
      ]);
    },
  });
  const download = useMutation({
    mutationFn: async () => {
      const result = await downloadApplicantLetter({
        data: { applicationId: state.applicationId, kind },
      });
      if (
        !result ||
        typeof result.base64 !== "string" ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(result.base64)
      )
        throw new Error("Could not authorize the letter download. Sign in again and retry.");
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
  });
  const reconcile = useMutation({
    mutationFn: async (accepted: boolean) => {
      const result = await supabase.rpc("reconcile_application_email", {
        p_email: reconcileId,
        p_accepted: accepted,
        p_evidence: evidence,
      });
      if (result.error) throw new Error(result.error.message);
    },
    onSuccess: async () => {
      setReconcileId("");
      setEvidence("");
      await refresh();
    },
  });
  const existing = state.history.some((h) => h.kind === kind && h.status !== "failed");
  const blocked =
    emailBlockedReason(state, kind) ??
    (existing
      ? "An email is already reserved or sent. Check its history before taking further action."
      : null);
  const issue = validateApplicantEmail(subject, body);
  const pending = decision.isPending || reconcile.isPending;
  return (
    <section className="min-w-0 space-y-5" aria-label="Decision and email">
      <header>
        <h3 className="font-display text-xl">Decision &amp; email</h3>
        <p className="text-sm text-muted-foreground">
          Prepare a personalized draft and send it from your email app.
        </p>
      </header>
      <p className="text-sm">
        Decision:{" "}
        <strong>
          {state.recipient ? "Grant recipient" : state.notSelected ? "Not selected" : "No decision"}
        </strong>
        {state.notSelected && state.decisionReason && (
          <span className="block text-muted-foreground">{state.decisionReason}</span>
        )}
      </p>
      {!state.recipient && (
        <details className="border-b pb-4">
          <summary className="cursor-pointer py-3 font-medium">
            {state.notSelected ? "Change decision" : "Mark not selected"}
          </summary>
          <p className="my-3 text-sm">
            You can record a decision while reviews are still in progress.
          </p>
          <label htmlFor="decision-reason" className="block text-sm font-medium mb-2">
            Decision reason (10–2,000 characters)
          </label>
          <Textarea
            id="decision-reason"
            value={reason}
            maxLength={2000}
            onChange={(e) => setReason(e.target.value)}
            disabled={pending}
          />
          <Button
            className="mt-3 min-h-11"
            variant="outline"
            disabled={
              pending ||
              reason.trim().length < 10 ||
              state.history.some((h) => h.status !== "failed")
            }
            onClick={() => decision.mutate(!state.notSelected)}
          >
            {state.notSelected ? "Clear Not selected decision" : "Record Not selected decision"}
          </Button>
          {decision.isError && (
            <p role="alert" className="mt-2 text-destructive">
              {decision.error.message}
            </p>
          )}
        </details>
      )}
      {sentRecord ? (
        <p role="status" className="text-sm">
          <strong>Decision email sent</strong>
          {" · "}
          Recorded {new Date(sentRecord.recorded_at).toLocaleString()}
          {sentRecord.recorded_by_name ? ` by ${sentRecord.recorded_by_name}` : ""}
        </p>
      ) : blocked ? (
        <p role="status" className="text-sm text-muted-foreground">
          {blocked}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={pending || !sent.isSuccess} onClick={() => setPreview(true)}>
            {state.recipient
              ? "Prepare congratulations email"
              : "Prepare application decision email"}
          </Button>
        </div>
      )}
      {(state.recipient || state.notSelected) &&
        (sent.isError ? (
          <p role="alert" className="text-sm">
            Email status could not be loaded.{" "}
            <button className="underline" type="button" onClick={() => sent.refetch()}>
              Retry
            </button>
          </p>
        ) : trackingUnavailable ? (
          <p className="text-sm text-muted-foreground">Sent tracking isn’t set up yet.</p>
        ) : sent.isPending ? (
          <p role="status" className="text-sm">
            Checking email status…
          </p>
        ) : (
          !sent.data && (
            <Button
              variant="outline"
              disabled={pending}
              onClick={() => {
                markSent.reset();
                setConfirmSent(true);
              }}
            >
              Mark decision email sent
            </Button>
          )
        ))}
      {state.history.length > 0 && (
        <section aria-label="Email history" className="space-y-3">
          <h4 className="font-semibold">Email history</h4>
          {state.history.map((h) => (
            <details className="border-b pb-3" key={h.id}>
              <summary className="cursor-pointer py-3 break-words">
                {statusLabels[h.status]} · {new Date(h.created_at).toLocaleString()}
              </summary>
              <div className="space-y-2 text-sm break-words">
                <p>To: {h.recipient}</p>
                <p>Subject: {h.subject}</p>
                <p>Administrator ID: {h.actor_id}</p>
                <p>Message reference: {h.id}@justiceleagueglm.org</p>
                {h.provider_id && <p>Gmail reference: {h.provider_id}</p>}
                <pre className="whitespace-pre-wrap font-sans">{h.body}</pre>
                {h.error_message && <p>{h.error_message}</p>}
                {["unknown", "reserved", "sending"].includes(h.status) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setReconcileId(h.id);
                      setEvidence("");
                    }}
                  >
                    Record verified mailbox outcome
                  </Button>
                )}
              </div>
            </details>
          ))}
        </section>
      )}
      <Dialog open={preview} onOpenChange={setPreview}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">Review applicant email</DialogTitle>
            <DialogDescription>
              To {state.name}. Check the draft, then choose your sender account and send from your
              email app.
            </DialogDescription>
          </DialogHeader>
          <p className="break-words text-sm">To: {state.email}</p>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => download.mutate()}
              disabled={download.isPending}
            >
              Download original letter
            </Button>
            {download.isError && <p role="alert">{download.error.message}</p>}
            <p className="text-sm text-muted-foreground">
              Based on Prince’s November 7 letters. Verify dates and application-count wording
              before sending. The text goes in the email body; the original letter is not attached.
            </p>
            <div>
              <label htmlFor="email-subject" className="block text-sm font-medium mb-2">
                Subject
              </label>
              <Input
                id="email-subject"
                value={subject}
                maxLength={160}
                onChange={(e) => setSubject(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="email-body" className="block text-sm font-medium mb-2">
                Email body
              </label>
              <Textarea
                id="email-body"
                className="min-h-80"
                value={body}
                maxLength={20000}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
          </div>
          {issue && (
            <p role="status" className="text-sm">
              {issue}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Review the subject and letter here. If your email app does not open, copy them into a
            new email.
          </p>
          {!blocked && !sentRecord && sent.isSuccess && !issue && state.email && (
            <Button asChild>
              <a href={applicationEmailDraftLink(state.email, subject, body)}>Open email draft</a>
            </Button>
          )}
          <Button variant="outline" onClick={() => setPreview(false)}>
            Keep editing
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={confirmSent}
        onOpenChange={(open) => {
          if (!markSent.isPending) setConfirmSent(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark decision email sent?</DialogTitle>
            <DialogDescription>
              Confirm you already sent the{" "}
              {state.recipient ? "congratulations" : "application decision"} email to {state.name}.
              The portal will record your confirmation and the current time.
            </DialogDescription>
          </DialogHeader>
          {markSent.isError && <p role="alert">{markSent.error.message}</p>}
          <Button disabled={markSent.isPending || !!sent.data} onClick={() => markSent.mutate()}>
            {markSent.isPending ? "Recording…" : "Confirm email sent"}
          </Button>
          <Button
            variant="outline"
            disabled={markSent.isPending}
            onClick={() => setConfirmSent(false)}
          >
            Cancel
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!reconcileId}
        onOpenChange={(v) => {
          if (!reconcile.isPending && !v) setReconcileId("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify the mailbox outcome</DialogTitle>
            <DialogDescription>
              Wait at least five minutes. Check the Justice League mailbox and message reference
              first. An absent message alone may not prove rejection. Only a verified non-send
              permits retrying.
            </DialogDescription>
          </DialogHeader>
          <label htmlFor="mailbox-evidence" className="text-sm font-medium">
            Verification evidence (20–2,000 characters)
          </label>
          <Textarea
            id="mailbox-evidence"
            value={evidence}
            maxLength={2000}
            onChange={(e) => setEvidence(e.target.value)}
          />
          {reconcile.isError && <p role="alert">{reconcile.error.message}</p>}
          <Button
            disabled={reconcile.isPending || evidence.trim().length < 20}
            onClick={() => reconcile.mutate(true)}
          >
            Confirmed Gmail accepted it
          </Button>
          <Button
            variant="outline"
            disabled={reconcile.isPending || evidence.trim().length < 20}
            onClick={() => reconcile.mutate(false)}
          >
            Confirmed it was not sent
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
