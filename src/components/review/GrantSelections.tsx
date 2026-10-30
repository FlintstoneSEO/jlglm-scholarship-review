import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { GrantRankingRow } from "@/lib/grant-ranking-summary";
export function useGrantSelection(programId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["grant-selection", programId],
    enabled: enabled && !!programId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("grant_selection_decisions")
        .select("*")
        .eq("program_id", programId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
export function GrantSelections({
  programId,
  rows,
}: {
  programId: string;
  rows: GrantRankingRow[];
}) {
  const query = useGrantSelection(programId, true),
    cache = useQueryClient();
  const [draft, setDraft] = useState<string[] | null>(null),
    [recipients, setRecipients] = useState<string[]>([]),
    [confirm, setConfirm] = useState(false);
  const saved = query.data,
    finalists = draft ?? saved?.finalist_ids ?? [],
    locked = !!saved?.finalized_at;
  const mutation = useMutation({
    mutationFn: async (finalize: boolean) => {
      const { error } = await supabase.rpc("save_grant_selection", {
        p_program: programId,
        p_finalists: finalize ? saved!.finalist_ids : finalists,
        p_recipients: finalize ? recipients : [],
        p_revision: saved?.revision ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setDraft(null);
      setConfirm(false);
      await cache.invalidateQueries({ queryKey: ["grant-selection", programId] });
    },
  });
  if (query.isPending) return <p role="status">Loading committee selections…</p>;
  if (query.isError)
    return (
      <div role="alert">
        <p>
          Committee selections could not be loaded. The selection database update may still be
          pending.
        </p>
        <Button variant="outline" onClick={() => query.refetch()}>
          Retry
        </Button>
      </div>
    );
  const toggle = (ids: string[], id: string) =>
    ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
  return (
    <section className="space-y-6">
      <header>
        <h2 className="font-display text-2xl">Finalists & recipients</h2>
        <p className="text-sm text-muted-foreground">
          Record the committee’s three interview finalists, then finalize two grant recipients.
        </p>
      </header>
      {locked ? (
        <p role="status" className="font-medium">
          Two recipients finalized · {new Date(saved!.finalized_at!).toLocaleDateString()}
        </p>
      ) : null}
      <fieldset disabled={locked || mutation.isPending} className="space-y-3">
        <legend className="font-semibold">Interview finalists · {finalists.length} of 3</legend>
        <div className="divide-y border-y">
          {rows
            .filter((r) => !locked || finalists.includes(r.applicationId))
            .map((r) => (
              <label key={r.applicationId} className="flex items-start gap-3 py-4">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5"
                  checked={finalists.includes(r.applicationId)}
                  disabled={!finalists.includes(r.applicationId) && finalists.length >= 3}
                  onChange={() => {
                    setDraft(toggle(finalists, r.applicationId));
                    setRecipients([]);
                  }}
                />
                <span className="min-w-0 break-words">
                  <span className="block font-medium">{r.businessName}</span>
                  <span className="text-sm text-muted-foreground">{r.applicantName}</span>
                  {saved?.recipient_ids.includes(r.applicationId) && (
                    <strong className="block text-sm text-success">Grant recipient</strong>
                  )}
                </span>
              </label>
            ))}
        </div>
        {!locked && (
          <Button
            disabled={finalists.length !== 3 || draft === null}
            onClick={() => mutation.mutate(false)}
          >
            Save three finalists
          </Button>
        )}
      </fieldset>
      {saved && !locked && draft === null && (
        <fieldset disabled={mutation.isPending} className="space-y-3">
          <legend className="font-semibold">Grant recipients · {recipients.length} of 2</legend>
          {saved.finalist_ids.map((id) => (
            <div
              key={id}
              className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={recipients.includes(id)}
                  disabled={!recipients.includes(id) && recipients.length >= 2}
                  onChange={() => setRecipients(toggle(recipients, id))}
                />
                {rows.find((r) => r.applicationId === id)?.businessName ??
                  "Application unavailable"}
              </label>
              <Link to="/grants/$id" params={{ id }} className="text-primary underline">
                View application
              </Link>
            </div>
          ))}
          <Button disabled={recipients.length !== 2} onClick={() => setConfirm(true)}>
            Finalize two recipients
          </Button>
        </fieldset>
      )}
      {mutation.isError && (
        <p role="alert" className="text-destructive">
          {mutation.error.message}
        </p>
      )}
      <Dialog
        open={confirm}
        onOpenChange={(value) => {
          if (!mutation.isPending) setConfirm(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalize these two recipients?</DialogTitle>
            <DialogDescription>
              This records the committee’s final decision. Selections will be locked after
              confirmation.
            </DialogDescription>
          </DialogHeader>
          <ul className="list-disc pl-5">
            {recipients.map((id) => (
              <li key={id}>{rows.find((r) => r.applicationId === id)?.businessName}</li>
            ))}
          </ul>
          <Button disabled={mutation.isPending} onClick={() => mutation.mutate(true)}>
            {mutation.isPending ? "Saving…" : "Confirm two recipients"}
          </Button>
          <Button variant="outline" disabled={mutation.isPending} onClick={() => setConfirm(false)}>
            Keep editing
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
