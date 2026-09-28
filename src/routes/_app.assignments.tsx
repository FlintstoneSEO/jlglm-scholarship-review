import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReviewProgress } from "@/components/review/ReviewProgress";
import type { ReviewProgress as ReviewProgressData } from "@/lib/review-domain";
import { projectAssignmentProgress } from "@/lib/review-queue-projections";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/assignments")({ component: AssignmentsPage });

function AssignmentsPage() {
  const { user, selectedProgram, role } = useAuth();
  const qc = useQueryClient();
  const [applicationId, setApplicationId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [resetTarget, setResetTarget] = useState<{
    reviewId: string;
    applicant: string;
    reviewer: string;
    status: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);
  const admin = !!selectedProgram && (selectedProgram.accessRole === "admin" || role === "admin");
  const { data, isLoading, isError, refetch } = useQuery({
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
            .select("id, assignment_id, status")
            .eq("program_id", selectedProgram!.programId),
        ]);
      for (const result of [applicationsResult, accessResult, assignmentsResult, reviewsResult])
        if (result.error) throw result.error;
      const reviewerIds = (accessResult.data ?? []).map((access) => access.user_id);
      const { data: profiles } = reviewerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", reviewerIds)
        : { data: [] };
      let scholarshipReviews: Array<{
        id: string;
        applicant_id: string;
        reviewer_id: string | null;
        is_complete: boolean;
      }> = [];
      let scholarshipApplicants: Array<{ id: string; application_id: string | null }> = [];
      if (selectedProgram!.slug === "scholarship") {
        const applicantsResult = await supabase.from("applicants").select("id, application_id");
        if (applicantsResult.error) throw applicantsResult.error;
        scholarshipApplicants = applicantsResult.data ?? [];
        const applicantIds = scholarshipApplicants.map((applicant) => applicant.id);
        if (applicantIds.length) {
          const legacyResult = await supabase
            .from("reviews")
            .select("id, applicant_id, reviewer_id, is_complete")
            .in("applicant_id", applicantIds);
          if (legacyResult.error) throw legacyResult.error;
          scholarshipReviews = legacyResult.data ?? [];
        }
      }
      return {
        applications: applicationsResult.data ?? [],
        access: accessResult.data ?? [],
        assignments: assignmentsResult.data ?? [],
        reviews: reviewsResult.data ?? [],
        profiles: profiles ?? [],
        scholarshipReviews,
        scholarshipApplicants,
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
  async function resetReview() {
    if (!resetTarget || resetting) return;
    setResetting(true);
    const { error } = await supabase.rpc("admin_reset_review", {
      p_review_id: resetTarget.reviewId,
      p_reason: "test_data",
    });
    setResetting(false);
    if (error) return toast.error(error.message);
    setResetTarget(null);
    await qc.invalidateQueries();
    toast.success("Review reset. The assignment remains active.");
  }
  if (!admin) return <Card className="p-6">Program administrator access is required.</Card>;
  const profiles = new Map((data?.profiles ?? []).map((profile) => [profile.id, profile]));
  const applications = new Map(
    (data?.applications ?? []).map((application) => [application.id, application]),
  );
  const reviews = new Map((data?.reviews ?? []).map((review) => [review.assignment_id, review]));
  const scholarshipApplicantByApplication = new Map(
    (data?.scholarshipApplicants ?? [])
      .filter((a) => a.application_id)
      .map((a) => [a.application_id!, a.id]),
  );
  const assignmentProgress = (
    assignment: NonNullable<typeof data>["assignments"][number],
  ): ReviewProgressData => {
    if (selectedProgram?.slug === "scholarship") {
      const applicantId = scholarshipApplicantByApplication.get(assignment.application_id);
      return projectAssignmentProgress(
        "scholarship",
        assignment,
        [],
        data?.scholarshipReviews ?? [],
        applicantId,
      );
    }
    const row = reviews.get(assignment.id);
    return projectAssignmentProgress(
      "business_growth_grant",
      assignment,
      row
        ? [
            {
              ...row,
              id: row.id,
              application_id: assignment.application_id,
              reviewer_id: assignment.reviewer_id,
            },
          ]
        : [],
      [],
    );
  };
  const reviewerStats = (data?.access ?? []).map((access) => {
    const assignments = (data?.assignments ?? []).filter(
      (assignment) => assignment.reviewer_id === access.user_id,
    );
    return {
      access,
      profile: profiles.get(access.user_id),
      assigned: assignments.length,
      completed: assignments.filter(
        (assignment) => assignmentProgress(assignment).completedReviews === 1,
      ).length,
    };
  });
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-warning font-semibold">
          {selectedProgram?.name}
        </p>
        <h1 className="font-display text-3xl mt-1">Reviewer assignments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Assignments control reviewer application access at the database level.
        </p>
      </div>
      <Card className="p-5 rounded-xl border-border/60">
        <div className="grid min-w-0 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Select value={applicationId} onValueChange={setApplicationId}>
            <SelectTrigger aria-label="Application" className="min-w-0 min-h-11">
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
            <SelectTrigger aria-label="Reviewer" className="min-w-0 min-h-11">
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
          <Button className="min-h-11" onClick={assign} disabled={!applicationId || !reviewerId}>
            <Plus className="h-4 w-4 mr-1.5" />
            Assign
          </Button>
        </div>
      </Card>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {reviewerStats.map(({ access, profile, assigned, completed }) => (
          <Card key={access.user_id} className="p-4 rounded-xl border-border/60">
            <div className="font-medium break-words">
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
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => !open && !resetting && setResetTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resetTarget?.status === "Submitted" ? "Reset submitted review?" : "Reset Review?"}
            </DialogTitle>
            <DialogDescription>
              This will remove this review&apos;s scores, comments, submission status, and review
              activity. The reviewer assignment will remain and the reviewer will be able to start
              the review again.
            </DialogDescription>
          </DialogHeader>
          {resetTarget && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Applicant</dt>
              <dd>{resetTarget.applicant}</dd>
              <dt className="text-muted-foreground">Program</dt>
              <dd>{selectedProgram?.name}</dd>
              <dt className="text-muted-foreground">Reviewer</dt>
              <dd>{resetTarget.reviewer}</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{resetTarget.status}</dd>
            </dl>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setResetTarget(null)} disabled={resetting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={resetReview} disabled={resetting}>
              {resetting ? "Resetting…" : "Reset Review"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        {isError && (
          <div className="p-6 text-center" role="alert">
            <p className="font-medium">We couldn't load reviewer assignments.</p>
            <Button variant="outline" className="mt-3" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        )}
        <div className="record-table-wrap overflow-x-auto">
          <table className="record-table w-full text-sm">
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
                const progress = assignmentProgress(assignment);
                const scholarshipApplicantId = scholarshipApplicantByApplication.get(
                  assignment.application_id,
                );
                const review =
                  selectedProgram?.slug === "scholarship"
                    ? data?.scholarshipReviews.find(
                        (row) =>
                          row.applicant_id === scholarshipApplicantId &&
                          row.reviewer_id === assignment.reviewer_id,
                      )
                    : reviews.get(assignment.id);
                const reviewStatus = !review
                  ? "Not Started"
                  : "is_complete" in review
                    ? review.is_complete
                      ? "Submitted"
                      : "Draft"
                    : review.status === "completed"
                      ? "Submitted"
                      : "Draft";
                return (
                  <tr key={assignment.id}>
                    <td data-label="Reviewer" data-primary className="px-4 py-3">
                      {profile?.full_name || profile?.email || assignment.reviewer_id}
                    </td>
                    <td data-label="Application" className="px-4 py-3">
                      {application?.applicant_name ?? assignment.application_id}
                    </td>
                    <td data-label="Assigned" className="px-4 py-3 text-muted-foreground">
                      {new Date(assignment.assigned_at).toLocaleDateString()}
                    </td>
                    <td data-label="Status and progress" className="px-4 py-3">
                      <ReviewProgress progress={progress} showAdminWarning />
                    </td>
                    <td data-label="Actions" data-action className="px-4 py-3 text-right">
                      {review && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11 mr-2"
                          onClick={() =>
                            setResetTarget({
                              reviewId: review.id,
                              applicant: application?.applicant_name ?? assignment.application_id,
                              reviewer:
                                profile?.full_name || profile?.email || assignment.reviewer_id,
                              status: reviewStatus,
                            })
                          }
                        >
                          Reset Review
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        aria-label={`Remove assignment for ${profile?.full_name || profile?.email || assignment.reviewer_id}`}
                        onClick={() => remove(assignment.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
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
