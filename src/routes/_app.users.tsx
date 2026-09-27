import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type ProgramAccessRole } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { invitePortalUser } from "@/lib/invite-user.server";
import { displayProfileName, type Invitation } from "@/lib/user-management";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/users")({ component: UsersPage });

function UsersPage() {
  const { role, user, selectedProgram, programs } = useAuth();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitation, setInvitation] = useState<Invitation>({
    firstName: "",
    lastName: "",
    email: "",
    globalRole: "viewer",
    programId: selectedProgram?.programId ?? "",
    programRole: "reviewer",
  });
  const canManage = role === "admin" || selectedProgram?.accessRole === "admin";
  const { data = [], isLoading } = useQuery({
    queryKey: ["all-users-roles", selectedProgram?.programId],
    enabled: canManage,
    queryFn: async () => {
      const [profilesResult, rolesResult, accessResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, first_name, last_name, created_at")
          .order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        selectedProgram
          ? supabase
              .from("user_program_access")
              .select("user_id, access_role")
              .eq("program_id", selectedProgram.programId)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;
      if (accessResult.error) throw accessResult.error;
      const rank: Record<AppRole, number> = { admin: 1, reviewer: 2, viewer: 3 };
      const roleMap = new Map<string, AppRole>();
      for (const item of rolesResult.data ?? []) {
        const current = roleMap.get(item.user_id);
        if (!current || rank[item.role] < rank[current]) roleMap.set(item.user_id, item.role);
      }
      const accessMap = new Map(
        (accessResult.data ?? []).map((item) => [
          item.user_id,
          item.access_role as ProgramAccessRole,
        ]),
      );
      return (profilesResult.data ?? []).map((profile) => ({
        ...profile,
        role: roleMap.get(profile.id) ?? ("viewer" as AppRole),
        programRole: accessMap.get(profile.id) ?? ("none" as ProgramAccessRole | "none"),
      }));
    },
  });
  const setGlobalRole = useMutation({
    mutationFn: async ({ userId, nextRole }: { userId: string; nextRole: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role: nextRole }, { onConflict: "user_id,role" });
      if (error) throw error;
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .neq("role", nextRole);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      toast.success("Global role updated.");
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const setProgramRole = useMutation({
    mutationFn: async ({
      userId,
      programRole,
    }: {
      userId: string;
      programRole: ProgramAccessRole | "none";
    }) => {
      if (!selectedProgram) throw new Error("Choose a program first.");
      if (programRole === "none") {
        const { error } = await supabase
          .from("user_program_access")
          .delete()
          .eq("user_id", userId)
          .eq("program_id", selectedProgram.programId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_program_access")
          .upsert(
            { user_id: userId, program_id: selectedProgram.programId, access_role: programRole },
            { onConflict: "user_id,program_id" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Program access updated.");
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const inviteUser = useMutation({
    mutationFn: (input: Invitation) => invitePortalUser({ data: input }),
    onSuccess: () => {
      toast.success("Invitation sent and access assigned.");
      setInviteOpen(false);
      setInvitation({
        firstName: "",
        lastName: "",
        email: "",
        globalRole: "viewer",
        programId: selectedProgram?.programId ?? "",
        programRole: "reviewer",
      });
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const submitInvitation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    inviteUser.mutate(invitation);
  };
  if (!canManage) return <Card className="p-6">Program administrator access is required.</Card>;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Users & Program Access</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage access to {selectedProgram?.name ?? "the selected program"}. Program access is
            enforced by database policies.
          </p>
        </div>
        <Button
          className="min-h-11 w-full sm:w-auto"
          onClick={() => {
            setInvitation((current) => ({
              ...current,
              programId: selectedProgram?.programId ?? current.programId,
              globalRole: role === "admin" ? current.globalRole : "viewer",
            }));
            setInviteOpen(true);
          }}
        >
          Invite User
        </Button>
      </div>
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Invite a user</DialogTitle>
            <DialogDescription>
              Send an email invitation and assign portal access.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitInvitation}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invite-first-name">First Name</Label>
                <Input
                  id="invite-first-name"
                  autoComplete="given-name"
                  required
                  maxLength={100}
                  value={invitation.firstName}
                  onChange={(event) =>
                    setInvitation({ ...invitation, firstName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-last-name">Last Name</Label>
                <Input
                  id="invite-last-name"
                  autoComplete="family-name"
                  required
                  maxLength={100}
                  value={invitation.lastName}
                  onChange={(event) =>
                    setInvitation({ ...invitation, lastName: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="email"
                required
                value={invitation.email}
                onChange={(event) => setInvitation({ ...invitation, email: event.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-global-role">Global Role</Label>
              <Select
                value={invitation.globalRole}
                onValueChange={(value) =>
                  setInvitation({ ...invitation, globalRole: value as AppRole })
                }
                disabled={role !== "admin"}
              >
                <SelectTrigger id="invite-global-role" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  {role === "admin" && <SelectItem value="reviewer">Reviewer</SelectItem>}
                  {role === "admin" && <SelectItem value="admin">Admin</SelectItem>}
                </SelectContent>
              </Select>
              {role !== "admin" && (
                <p className="text-xs text-muted-foreground">
                  Program administrators can invite users with global Viewer access.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-program">Program</Label>
              <Select
                value={invitation.programId}
                onValueChange={(value) => setInvitation({ ...invitation, programId: value })}
              >
                <SelectTrigger id="invite-program" className="min-h-11">
                  <SelectValue placeholder="Choose a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs
                    .filter((program) => role === "admin" || program.accessRole === "admin")
                    .map((program) => (
                      <SelectItem key={program.programId} value={program.programId}>
                        {program.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="invite-program-role">Program Role</Label>
              <Select
                value={invitation.programRole}
                onValueChange={(value) =>
                  setInvitation({ ...invitation, programRole: value as ProgramAccessRole })
                }
              >
                <SelectTrigger id="invite-program-role" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Program admin</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="viewer">Read-only viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteUser.isPending || !invitation.programId}>
                {inviteUser.isPending ? "Sending…" : "Send Invitation"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="record-table-wrap overflow-x-auto">
          <table className="record-table w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Global Role</th>
                <th className="text-left px-4 py-3 w-52">Program Access</th>
                {role === "admin" && (
                  <th className="text-left px-4 py-3 w-48">Update Global Role</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td
                    colSpan={role === "admin" ? 5 : 4}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </td>
                </tr>
              )}
              {data.map((item) => (
                <tr key={item.id}>
                  <td data-label="Name" data-primary className="px-4 py-3 font-medium">
                    {displayProfileName(item)}
                    {item.id === user?.id && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td data-label="Email" className="px-4 py-3 text-muted-foreground">
                    {item.email || "—"}
                  </td>
                  <td data-label="Global role" className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">
                      {item.role}
                    </Badge>
                  </td>
                  <td data-label="Program access" className="px-4 py-3">
                    <Select
                      value={item.programRole}
                      disabled={setProgramRole.isPending}
                      onValueChange={(value) =>
                        setProgramRole.mutate({
                          userId: item.id,
                          programRole: value as ProgramAccessRole | "none",
                        })
                      }
                    >
                      <SelectTrigger
                        aria-label={`Program access for ${displayProfileName(item)}`}
                        className="min-w-0"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No access</SelectItem>
                        <SelectItem value="admin">Program admin</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="viewer">Read-only viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  {role === "admin" && (
                    <td data-label="Update global role" data-action className="px-4 py-3">
                      <Select
                        value={item.role}
                        disabled={setGlobalRole.isPending}
                        onValueChange={(value) =>
                          setGlobalRole.mutate({ userId: item.id, nextRole: value as AppRole })
                        }
                      >
                        <SelectTrigger
                          aria-label={`Global role for ${displayProfileName(item)}`}
                          className="min-w-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-muted-foreground">
        Program admins manage that program only. Reviewers see assigned applications and their own
        scores. Viewers are read-only.
      </p>
    </div>
  );
}
