import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/assignments")({ component: AssignmentsPage });

function AssignmentsPage() {
  const { user, selectedProgram, role } = useAuth();
  const qc = useQueryClient();
  const [applicationId, setApplicationId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const admin = !!selectedProgram && (selectedProgram.accessRole === "admin" || role === "admin");
  const { data, isLoading } = useQuery({
    queryKey: ["assignments-admin", selectedProgram?.programId],
    enabled: admin,
    queryFn: async () => {
      const [applicationsResult, accessResult, assignmentsResult, reviewsResult] =
        await Promise.all([
          supabase
            .from("portal_applications")
            .select("id, applicant_name, applicant_email, review_status")
            .eq("program_id", selectedProgram!.programId)
            .order("submitted_at", { ascending: false }),
          supabase
            .from("user_program_access")
            .select("user_id, access_role")
            .eq("program_id", selectedProgram!.programId)
            .in("access_role", ["reviewer", "admin"]),
          supabase
            .from("reviewer_assignments")
            .select("*")
            .eq("program_id", selectedProgram!.programId)
            .order("assigned_at", { ascending: false }),
          supabase
            .from("program_reviews")
            .select("assignment_id, status")
            .eq("program_id", selectedProgram!.programId),
        ]);
      const reviewerIds = (accessResult.data ?? []).map((access) => access.user_id);
      const { data: profiles } = reviewerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", reviewerIds)
        : { data: [] };
      return {
        applications: applicationsResult.data ?? [],
        access: accessResult.data ?? [],
        assignments: assignmentsResult.data ?? [],
        reviews: reviewsResult.data ?? [],
        profiles: profiles ?? [],
      };
    },
  });
  async function assign() {
    if (!selectedProgram || !applicationId || !reviewerId) return;
    const { error } = await supabase.from("reviewer_assignments").insert({
      application_id: applicationId,
      program_id: selectedProgram.programId,
      reviewer_id: reviewerId,
      assigned_by: user?.id ?? null,
    });
    if (error)
      return toast.error(
        error.code === "23505" ? "That reviewer is already assigned." : error.message,
      );
    setApplicationId("");
    setReviewerId("");
    qc.invalidateQueries({ queryKey: ["assignments-admin"] });
    toast.success("Reviewer assigned.");
  }
  async function remove(id: string) {
    if (reviews.get(id))
      return toast.error("This assignment has review activity and cannot be removed.");
    if (!confirm("Remove this assignment?")) return;
    const { error } = await supabase.from("reviewer_assignments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["assignments-admin"] });
  }
  if (!admin) return <Card className="p-6">Program administrator access is required.</Card>;
  const profiles = new Map((data?.profiles ?? []).map((profile) => [profile.id, profile]));
  const applications = new Map(
    (data?.applications ?? []).map((application) => [application.id, application]),
  );
  const reviews = new Map((data?.reviews ?? []).map((review) => [review.assignment_id, review]));
  const reviewerStats = (data?.access ?? []).map((access) => {
    const assignments = (data?.assignments ?? []).filter(
      (assignment) => assignment.reviewer_id === access.user_id,
    );
    return {
      access,
      profile: profiles.get(access.user_id),
      assigned: assignments.length,
      completed: assignments.filter(
        (assignment) => reviews.get(assignment.id)?.status === "completed",
      ).length,
    };
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          {selectedProgram?.name}
        </p>
        <h1 className="font-display text-3xl mt-1">Reviewer assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assignments control reviewer application access at the database level.
        </p>
      </div>
      <Card className="p-5 rounded-xl border-border/60">
        <div className="grid md:grid-cols-[1fr_1fr_auto] gap-3">
          <Select value={applicationId} onValueChange={setApplicationId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose application" />
            </SelectTrigger>
            <SelectContent>
              {data?.applications.map((application) => (
                <SelectItem key={application.id} value={application.id}>
                  {application.applicant_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reviewerId} onValueChange={setReviewerId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose reviewer" />
            </SelectTrigger>
            <SelectContent>
              {reviewerStats.map(({ access, profile }) => (
                <SelectItem key={access.user_id} value={access.user_id}>
                  {profile?.full_name || profile?.email || access.user_id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={assign} disabled={!applicationId || !reviewerId}>
            <Plus className="h-4 w-4 mr-1.5" />
            Assign
          </Button>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {reviewerStats.map(({ access, profile, assigned, completed }) => (
          <Card key={access.user_id} className="p-4 rounded-xl border-border/60">
            <div className="font-medium truncate">
              {profile?.full_name || profile?.email || access.user_id}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {completed} completed · {assigned - completed} outstanding
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${assigned ? (completed / assigned) * 100 : 0}%` }}
              />
            </div>
          </Card>
        ))}
      </div>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Reviewer</th>
                <th className="text-left px-4 py-3">Application</th>
                <th className="text-left px-4 py-3">Assigned</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={5} className="p-8 text-center">
                    Loading…
                  </td>
                </tr>
              )}
              {data?.assignments.map((assignment) => {
                const profile = profiles.get(assignment.reviewer_id);
                const application = applications.get(assignment.application_id);
                const review = reviews.get(assignment.id);
                return (
                  <tr key={assignment.id}>
                    <td className="px-4 py-3">
                      {profile?.full_name || profile?.email || assignment.reviewer_id}
                    </td>
                    <td className="px-4 py-3">
                      {application?.applicant_name ?? assignment.application_id}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="capitalize">
                        {review?.status.replaceAll("_", " ") ?? "not started"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(assignment.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                        <span className="sr-only">Remove assignment</span>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
