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
  globalRoleLabel,
  programRoleLabel,
  projectUserAccess,
  type AccessRow,
  type ManagedUser,
} from "@/lib/admin-user-access";
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
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [invitation, setInvitation] = useState<Invitation>({
    firstName: "",
    lastName: "",
    email: "",
    globalRole: "viewer",
    programId: selectedProgram?.programId ?? "",
    programRole: "reviewer",
  });
  const canManage = role === "admin" || programs.some((program) => program.accessRole === "admin");
  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["all-users-roles", user?.id],
    enabled: canManage,
    queryFn: async () => {
      const result = await supabase.rpc("admin_list_user_access");
      if (result.error) throw result.error;
      return projectUserAccess((result.data ?? []) as AccessRow[]);
    },
  });
  const setGlobalRole = useMutation({
    mutationFn: async ({ userId, nextRole }: { userId: string; nextRole: AppRole }) => {
      const { error } = await supabase.rpc("admin_set_global_role", {
        p_user_id: userId,
        p_role: nextRole,
      });
      if (error) throw error;
    },
    onSuccess: (_result, variables) => {
      toast.success("Global role updated.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
      if (variables.userId === user?.id) window.location.reload();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const setProgramRole = useMutation({
    mutationFn: async ({
      userId,
      programId,
      programRole,
    }: {
      userId: string;
      programId: string;
      programRole: ProgramAccessRole | "none";
    }) => {
      if (programRole === "none") {
        const { error } = await supabase
          .from("user_program_access")
          .delete()
          .eq("user_id", userId)
          .eq("program_id", programId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_program_access")
          .upsert(
            { user_id: userId, program_id: programId, access_role: programRole },
            { onConflict: "user_id,program_id" },
          );
        if (error) throw error;
      }
    },
    onSuccess: (_result, variables) => {
      toast.success("Program access updated.");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
      if (variables.userId === user?.id) window.location.reload();
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
  const administrators = data.filter((item) => item.globalRole === "admin").length;
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-3xl">Users & Program Access</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage portal roles and program-specific access across Justice League review programs.
          </p>
        </div>
        <Button
          className="min-h-11 w-full sm:w-auto"
          onClick={() => {
            setInvitation((current) => ({
              ...current,
              programId:
                (role === "admin"
                  ? selectedProgram
                  : programs.find((p) => p.accessRole === "admin")
                )?.programId ?? current.programId,
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
      {role === "admin" && !isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="User summary">
          {[
            ["Total Users", data.length],
            ["Active", data.filter((item) => item.accountSetupCompleted).length],
            ["Setup Pending", data.filter((item) => !item.accountSetupCompleted).length],
            ["Administrators", administrators],
          ].map(([label, count]) => (
            <Card key={label} className="p-4 border-border/60">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-2xl">{count}</p>
            </Card>
          ))}
        </div>
      )}
      {isLoading && (
        <Card className="p-6" role="status">
          Loading users…
        </Card>
      )}
      {isError && (
        <Card className="p-6" role="alert">
          Unable to load user access.{" "}
          <Button variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}
      {!isLoading && !isError && data.length === 0 && (
        <Card className="p-6">No users are visible in the programs you administer.</Card>
      )}
      <div className="grid gap-3" aria-label="Users and program access">
        {data.map((item) => (
          <Card key={item.id} className="border-border/60 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-lg break-words">
                  {displayProfileName(item)}
                  {item.id === user?.id && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">(you)</span>
                  )}
                </h2>
                <p className="text-sm text-muted-foreground break-all">
                  {item.email || "No email"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Global Role</span>
                  <Badge variant="outline">{globalRoleLabel(item.globalRole)}</Badge>
                  <span className="ml-2 text-muted-foreground">Account Status</span>
                  <Badge
                    variant="outline"
                    className={
                      item.accountSetupCompleted ? "" : "border-warning/50 text-foreground"
                    }
                  >
                    {item.accountSetupCompleted ? "Active" : "Setup Pending"}
                  </Badge>
                </div>
                {item.globalRole === "admin" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Global Admin can administer every active program. Program roles below show
                    stored memberships.
                  </p>
                )}
              </div>
              <Button
                variant="outline"
                className="min-h-11 w-full lg:w-auto"
                onClick={() => setEditing(item)}
              >
                Manage Access
              </Button>
            </div>
            <div className="mt-4 border-t border-border/70 pt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Program Access
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {item.programs.map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 break-words">{program.name}</span>
                    <span
                      className={
                        program.role ? "shrink-0 font-medium" : "shrink-0 text-muted-foreground"
                      }
                    >
                      {programRoleLabel(program.role, item.globalRole)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Access</DialogTitle>
            <DialogDescription>
              {editing && `${displayProfileName(editing)} · ${editing.email || "No email"}`}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="manage-global-role">Global Role</Label>
                {role === "admin" ? (
                  <Select
                    value={editing.globalRole}
                    disabled={setGlobalRole.isPending}
                    onValueChange={(value) => {
                      const nextRole = value as AppRole;
                      if (
                        editing.id === user?.id &&
                        editing.globalRole === "admin" &&
                        nextRole !== "admin" &&
                        administrators <= 1
                      ) {
                        toast.error("The last global administrator cannot be removed.");
                        return;
                      }
                      setGlobalRole.mutate({ userId: editing.id, nextRole });
                    }}
                  >
                    <SelectTrigger id="manage-global-role" className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="reviewer">Reviewer</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm">
                    {globalRoleLabel(editing.globalRole)} · Only a global admin can change this
                    role.
                  </p>
                )}
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Program Access
                </p>
                {editing.programs.map((program) => (
                  <div className="space-y-2" key={program.id}>
                    <Label htmlFor={`manage-${program.id}`}>{program.name}</Label>
                    <Select
                      value={program.role ?? "none"}
                      disabled={setProgramRole.isPending}
                      onValueChange={(value) => {
                        setProgramRole.mutate({
                          userId: editing.id,
                          programId: program.id,
                          programRole: value as ProgramAccessRole | "none",
                        });
                      }}
                    >
                      <SelectTrigger id={`manage-${program.id}`} className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Access</SelectItem>
                        <SelectItem value="admin">Program Admin</SelectItem>
                        <SelectItem value="reviewer">Reviewer</SelectItem>
                        <SelectItem value="viewer">Read-only Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <p className="text-xs text-muted-foreground">
        Program admins manage that program only. Reviewers see assigned applications and their own
        scores. Viewers are read-only.
      </p>
    </div>
  );
}
