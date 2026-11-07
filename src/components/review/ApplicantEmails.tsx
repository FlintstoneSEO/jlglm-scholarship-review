import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  type ApplicationEmailWorkspace,
} from "@/lib/application-email-schema";
import {
  applicationEmailTemplate,
  emailBlockedReason,
  validateApplicantEmail,
  EMAIL_SENDER,
  type EmailKind,
} from "@/lib/application-email-templates";
import {
  applicantEmailConfiguration,
  downloadApplicantLetter,
  sendApplicantEmail,
} from "@/lib/application-email.server";

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
  const [kind, setKind] = useState<EmailKind>(state.recipient ? "recipient" : "decision");
  const initial = applicationEmailTemplate(kind, state.name);
  const [subject, setSubject] = useState(initial.subject),
    [body, setBody] = useState(initial.body);
  const [confirmed, setConfirmed] = useState(false),
    [preview, setPreview] = useState(false),
    [reason, setReason] = useState("");
  const [notice, setNotice] = useState(""),
    [reconcileId, setReconcileId] = useState(""),
    [evidence, setEvidence] = useState("");
  const config = useQuery({
    queryKey: ["applicant-email-config", state.applicationId],
    queryFn: async () => {
      const result = await applicantEmailConfiguration({
        data: { applicationId: state.applicationId },
      });
      if (!result || typeof result.configured !== "boolean")
        throw new Error("Could not verify mailbox access. Sign in again.");
      return result;
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
      await refresh();
    },
  });
  const send = useMutation({
    mutationFn: async () => {
      const result = await sendApplicantEmail({
        data: {
          id: crypto.randomUUID(),
          applicationId: state.applicationId,
          fingerprint: state.fingerprint,
          kind,
          subject,
          body,
          nonSelectionConfirmed: kind === "decision" && confirmed,
          phoneContactConfirmed: kind === "recipient" && confirmed,
        },
      });
      if (!result || !["accepted", "failed", "unknown"].includes(result.status))
        throw new Error(
          "Could not verify the send outcome. Sign in again and check the email history before retrying.",
        );
      return result;
    },
    onSuccess: async (result) => {
      setNotice(
        result.status === "accepted"
          ? "Gmail accepted the email. This does not confirm delivery."
          : (result.message ?? "Check the email history."),
      );
      setPreview(false);
      setConfirmed(false);
      await refresh();
    },
    onError: async () => {
      await refresh();
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
  const pending = send.isPending || decision.isPending || reconcile.isPending;
  const changeKind = (value: EmailKind) => {
    const t = applicationEmailTemplate(value, state.name);
    setKind(value);
    setSubject(t.subject);
    setBody(t.body);
    setConfirmed(false);
    setNotice("");
    send.reset();
  };
  return (
    <section className="min-w-0 space-y-5" aria-label="Applicant emails">
      <header>
        <h3 className="font-display text-xl">Applicant emails</h3>
        <p className="text-sm text-muted-foreground">
          Preview and send one owner-addressed email at a time.
        </p>
      </header>
      <dl className="grid gap-3 border-y py-4 sm:grid-cols-2 text-sm break-words">
        <div>
          <dt className="text-muted-foreground">Applicant</dt>
          <dd>
            {state.name} · {state.businessName}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">To</dt>
          <dd>{state.email || "Missing applicant email"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">From</dt>
          <dd>{EMAIL_SENDER}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Required reviews completed</dt>
          <dd>
            {state.completed} of {state.assigned}
            {state.assigned === 0 ? " — no active assignments" : ""}
          </dd>
        </div>
      </dl>
      <p className="text-sm">
        Decision:{" "}
        <strong>
          {state.recipient
            ? "Grant recipient"
            : state.notSelected
              ? "Explicitly marked Not selected"
              : "No explicit non-selection decision"}
        </strong>
        {state.decisionReason && (
          <span className="block text-muted-foreground">{state.decisionReason}</span>
        )}
      </p>
      {!state.recipient && (
        <details className="border-b pb-4">
          <summary className="cursor-pointer py-3 font-medium">
            Record or clear a Not selected decision
          </summary>
          <p className="text-sm my-3">
            This records the committee’s decision without marking unfinished reviews complete. A
            reason is required. It permits an application-decision email even when reviews are
            outstanding.
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
      <fieldset disabled={pending} className="space-y-4 min-w-0">
        <legend className="font-semibold mb-3">Compose email</legend>
        <label className="block text-sm font-medium" htmlFor="email-kind">
          Letter
        </label>
        <select
          id="email-kind"
          className="w-full min-h-11 rounded-md border bg-background px-3"
          value={kind}
          onChange={(e) => changeKind(e.target.value as EmailKind)}
        >
          <option value="decision">Application decision</option>
          <option value="recipient">Recipient congratulations</option>
        </select>
        <Button variant="outline" onClick={() => download.mutate()} disabled={download.isPending}>
          Download original letter
        </Button>
        {download.isError && <p role="alert">{download.error.message}</p>}
        <p className="text-sm text-muted-foreground">
          Based on Prince’s November 7 letters. Verify dates and application-count wording before
          sending. The text goes in the email body; the original letter is not attached.
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
        <label className="flex items-start gap-3 py-2 text-sm">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
          />
          <span>
            {kind === "recipient"
              ? "I confirm Prince’s phone contact is complete and this recipient should receive the congratulations email."
              : "I confirm this applicant was not selected and should receive this application-decision email."}
          </span>
        </label>
        {blocked && (
          <p role="status" className="text-sm">
            {blocked}
          </p>
        )}
        {issue && (
          <p role="status" className="text-sm">
            {issue}
          </p>
        )}
        {config.isPending ? (
          <p role="status">Checking email availability…</p>
        ) : config.isError ? (
          <p role="alert">
            Email configuration could not be checked.{" "}
            <Button variant="outline" onClick={() => config.refetch()}>
              Retry
            </Button>
          </p>
        ) : (
          !config.data.configured && (
            <p role="status" className="text-sm">
              Sending is not configured yet. You can prepare and preview the email; the portal
              administrator must connect the Justice League mailbox.
            </p>
          )
        )}
        <Button
          disabled={!!blocked || !!issue || !confirmed || pending}
          onClick={() => setPreview(true)}
        >
          Preview email
        </Button>
      </fieldset>
      {notice && <p role="status">{notice}</p>}
      {send.isError && !preview && (
        <p role="alert" className="text-destructive">
          {send.error.message}
        </p>
      )}
      <section aria-label="Email history" className="space-y-3">
        <h4 className="font-semibold">Email history</h4>
        {!state.history.length && (
          <p className="text-sm text-muted-foreground">
            No emails have been sent from the portal for this applicant.
          </p>
        )}
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
      <Dialog
        open={preview}
        onOpenChange={(v) => {
          if (!send.isPending) setPreview(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-left">Review applicant email</DialogTitle>
            <DialogDescription>
              To {state.name}. Review the exact message below. Sending cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 break-words">
            <p className="text-sm">
              From: {EMAIL_SENDER}
              <br />
              To: {state.email}
            </p>
            <h4 className="font-semibold">{subject}</h4>
            <pre className="whitespace-pre-wrap font-sans text-sm">{body}</pre>
          </div>
          {send.isError && (
            <p role="alert" className="text-destructive">
              {send.error.message}
            </p>
          )}
          {!config.data?.configured && (
            <p role="status">Sending is unavailable until the mailbox is configured.</p>
          )}
          <Button
            disabled={send.isPending || !!blocked || !config.data?.configured}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "Sending…" : "Send email now"}
          </Button>
          <Button variant="outline" disabled={send.isPending} onClick={() => setPreview(false)}>
            Keep editing
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
