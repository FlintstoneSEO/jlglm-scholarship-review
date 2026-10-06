import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
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
import { GrantPracticeSessions } from "@/components/review/GrantPracticeSessions";
import { GrantCommitteeAllocation } from "@/components/review/GrantCommitteeAllocation";
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
  const [practice, setPractice] = useState<{ id: string; round: number } | null>(null);
  const [applicationId, setApplicationId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [deactivationTarget, setDeactivationTarget] = useState<{
    id: string;
    applicant: string;
    reviewer: string;
  } | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [resetTarget, setResetTarget] = useState<{
    reviewId: string;
    applicant: string;
    reviewer: string;
    status: string;
  } | null>(null);
  const [resetting, setResetting] = useState(false);
  const admin = !!selectedProgram && (selectedProgram.accessRole === "admin" || role === "admin");
  const isGrant = selectedProgram?.slug === "business_growth_grant";
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["assignments-admin", selectedProgram?.programId, practice?.id, practice?.round],
    enabled: admin,
    queryFn: async () => {
      const [applicationsResult, accessResult, assignmentsResult, reviewsResult] =
        await Promise.all([
          supabase
            .from("portal_applications")
            .select(
              "id, applicant_name, applicant_email, review_status, practice_session_id, practice_round",
            )
            .filter("practice_session_id", practice ? "eq" : "is", practice?.id ?? null)
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
      const { data: profiles, error: profilesError } = reviewerIds.length
        ? await supabase.from("profiles").select("id, full_name, email").in("id", reviewerIds)
        : { data: [], error: null };
      if (profilesError) throw profilesError;
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
      const scopedApplications = (applicationsResult.data ?? []).filter(
        (a) => !practice || a.practice_round === practice.round,
      );
      const scopedIds = new Set(scopedApplications.map((a) => a.id));
      return {
        applications: scopedApplications,
        access: accessResult.data ?? [],
        assignments: (assignmentsResult.data ?? []).filter((a) => scopedIds.has(a.application_id)),
        reviews: (reviewsResult.data ?? []).filter((r) =>
          (assignmentsResult.data ?? []).some(
            (a) => a.id === r.assignment_id && scopedIds.has(a.application_id),
          ),
        ),
        profiles: profiles ?? [],
        scholarshipReviews,
        scholarshipApplicants,
      };
    },
  });
  async function assign() {
    if (!selectedProgram || isGrant || !applicationId || !reviewerId) return;
    const { error } = await supabase.from("reviewer_assignments").insert({
      application_id: applicationId,
      program_id: selectedProgram.programId,
      reviewer_id: reviewerId,
      assigned_by: user?.id ?? null,
    });
    if (error)
      return toast.error(
        error.code === "23505"
          ? "An assignment already exists for this reviewer and application, including retained inactive history."
          : error.message,
      );
    setApplicationId("");
    setReviewerId("");
    qc.invalidateQueries({ queryKey: ["assignments-admin"] });
    toast.success("Reviewer assigned.");
  }
  async function deactivateAssignment() {
    if (!deactivationTarget || deactivating) return;
    setDeactivating(true);
    try {
      const { error } = await supabase.rpc("admin_deactivate_assignment", {
        p_assignment_id: deactivationTarget.id,
      });
      if (error) return toast.error(error.message);
      setDeactivationTarget(null);
      await qc.invalidateQueries();
      toast.success("Assignment deactivated. Its history has been retained.");
    } catch {
      toast.error("We couldn't confirm deactivation. Reload and try again.");
    } finally {
      setDeactivating(false);
    }
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
      (assignment) =>
        assignment.reviewer_id === access.user_id && assignment.lifecycle === "active",
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
  const AssignmentContainer = isGrant ? "details" : "div";
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
      {selectedProgram?.slug === "business_growth_grant" && (
        <GrantPracticeSessions
          programId={selectedProgram.programId}
          profiles={data?.profiles ?? []}
          selected={practice}
          onSelect={(selection) => {
            setApplicationId("");
            setPractice(selection);
          }}
        />
      )}
      {selectedProgram?.slug === "business_growth_grant" && data && (
        <GrantCommitteeAllocation
          key={selectedProgram.programId + (practice?.id ?? "live") + practice?.round}
          practiceSessionId={practice?.id}
          programId={selectedProgram.programId}
          profiles={data.profiles}
          assignments={data.assignments}
          reviews={data.reviews}
        />
      )}
      {!isGrant && (
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
      )}
      {!isGrant && (
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
      )}
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
      <Dialog
        open={!!deactivationTarget}
        onOpenChange={(open) => !open && !deactivating && setDeactivationTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate assignment?</DialogTitle>
            <DialogDescription>
              This removes the assignment from the reviewer&apos;s active workload and removes the
              application access it provides. The assignment and any review-reset history will be
              retained. You cannot assign the same reviewer to this application again through the
              assignment form.
            </DialogDescription>
          </DialogHeader>
          {deactivationTarget && (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Applicant</dt>
              <dd className="break-words">{deactivationTarget.applicant}</dd>
              <dt className="text-muted-foreground">Reviewer</dt>
              <dd className="break-words">{deactivationTarget.reviewer}</dd>
            </dl>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setDeactivationTarget(null)}
              disabled={deactivating}
              className="min-h-11"
            >
              Cancel
            </Button>
            <Button onClick={deactivateAssignment} disabled={deactivating} className="min-h-11">
              {deactivating ? "Deactivating..." : "Deactivate assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {isGrant && isError && (
        <Card className="p-6" role="alert">
          <p className="font-medium">We couldn't load reviewer assignments.</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
            Retry
          </Button>
        </Card>
      )}
      {isGrant && isLoading && <p role="status">Loading assignments...</p>}
      <AssignmentContainer
        key={selectedProgram?.programId}
        className={isGrant ? "rounded-xl border border-border/60 bg-card" : undefined}
      >
        {isGrant && (
          <summary className="min-h-11 cursor-pointer rounded-xl p-4 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Assignment history and administration
          </summary>
        )}
        {isGrant && (
          <div className="space-y-4 p-4">
            <p className="text-sm text-muted-foreground">
              Individual records support troubleshooting, review resets, and assignment
              deactivation. Manage reported conflicts in the conflict resolution section.
            </p>
            <h2 className="font-semibold">Reviewer workload across all assignments</h2>
            <ul className="divide-y">
              {reviewerStats.map(({ access, profile, assigned, completed }) => (
                <li
                  key={access.user_id}
                  className="flex min-w-0 flex-wrap justify-between gap-2 py-2 text-sm"
                >
                  <span className="min-w-0 max-w-full break-words">
                    {profile?.full_name || profile?.email || access.user_id}
                  </span>
                  <span className="text-muted-foreground">
                    {completed} completed · {assigned - completed} outstanding
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Card className="rounded-xl border-border/60 overflow-hidden">
          {!isGrant && isError && (
            <div className="p-6 text-center" role="alert">
              <p className="font-medium">We couldn't load reviewer assignments.</p>
              <Button variant="outline" className="mt-3" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}
          {!isGrant && isLoading && (
            <p role="status" className="p-6">
              Loading assignments...
            </p>
          )}
          {!isLoading && !isError && !data?.assignments.length && (
            <p className="p-6">
              {isGrant ? "No assignment records in this scope." : "No individual assignments yet."}
            </p>
          )}
          <ul className="divide-y divide-border">
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
                <li
                  key={assignment.id}
                  className="grid min-w-0 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3"
                >
                  <div className="min-w-0 break-words">
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Reviewer
                    </p>
                    {profile?.full_name || profile?.email || assignment.reviewer_id}
                  </div>
                  <div className="min-w-0 break-words">
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Application
                    </p>
                    {application?.applicant_name ?? assignment.application_id}
                  </div>
                  <div className="min-w-0 text-sm text-muted-foreground">
                    <p className="mb-1 text-xs font-semibold uppercase">Assigned</p>
                    {new Date(assignment.assigned_at).toLocaleDateString()}
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      Status and progress
                    </p>
                    {assignment.deactivated_at ? (
                      <p className="text-sm">
                        Deactivated by admin
                        <span className="block text-muted-foreground">
                          {new Date(assignment.deactivated_at).toLocaleString()} · History retained
                        </span>
                      </p>
                    ) : (
                      <ReviewProgress progress={progress} showAdminWarning />
                    )}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-start gap-2 sm:col-span-2 xl:col-span-1">
                    {review && assignment.lifecycle === "active" && (
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
                    {assignment.lifecycle === "active" && !review && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          setDeactivationTarget({
                            id: assignment.id,
                            applicant: application?.applicant_name ?? assignment.application_id,
                            reviewer:
                              profile?.full_name || profile?.email || assignment.reviewer_id,
                          })
                        }
                      >
                        Deactivate assignment
                      </Button>
                    )}
                    {assignment.lifecycle === "active" && review && (
                      <p className="text-xs text-muted-foreground">
                        Reset the current review before deactivating this assignment. Use conflict
                        resolution for reported conflicts.
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </AssignmentContainer>
    </div>
  );
}
