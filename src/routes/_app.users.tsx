import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type AppRole = "admin" | "reviewer" | "viewer";

export const Route = createFileRoute("/_app/users")({
  component: UsersPage,
});

function UsersPage() {
  const { role, user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["all-users-roles"],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, created_at").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pe) throw pe;
      if (re) throw re;
      const roleMap = new Map<string, AppRole>();
      (roles ?? []).forEach((r) => {
        const existing = roleMap.get(r.user_id);
        const rank: Record<AppRole, number> = { admin: 1, reviewer: 2, viewer: 3 };
        if (!existing || rank[r.role as AppRole] < rank[existing]) roleMap.set(r.user_id, r.role as AppRole);
      });
      return (profiles ?? []).map((p) => ({ ...p, role: (roleMap.get(p.id) ?? "viewer") as AppRole }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: AppRole }) => {
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Role updated.");
      qc.invalidateQueries({ queryKey: ["all-users-roles"] });
    },
    onError: (e: any) => toast.error(e?.message || "Unable to update role."),
  });

  if (role !== "admin") {
    return <div className="text-sm text-muted-foreground">Admin access required.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">User Roles</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage which users can review applicants or administer the portal.</p>
      </div>

      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Joined</th>
                <th className="text-left px-4 py-3">Current Role</th>
                <th className="text-left px-4 py-3 w-56">Update Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
              )}
              {!isLoading && (data ?? []).length === 0 && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No users found.</td></tr>
              )}
              {(data ?? []).map((u) => {
                const isSelf = u.id === user?.id;
                return (
                  <tr key={u.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">{u.full_name || "—"}{isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3"><Badge variant="outline" className="capitalize">{u.role}</Badge></td>
                    <td className="px-4 py-3">
                      <Select
                        value={u.role}
                        disabled={setRole.isPending}
                        onValueChange={(v) => {
                          if (isSelf && v !== "admin") {
                            if (!confirm("You are removing your own admin access. Continue?")) return;
                          }
                          setRole.mutate({ userId: u.id, newRole: v as AppRole });
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="reviewer">Reviewer</SelectItem>
                          <SelectItem value="viewer">Viewer</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">
        Admins can manage all data and users. Reviewers can score applicants and add notes. Viewers have read-only access.
      </p>
    </div>
  );
}
