import { ApplicationScopeFilter } from "@/components/review/ApplicationScopeFilter";
import { TestApplicationBadge } from "@/components/review/TestApplicationBadge";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
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
import { parseAssignmentSearch, practiceApplicationName } from "@/lib/testing-workflow";
import { assignReviewer } from "@/lib/reviewer-assignment-client";
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

export const Route = createFileRoute("/_app/assignments")({
  validateSearch: parseAssignmentSearch,
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { user, selectedProgram, role, programs, setSelectedProgram } = useAuth();
  const qc = useQueryClient();
  const {
    scope = "real",
    application: requestedApplication,
    program: requestedProgram,
    tab,
    attention,
    conflict,
  } = Route.useSearch();
  const navigate = Route.useNavigate();
  const applicationId = requestedApplication ?? "";
  const setApplicationId = (application: string) => {
    setReviewerId("");
    void navigate({
      search: (previous) => ({
        ...previous,
        scope,
        application: application || undefined,
        program: selectedProgram?.slug,
      }),
    });
  };
  const [assigning, setAssigning] = useState(false);
  useEffect(() => {
    const destination = programs.find(
      (p) => p.slug === requestedProgram && (p.accessRole === "admin" || role === "admin"),
    );
    if (destination && destination.slug !== selectedProgram?.slug)
      setSelectedProgram(destination.slug);
  }, [requestedProgram, programs, role, selectedProgram?.slug, setSelectedProgram]);
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
  const distribution = isGrant && scope === "real";
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["assignments-admin", selectedProgram?.programId, scope],
    enabled: admin && (!requestedProgram || requestedProgram === selectedProgram?.slug),
    queryFn: async () => {
      const [applicationsResult, accessResult, assignmentsResult, reviewsResult] =
        await Promise.all([
          supabase
            .from("portal_applications")
            .select(
              "id, applicant_name, applicant_email, review_status, created_at, is_test, practice_session_id, practice_round",
            )
            .eq("is_test", scope === "test")
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
      const appRows = applicationsResult.data ?? [];
      const details =
        isGrant && appRows.length
          ? await supabase
              .from("business_grant_application_details")
              .select("application_id,business_name")
              .in(
                "application_id",
                appRows.map((a) => a.id),
              )
          : { data: [], error: null };
      if (details.error) throw details.error;
      const scopedApplications = appRows.map((a) => ({
        ...a,
        display_name:
          details.data?.find((d) => d.application_id === a.id)?.business_name || a.applicant_name,
      }));
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
    if (
      !admin ||
      !selectedProgram ||
      assigning ||
      !data?.applications.some((a) => a.id === applicationId) ||
      !data.profiles.some((p) => p.id === reviewerId)
    )
      return;
    setAssigning(true);
    try {
      await assignReviewer({
        application_id: applicationId,
        program_id: selectedProgram.programId,
        reviewer_id: reviewerId,
        assigned_by: user?.id ?? null,
      });
      setReviewerId("");
      await qc.invalidateQueries();
      toast.success("Reviewer assigned.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Reviewer could not be assigned. Try again.",
      );
    } finally {
      setAssigning(false);
    }
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
  const selectedApplication = applications.get(applicationId);
  const applicationName = (a: NonNullable<typeof selectedApplication>) =>
    a.is_test
      ? practiceApplicationName(a.applicant_name, selectedProgram!.slug, a.display_name)
      : a.display_name;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">
          {distribution
            ? "Review Distribution"
            : isGrant
              ? "Guided Review Test Assignments"
              : "Reviewer Assignments"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {distribution
            ? "Manage reviewer groups, randomly distribute applications, monitor review progress, and resolve assignment issues."
            : "Choose an application, then choose who should review it. Create and manage practice applications in Testing."}
        </p>
      </div>
      <ApplicationScopeFilter
        assignmentsOnly
        value={scope}
        onChange={(scope) => {
          setReviewerId("");
          navigate({
            search: { scope: scope === "test" ? "test" : "real", program: selectedProgram?.slug },
          });
        }}
      />
      {distribution && data && !isError && (
        <GrantCommitteeAllocation
          key={selectedProgram!.programId}
          programId={selectedProgram!.programId}
          profiles={data.profiles}
          assignments={data.assignments}
          reviews={data.reviews}
          tab={tab ?? "groups"}
          attention={attention}
          conflictId={conflict}
          onTabChange={(next, showAttention) =>
            void navigate({
              search: (previous) => ({
                ...previous,
                tab: next,
                attention: showAttention,
                conflict: undefined,
              }),
            })
          }
        />
      )}
      {distribution && isLoading && <p role="status">Loading review distribution...</p>}
      {distribution && isError && (
        <Card className="space-y-2 p-4" role="alert">
          <p>Review distribution is unavailable.</p>
          <Button onClick={() => refetch()} variant="outline">
            Retry
          </Button>
        </Card>
      )}
      <details
        open={distribution ? undefined : true}
        className={distribution ? "rounded-xl border bg-card p-4" : "contents"}
      >
        <summary
          className={
            distribution
              ? "min-h-11 cursor-pointer font-semibold focus-visible:outline focus-visible:outline-2"
              : "hidden"
          }
        >
          Assignment History &amp; Administration
        </summary>
        <Card className="min-w-0 space-y-4 p-5">
          <label htmlFor="assignment-application" className="block font-semibold">
            Choose Application
          </label>
          <Select
            value={applicationId}
            onValueChange={setApplicationId}
            disabled={
              isLoading ||
              isError ||
              (requestedProgram !== undefined && requestedProgram !== selectedProgram?.slug)
            }
          >
            <SelectTrigger id="assignment-application" className="min-h-11 min-w-0">
              <SelectValue placeholder="Choose application" />
            </SelectTrigger>
            <SelectContent>
              {data?.applications.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.is_test ? "TEST - " : ""}
                  {applicationName(a)}
                  {a.is_test ? ` - ${new Date(a.created_at).toLocaleString()}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!isLoading && !isError && !data?.applications.length && (
            <p>
              No {scope === "test" ? "test" : "real"} applications available for{" "}
              {selectedProgram?.name}.
            </p>
          )}
          {applicationId && !selectedApplication && !isLoading && !isError && (
            <p role="alert">
              This application is unavailable in the selected program and filter. Choose an
              available application.
            </p>
          )}
          {selectedApplication && (
            <div className="space-y-2">
              <TestApplicationBadge isTest={selectedApplication.is_test} />
              <h2 className="break-words text-xl font-semibold">
                {applicationName(selectedApplication)}
              </h2>
              <p className="text-sm text-muted-foreground">
                {selectedProgram?.name}
                {selectedApplication.is_test ? " - Practice Application" : ""}
              </p>
            </div>
          )}
        </Card>
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
        {isError && (
          <Card className="p-5" role="alert">
            <p>We couldn't load reviewer assignments.</p>
            <Button variant="outline" className="mt-3 min-h-11" onClick={() => refetch()}>
              Retry
            </Button>
          </Card>
        )}
        {isLoading && <p role="status">Loading assignments...</p>}
        {selectedApplication && !isError && (
          <Card className="overflow-hidden">
            <h2 className="p-4 font-display text-xl">Assigned Reviewers</h2>
            {!data?.assignments.some((a) => a.application_id === applicationId) && (
              <p className="px-4 pb-4">No reviewers assigned yet. Add a reviewer below.</p>
            )}
            <ul className="divide-y divide-border">
              {data?.assignments
                .filter((a) => a.application_id === applicationId)
                .map((assignment) => {
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
                        {profile?.full_name || profile?.email || "Reviewer unavailable"}
                      </div>
                      <div className="min-w-0 break-words">
                        <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                          Application
                        </p>
                        {application ? applicationName(application) : "Application unavailable"}
                        <TestApplicationBadge isTest={application?.is_test === true} />
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
                              {new Date(assignment.deactivated_at).toLocaleString()} Ã‚· History
                              retained
                            </span>
                          </p>
                        ) : (
                          <ReviewProgress progress={progress} showAdminWarning />
                        )}
                      </div>
                      <div className="flex min-w-0 flex-wrap items-start gap-2 sm:col-span-2 xl:col-span-1">
                        {application?.is_test && (
                          <Button variant="outline" className="min-h-11" asChild>
                            <Link
                              to="/testing"
                              search={{ guide: false, application: application.id }}
                            >
                              Manage Practice Application
                            </Link>
                          </Button>
                        )}
                        {review && assignment.lifecycle === "active" && !application?.is_test && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-11 mr-2"
                            onClick={() =>
                              setResetTarget({
                                reviewId: review.id,
                                applicant: application
                                  ? applicationName(application)
                                  : "Application unavailable",
                                reviewer:
                                  profile?.full_name || profile?.email || "Reviewer unavailable",
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
                                applicant: application
                                  ? applicationName(application)
                                  : "Application unavailable",
                                reviewer:
                                  profile?.full_name || profile?.email || "Reviewer unavailable",
                              })
                            }
                          >
                            Remove Reviewer
                          </Button>
                        )}
                        {assignment.lifecycle === "active" && review && (
                          <p className="text-xs text-muted-foreground">
                            Reset the current review before deactivating this assignment. Use
                            conflict resolution for reported conflicts.
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </Card>
        )}
        {!distribution && selectedApplication && !isError && (
          <Card className="space-y-3 p-5">
            <h2 className="font-display text-xl">Add Reviewer</h2>
            <p className="text-sm text-muted-foreground">
              Choose a person with access to this program. Inactive assignments stay in the history
              and cannot be added again.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={reviewerId} onValueChange={setReviewerId} disabled={assigning}>
                <SelectTrigger aria-label="Reviewer" className="min-h-11 min-w-0 sm:flex-1">
                  <SelectValue placeholder="Choose reviewer" />
                </SelectTrigger>
                <SelectContent>
                  {reviewerStats
                    .filter(
                      ({ access }) =>
                        !data?.assignments.some(
                          (a) =>
                            a.application_id === applicationId && a.reviewer_id === access.user_id,
                        ),
                    )
                    .map(({ access, profile }) => (
                      <SelectItem key={access.user_id} value={access.user_id}>
                        {profile?.full_name || profile?.email || "Reviewer unavailable"}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Button
                className="min-h-11"
                onClick={assign}
                disabled={!reviewerId || assigning || isLoading}
              >
                <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
                {assigning ? "Assigning..." : "Assign Reviewer"}
              </Button>
            </div>
          </Card>
        )}
        <details className="rounded-xl border bg-card p-4">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Reviewer workload and group assignments
          </summary>
          <ul className="mt-3 divide-y">
            {reviewerStats.map(({ access, profile, assigned, completed }) => (
              <li
                key={access.user_id}
                className="flex flex-wrap justify-between gap-2 py-3 text-sm"
              >
                <span>{profile?.full_name || profile?.email || "Reviewer unavailable"}</span>
                <span>
                  {completed} completed - {assigned - completed} outstanding
                </span>
              </li>
            ))}
          </ul>
          {isGrant && !distribution && data && !!selectedApplication?.practice_session_id && (
            <GrantCommitteeAllocation
              key={selectedProgram!.programId}
              programId={selectedProgram!.programId}
              practiceSessionId={
                scope === "test"
                  ? (selectedApplication?.practice_session_id ?? undefined)
                  : undefined
              }
              profiles={data.profiles}
              assignments={data.assignments}
              reviews={data.reviews}
            />
          )}
        </details>
      </details>
    </div>
  );
}
