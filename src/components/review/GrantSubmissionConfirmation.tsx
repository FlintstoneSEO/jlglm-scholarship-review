import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loadGrantQueue } from "@/lib/grant-queue-client";
import { personalGrantWork } from "@/lib/grant-personal-work";
import { projectGrantQueue } from "@/lib/review-queue-projections";
import {
  matchesGrantQueueSearch,
  nextScreeningApplication,
  type GrantQueueSearch,
} from "@/lib/grant-screening";
import { Button } from "@/components/ui/button";

export function GrantSubmissionConfirmation({
  applicationId,
  programId,
  reviewerId,
  search,
  hasRubric,
}: {
  applicationId: string;
  programId: string;
  reviewerId: string;
  search: GrantQueueSearch;
  hasRubric: boolean;
}) {
  const next = useQuery({
    queryKey: ["grant-next-work", programId, reviewerId, applicationId, search],
    staleTime: 0,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const source = await loadGrantQueue(programId, search.scope ?? "all", reviewerId);
      if (
        source.rubricError ||
        source.assignmentError ||
        source.reviewError ||
        source.conflictError ||
        source.declarationError ||
        source.eligibilityError ||
        source.overrideError ||
        source.detailError
      )
        throw new Error("Next work unavailable");
      const ready = <T,>(data: T) => ({ data, state: "ready" as const });
      const projected = projectGrantQueue({
        applications: ready(source.applications),
        details: ready(source.details),
        assignments: ready(source.assignments),
        reviews: ready(source.reviews),
      });
      const matches = projected.items.filter((item) => {
        const personal = personalGrantWork(source, item.applicationId, reviewerId);
        return (
          hasRubric &&
          personal.ready &&
          matchesGrantQueueSearch(
            { ...item, status: { ...item.status, nativeValue: personal.status } },
            search,
            source.eligibility.find((e) => e.application_id === item.applicationId)?.status,
            true,
          )
        );
      });
      return nextScreeningApplication(
        projected.items.map((item) => item.applicationId),
        matches.map((item) => item.applicationId),
        applicationId,
      );
    },
  });
  return (
    <section
      className="space-y-3 rounded-lg border border-success/40 bg-success/10 p-4"
      aria-label="Submission confirmation"
    >
      <p role="status" className="font-semibold">
        Review submitted successfully. Your scores and comments were saved.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/grants" search={search}>
            Return to my applications
          </Link>
        </Button>
        {next.data && (
          <Button asChild className="min-h-11">
            <Link to="/grants/$id" params={{ id: next.data }} search={search}>
              Next application to review
            </Link>
          </Button>
        )}
      </div>
      {next.isLoading ? (
        <p role="status">Finding your next application…</p>
      ) : next.isError ? (
        <p role="alert">
          Could not check next work. Return to Applications or{" "}
          <button className="underline" onClick={() => void next.refetch()}>
            retry
          </button>
          .
        </p>
      ) : (
        !next.data && (
          <p>
            No more ready applications match this queue view. Return to Applications to check held
            work or change filters.
          </p>
        )
      )}
    </section>
  );
}
