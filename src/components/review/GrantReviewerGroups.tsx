import { useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useGrantReviewerGroups } from "@/lib/use-grant-reviewer-groups";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
type Profile = { id: string; full_name: string | null; email: string | null };
export function GrantReviewerGroups({
  programId,
  profiles,
}: {
  programId: string;
  profiles: Profile[];
}) {
  const groups = useGrantReviewerGroups(programId);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<{ id: string; revision: number } | null>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const label = (id: string) => {
    const p = profiles.find((p) => p.id === id);
    return p
      ? (p.full_name || p.email || id) + " (" + (p.email || id) + ")"
      : id + " - Grant reviewer access unavailable";
  };
  function reset() {
    setEditing(null);
    setName("");
    setMembers([]);
    setError("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy || groups.isLoading || groups.isError) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await supabase.rpc("save_grant_reviewer_group", {
        p_program: programId,
        p_name: name.trim(),
        p_members: members,
        ...(editing ? { p_group: editing.id, p_revision: editing.revision } : {}),
      });
      if (result.error?.code === "23505")
        throw new Error("A group with this name already exists. Choose a different name.");
      if (result.error) throw result.error;
      reset();
      await qc.invalidateQueries();
      setMessage("Group saved. Existing assignments and reviews retain their original identities.");
    } catch (e) {
      setError(String((e as { message?: string }).message ?? e));
    } finally {
      setBusy(false);
    }
  }
  const valid =
    name.trim().length > 0 &&
    members.length > 0 &&
    members.length <= 20 &&
    members.every((id) => profiles.some((p) => p.id === id));
  return (
    <Card id="grant-reviewer-groups" className="min-w-0 space-y-4 p-4 sm:p-5">
      <h2 className="font-display text-xl">Reviewer groups</h2>
      <p className="text-sm text-muted-foreground">
        Add the user to the app first through{" "}
        <Link
          to="/users"
          className="underline underline-offset-4 focus-visible:outline focus-visible:outline-2"
        >
          Users &amp; Program Access
        </Link>
        , then grant Business Growth Grant reviewer or administrator access. Groups organize
        existing accounts; saving a group sends no invitation and assigns no applications.
      </p>
      <p className="text-sm">
        Paired allocation requires three groups of exactly two people, with no reviewer shared
        between the selected groups. Changing a group makes its pending allocation preview stale;
        applied assignments stay intact.
      </p>
      {groups.isLoading && <p role="status">Loading reviewer groups...</p>}
      {groups.isError && (
        <div role="alert">
          Groups could not be loaded.{" "}
          <Button variant="outline" onClick={() => groups.refetch()}>
            Retry groups
          </Button>
        </div>
      )}
      {!groups.isLoading && !groups.isError && !groups.data?.length && (
        <p className="text-sm text-muted-foreground">No groups yet. Create a named group below.</p>
      )}
      <ul className="space-y-3">
        {groups.data?.map((g) => (
          <li key={g.id} className="min-w-0 border-b pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 break-words font-semibold">{g.name}</h3>
              <Button
                variant="outline"
                disabled={busy || groups.isError}
                aria-label={"Edit group " + g.name}
                onClick={() => {
                  setEditing({ id: g.id, revision: g.revision });
                  setName(g.name);
                  setMembers(g.members);
                  setError("");
                  setMessage("");
                }}
              >
                Edit group
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {g.members.length} members · Revision {g.revision}
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {g.members.map((id) => (
                <li key={id} className="break-words">
                  {label(id)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <form onSubmit={save} className="min-w-0 space-y-3">
        <fieldset
          disabled={busy || groups.isLoading || groups.isError}
          className="min-w-0 space-y-3"
        >
          <legend className="font-semibold">{editing ? "Edit group" : "Create group"}</legend>
          <label className="block text-sm">
            Group name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Existing Grant accounts ({members.length} selected)
            </legend>
            {!profiles.length && (
              <p className="text-sm">
                No accounts with Grant reviewer/admin access. Add users and program access first.
              </p>
            )}
            {profiles.map((p) => (
              <label key={p.id} className="flex min-h-11 min-w-0 items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1 shrink-0 focus-visible:outline focus-visible:outline-2"
                  checked={members.includes(p.id)}
                  onChange={(e) =>
                    setMembers(
                      e.target.checked ? [...members, p.id] : members.filter((id) => id !== p.id),
                    )
                  }
                />
                <span className="min-w-0 break-words">
                  {label(p.id)}
                  <span className="block text-xs text-muted-foreground">Account ID: {p.id}</span>
                </span>
              </label>
            ))}
            {members
              .filter((id) => !profiles.some((p) => p.id === id))
              .map((id) => (
                <label key={id} className="flex min-h-11 min-w-0 items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked
                    onChange={() => setMembers(members.filter((m) => m !== id))}
                  />
                  <span className="break-words">
                    {label(id)}. Remove this unavailable member before saving.
                  </span>
                </label>
              ))}
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={!valid}>
              {busy ? "Saving group..." : "Save group"}
            </Button>
            {editing && (
              <Button type="button" variant="outline" onClick={reset}>
                Cancel edit
              </Button>
            )}
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </Card>
  );
}
