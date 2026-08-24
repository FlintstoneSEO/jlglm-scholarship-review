import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole, type ProgramAccessRole } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  const { role, user, selectedProgram } = useAuth();
  const qc = useQueryClient();
  const canManage = role === "admin" || selectedProgram?.accessRole === "admin";
  const { data = [], isLoading } = useQuery({
    queryKey: ["all-users-roles", selectedProgram?.programId],
    enabled: canManage,
    queryFn: async () => {
      const [profilesResult, rolesResult, accessResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, created_at")
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
  if (!canManage) return <Card className="p-6">Program administrator access is required.</Card>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Users & Program Access</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage access to {selectedProgram?.name ?? "the selected program"}. Program access is
          enforced by database policies.
        </p>
      </div>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
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
                  <td className="px-4 py-3 font-medium">
                    {item.full_name || "—"}
                    {item.id === user?.id && (
                      <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{item.email || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="capitalize">
                      {item.role}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
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
                      <SelectTrigger>
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
                    <td className="px-4 py-3">
                      <Select
                        value={item.role}
                        disabled={setGlobalRole.isPending}
                        onValueChange={(value) =>
                          setGlobalRole.mutate({ userId: item.id, nextRole: value as AppRole })
                        }
                      >
                        <SelectTrigger>
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
