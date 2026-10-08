import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TestApplicationBadge } from "./TestApplicationBadge";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Profile = { id: string; full_name: string | null; email: string | null };
type Selection = { id: string; round: number } | null;
const control =
  "min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
function useSessions(programId: string) {
  return useQuery({
    queryKey: ["grant-practice", programId],
    queryFn: async () => {
      const r = await supabase
        .from("grant_practice_sessions")
        .select("*")
        .eq("program_id", programId)
        .is("ended_at", null)
        .order("created_at", { ascending: false });
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
}
export function GrantPracticeSessions({
  programId,
  profiles,
  selected,
  onSelect,
}: {
  programId: string;
  profiles: Profile[];
  selected: Selection;
  onSelect: (s: Selection) => void;
}) {
  const sessions = useSessions(programId);
  const qc = useQueryClient();
  const [name, setName] = useState("Grant walkthrough");
  const [participants, setParticipants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const current = sessions.data?.find((s) => s.id === selected?.id);
  async function run(action: "start" | "reset" | "end") {
    if (busy) return;
    if (
      action !== "start" &&
      (!current ||
        !window.confirm(
          action === "reset"
            ? "Reset this practice run? Current practice work will be archived and 40 fresh fictional applications created. Real applications and reviews are unaffected."
            : "End this practice run? Practice work will be archived. Real applications and reviews are unaffected.",
        ))
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (action === "start") {
        const r = await supabase.rpc("start_grant_practice", {
          p_program: programId,
          p_name: name,
          p_participants: participants,
        });
        if (r.error) throw r.error;
        onSelect({ id: r.data, round: 1 });
      } else {
        const r = await supabase.rpc("reset_grant_practice", {
          p_session: current!.id,
          p_round: current!.round,
          p_end: action === "end",
        });
        if (r.error) throw r.error;
        onSelect(action === "end" ? null : { id: current!.id, round: current!.round + 1 });
      }
      await qc.invalidateQueries();
      setMessage(
        action === "start"
          ? "Practice run created with 40 fictional applications."
          : action === "reset"
            ? "Practice work archived. A fresh round is ready."
            : "Practice run ended and archived.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card id="grant-practice-controls" className="min-w-0 space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl">Grant practice run</h2>
      <TestApplicationBadge isTest />
      <p className="text-sm">
        Rehearse with fictional applications using existing accounts. Practice scores stay outside
        real queues and rankings. Reset archives the previous round and creates a fresh one.
      </p>
      {sessions.isLoading && <p role="status">Loading practice sessions…</p>}
      {sessions.isError && (
        <div role="alert">
          Practice sessions are temporarily unavailable.{" "}
          <Button onClick={() => sessions.refetch()}>Retry</Button>
        </div>
      )}
      <label className="block space-y-1 text-sm">
        Review scope
        <select
          className={control}
          value={selected?.id ?? ""}
          disabled={busy || sessions.isLoading || sessions.isError}
          onChange={(e) => {
            const s = sessions.data?.find((s) => s.id === e.target.value);
            onSelect(s ? { id: s.id, round: s.round } : null);
          }}
        >
          <option value="">Real applications</option>
          {sessions.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · Practice round {s.round}
            </option>
          ))}
        </select>
      </label>
      {current && (
        <div className="space-y-3">
          <p role="status">
            PRACTICE: {current.name}, round {current.round}. Use the screening, group allocation and
            assignment controls below for this round.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" disabled={busy} onClick={() => run("reset")}>
              Reset Practice Run
            </Button>
            <Button
              className="min-h-11"
              variant="outline"
              disabled={busy}
              onClick={() => run("end")}
            >
              End Practice Run
            </Button>
          </div>
        </div>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer font-semibold">
          Start a new practice run
        </summary>
        <fieldset disabled={busy || sessions.isError} className="mt-3 min-w-0 space-y-3">
          <legend className="text-sm">Select existing Grant accounts to participate</legend>
          <label className="block space-y-1 text-sm">
            Practice run name
            <input
              className={control}
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <p className="text-sm">
            Two testers can rehearse manual paired review. Random allocation across three saved
            pairs requires all six group members to be participants. Include another participant to
            test replacement.
          </p>
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li key={p.id}>
                <label className="flex min-h-11 items-start gap-3 break-all text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={participants.includes(p.id)}
                    onChange={(e) =>
                      setParticipants(
                        e.target.checked
                          ? [...participants, p.id]
                          : participants.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <span>
                    {p.full_name || p.email} · {p.email}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <Button
            className="min-h-11"
            disabled={!name.trim() || participants.length < 2 || participants.length > 20}
            onClick={() => run("start")}
          >
            {busy ? "Working…" : "Start Practice Run"}
          </Button>
        </fieldset>
      </details>
      {busy && <p role="status">Updating practice session…</p>}
      {error && (
        <p role="alert" className="break-words text-destructive">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </Card>
  );
}

export function GrantPracticeQueue({ programId }: { programId: string }) {
  const sessions = useSessions(programId);
  const [selected, setSelected] = useState("");
  const current = sessions.data?.find((s) => s.id === selected);
  const apps = useQuery({
    queryKey: ["practice-applications", current?.id, current?.round],
    enabled: !!current,
    queryFn: async () => {
      const r = await supabase
        .from("portal_applications")
        .select("id,applicant_name,review_status")
        .eq("practice_session_id", current!.id)
        .eq("practice_round", current!.round)
        .order("applicant_name");
      if (r.error) throw r.error;
      return r.data ?? [];
    },
  });
  if (sessions.isError)
    return (
      <p role="alert">
        Practice sessions could not be loaded.{" "}
        <Button onClick={() => sessions.refetch()}>Retry</Button>
      </p>
    );
  if (!sessions.data?.length) return null;
  return (
    <Card className="min-w-0 space-y-3 p-4">
      <h2 className="font-display text-xl">Practice applications</h2>
      <label className="block text-sm">
        Choose a practice run
        <select className={control} value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a practice run</option>
          {sessions.data.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · Round {s.round}
            </option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        Fictional training records. Open an assigned application to screen, declare conflicts and
        review.
      </p>
      {apps.isLoading && <p role="status">Loading practice applications…</p>}
      {apps.isError && (
        <p role="alert">
          Practice applications could not be loaded.{" "}
          <Button onClick={() => apps.refetch()}>Retry</Button>
        </p>
      )}
      <ul className="space-y-2">
        {apps.data?.map((a) => (
          <li key={a.id}>
            <Link
              className="inline-flex min-h-11 items-center break-words text-sm underline"
              to="/grants/$id"
              params={{ id: a.id }}
            >
              {a.applicant_name} · {a.review_status}
            </Link>
          </li>
        ))}
      </ul>
      {current && apps.data?.length === 0 && (
        <p>No accessible applications yet. An administrator must assign your practice reviews.</p>
      )}
    </Card>
  );
}
