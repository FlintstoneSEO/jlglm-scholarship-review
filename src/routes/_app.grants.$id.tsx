import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database, Json } from "@/integrations/supabase/types";
import { ReviewWorkspace } from "@/components/review/ReviewWorkspace";
import { SupportingDocuments } from "@/components/review/SupportingDocuments";
import { GrantOverview } from "@/components/review/GrantOverview";
import {
  ReviewRubric,
  RubricScoreField,
  type RubricCriterion,
} from "@/components/review/ReviewRubric";
import { ReviewActions } from "@/components/review/ReviewActions";
import {
  GrantConsistencyGuidance,
  GrantReviewerGuidance,
} from "@/components/review/GrantReviewerGuidance";
import type { ReviewDocument, ReviewProgress, ReviewStatus } from "@/lib/review-domain";
import { createIdempotencyKey } from "@/lib/review-submission";
import { createReviewWriteAdapter } from "@/lib/review-submission-client";
import { guidanceForGrantCriterion } from "@/lib/grant-rubric-guidance";
import {
  criterionForGrantSection,
  canScoreAssignedGrant,
  grantScoreDraft,
  grantScoreEntries,
  grantReviewActionState,
  grantReviewSummary,
  validGrantScore,
  type GrantScoreDraft,
} from "@/lib/grant-application-rubric";

export const Route = createFileRoute("/_app/grants/$id")({ component: GrantDetail });

type Criterion = Database["public"]["Tables"]["rubric_criteria"]["Row"];
type ProgramReview = Database["public"]["Tables"]["program_reviews"]["Row"];

function GrantDetail() {
  const { id } = Route.useParams();
  const { user, role, selectedProgram } = useAuth();
  const qc = useQueryClient();
  const [points, setPoints] = useState<GrantScoreDraft>({});
  const [scoresDirty, setScoresDirty] = useState(false);
  const [comments, setComments] = useState("");
  const [commentsDirty, setCommentsDirty] = useState(false);
  const hydratedReview = useRef("");
  const { data, isLoading } = useQuery({
    queryKey: ["business-grant", id, user?.id],
    queryFn: async () => {
      const [
        applicationResult,
        detailResult,
        documentResult,
        criterionResult,
        rubricVersionResult,
        assignmentResult,
        reviewResult,
        eligibilityResult,
      ] = await Promise.all([
        supabase.from("portal_applications").select("*").eq("id", id).single(),
        supabase
          .from("business_grant_application_details")
          .select("*")
          .eq("application_id", id)
          .single(),
        supabase
          .from("application_documents")
          .select("*")
          .eq("application_id", id)
          .order("created_at"),
        supabase
          .from("rubric_criteria")
          .select("*")
          .eq("program_id", selectedProgram!.programId)
          .eq("active", true)
          .order("display_order"),
        supabase
          .from("rubric_versions")
          .select("id")
          .eq("program_id", selectedProgram!.programId)
          .eq("active", true)
          .single(),
        supabase.from("reviewer_assignments").select("*").eq("application_id", id),
        supabase.from("program_reviews").select("*").eq("application_id", id),
        supabase
          .from("application_eligibility_reviews")
          .select("*")
          .eq("application_id", id)
          .maybeSingle(),
      ]);
      if (applicationResult.error) throw applicationResult.error;
      if (detailResult.error) throw detailResult.error;
      const reviewIds = (reviewResult.data ?? []).map((review) => review.id);
      const { data: scores } = reviewIds.length
        ? await supabase.from("review_scores").select("*").in("review_id", reviewIds)
        : { data: [] };
      if (eligibilityResult.error) throw eligibilityResult.error;
      const eligibility = eligibilityResult.data;
      const [itemsResult, overridesResult, profileResult] = await Promise.all([
        eligibility
          ? supabase
              .from("eligibility_review_items")
              .select("*")
              .eq("eligibility_review_id", eligibility.id)
          : Promise.resolve({ data: [], error: null }),
        eligibility
          ? supabase
              .from("eligibility_scoring_overrides")
              .select("*")
              .eq("eligibility_review_id", eligibility.id)
              .order("event_number", { ascending: false })
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
        eligibility?.reviewed_by
          ? supabase
              .from("profiles")
              .select("full_name, email")
              .eq("id", eligibility.reviewed_by)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (itemsResult.error || overridesResult.error)
        throw itemsResult.error ?? overridesResult.error;
      return {
        application: applicationResult.data,
        detail: detailResult.data,
        documents: documentResult.data ?? [],
        criteria: (criterionResult.data ?? []).filter(
          (criterion) => criterion.rubric_version_id === rubricVersionResult.data?.id,
        ),
        rubricVersion: rubricVersionResult.data?.id ?? null,
        assignments: assignmentResult.data ?? [],
        reviews: reviewResult.data ?? [],
        scores: scores ?? [],
        eligibility,
        eligibilityItems: itemsResult.data ?? [],
        latestOverride: overridesResult.data?.[0] ?? null,
        confirmer: profileResult.data?.full_name || profileResult.data?.email || null,
      };
    },
    enabled: !!user && selectedProgram?.slug === "business_growth_grant",
  });
  const currentReview = data?.reviews.find((review) => review.reviewer_id === user?.id);
  const reviewKey = data
    ? `${id}:${currentReview?.id ?? "new"}:${currentReview?.version ?? 0}:${data.rubricVersion ?? "none"}`
    : "";
  useEffect(() => {
    if (!data || hydratedReview.current === reviewKey) return;
    setPoints(
      grantScoreDraft(
        data.criteria,
        data.scores.filter((score) => score.review_id === currentReview?.id),
      ),
    );
    setScoresDirty(false);
    setComments(currentReview?.reviewer_comments ?? "");
    setCommentsDirty(false);
    hydratedReview.current = reviewKey;
  }, [data, currentReview?.id, currentReview?.reviewer_comments, reviewKey]);
  if (isLoading) return <ReviewWorkspaceState state="loading" />;
  if (!data) return <ReviewWorkspaceState state="unavailable" />;
  const { application, detail } = data;
  const mine = currentReview;
  const myAssignment = data.assignments.find((assignment) => assignment.reviewer_id === user?.id);
  const canReview = canScoreAssignedGrant(myAssignment?.lifecycle, selectedProgram?.accessRole);
  const canScreen = role === "admin" || selectedProgram?.accessRole === "admin";
  const scoringAllowed =
    data.eligibility?.status === "eligible" || data.latestOverride?.scoring_allowed === true;
  const changeScore = (criterionId: string, score: number | null) => {
    const criterion = data.criteria.find((item) => item.id === criterionId);
    if (!criterion || !validGrantScore(score, criterion.maximum_points)) return;
    if ((points[criterionId] ?? null) === score) return;
    setPoints((current) => ({ ...current, [criterionId]: score }));
    setScoresDirty(true);
  };
  const changeComments = (value: string) => {
    setComments(value);
    setCommentsDirty(true);
  };
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["business-grant", id] }),
      qc.invalidateQueries({ queryKey: ["business-grants"] }),
    ]);
  };
  const runEligibility = async (
    call: PromiseLike<{ error: { message: string } | null }>,
    success: string,
  ) => {
    const { error } = await call;
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(success);
    await refresh();
  };
  const rawEntries =
    detail.raw_response &&
    typeof detail.raw_response === "object" &&
    !Array.isArray(detail.raw_response)
      ? Object.entries(detail.raw_response)
      : [];
  const documents: ReviewDocument[] = data.documents.map((document) => ({
    id: document.id,
    label: document.label,
    kind: document.document_type ?? "supporting",
    source: document.external_url ? "external" : "private_storage",
    url: document.external_url,
    storagePath: document.storage_path,
    contentType: document.content_type,
  }));
  const completed = data.reviews.filter((review) => review.status === "completed").length;
  const progress: ReviewProgress = {
    state: "known",
    assignedReviewers: data.assignments.length,
    startedReviews: data.reviews.length,
    completedReviews: completed,
    remainingReviews: Math.max(0, data.assignments.length - completed),
    denominator: { kind: "assigned", value: data.assignments.length },
    anomalies: [],
  };
  const status: ReviewStatus = {
    value: mine?.status === "completed" ? "submitted" : mine ? "in_progress" : "not_started",
    nativeValue: mine?.status ?? null,
  };
  const openDocument = async (document: ReviewDocument) => {
    if (document.url) {
      window.open(document.url, "_blank", "noopener,noreferrer");
      return;
    }
    if (document.storagePath) {
      const { data: signed } = await supabase.storage
        .from("business-grant-documents")
        .createSignedUrl(document.storagePath, 600);
      if (signed?.signedUrl) window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
    }
  };
  return (
    <ReviewWorkspace
      programName="Business Growth Grant"
      identity={detail.business_name}
      context={`${application.applicant_name} · ${application.applicant_email ?? "No email provided"}`}
      status={status}
      progress={progress}
      queuePath="/grants"
      dirty={scoresDirty || commentsDirty}
      sections={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <GrantOverview
              key={`${data.eligibility?.updated_at ?? "new"}-${data.eligibilityItems.map((item) => item.updated_at).join("-")}`}
              detail={detail}
              documents={documents}
              progress={progress}
              status={status}
              onOpenDocument={openDocument}
              eligibility={data.eligibility}
              items={data.eligibilityItems}
              latestOverride={data.latestOverride}
              confirmer={data.confirmer}
              canScreen={canScreen}
              onSaveItem={(key, status, notes) =>
                runEligibility(
                  supabase.rpc("set_grant_requirement", {
                    p_application_id: id,
                    p_requirement_key: key,
                    p_status: status,
                    p_notes: notes,
                  }),
                  "Verification saved.",
                )
              }
              onConfirm={(decision, notes) =>
                runEligibility(
                  supabase.rpc("confirm_grant_eligibility", {
                    p_application_id: id,
                    p_status: decision,
                    p_notes: notes,
                  }),
                  "Eligibility decision confirmed.",
                )
              }
              onOverride={(allowed, reason) =>
                runEligibility(
                  supabase.rpc("set_grant_scoring_override", {
                    p_application_id: id,
                    p_allowed: allowed,
                    p_reason: reason,
                  }),
                  "Scoring override recorded.",
                )
              }
            />
          ),
        },
        {
          id: "application",
          label: "Application",
          content: (
            <ApplicationSections
              criteria={data.criteria}
              points={points}
              onScoreChange={changeScore}
              canReview={canReview && mine?.status !== "completed"}
              scoringAllowed={scoringAllowed}
              eligibilityStatus={data.eligibility?.status ?? "not_reviewed"}
              sections={[
                {
                  title: "Business & Market",
                  fields: [
                    ["Tell us about your business", detail.business_description],
                    ["Business address", detail.business_address],
                    ["Business operating model", detail.business_operating_model],
                    ["Customers served during 2025", detail.customer_volume],
                    ["LARA explanation", detail.lara_explanation],
                  ],
                },
                {
                  title: "Financial Health",
                  fields: [
                    ["Financial performance changes", detail.financial_performance_change],
                    ["Applied for financing", detail.financing_applied],
                    ["Financing details", detail.financing_details],
                    ["Financial management resources", detail.financial_management_resources],
                  ],
                },
                {
                  title: "Growth Opportunity",
                  fields: [["Growth opportunity", detail.growth_opportunity]],
                },
                {
                  title: "Use of Funds",
                  fields: [["Specific $11,250 spending plan", detail.proposed_use_of_funds]],
                },
                {
                  title: "Expected Impact",
                  fields: [
                    ["Expected impact categories", detail.expected_impact_categories],
                    ["Measurable impact", detail.measurable_impact],
                    ["1–3 most important outcomes / success measures", detail.success_metrics],
                  ],
                },
                {
                  title: "Business Capacity",
                  fields: [
                    ["Owner's involvement", detail.owner_involvement],
                    ["Customers served during 2025", detail.customer_volume],
                  ],
                },
                {
                  title: "Why This Grant",
                  fields: [["Why this grant, and why now?", detail.why_grant_now]],
                },
                ...(rawEntries.length > 0
                  ? [
                      {
                        title: "Complete imported response",
                        fields: rawEntries.map(
                          ([label, value]) => [label, formatJson(value)] as [string, unknown],
                        ),
                      },
                    ]
                  : []),
              ]}
            />
          ),
        },
        {
          id: "documents",
          label: "Documents",
          count: documents.length,
          content: (
            <Card className="p-6">
              <SupportingDocuments documents={documents} onOpen={openDocument} />
            </Card>
          ),
        },
        {
          id: "rubric",
          label: "Rubric",
          content: (
            <ReviewPanel
              applicationId={id}
              assignmentId={myAssignment?.id}
              criteria={data.criteria}
              rubricVersion={data.rubricVersion}
              review={mine}
              points={points}
              comments={comments}
              onCommentsChange={changeComments}
              onScoreChange={changeScore}
              canReview={canReview}
              scoringAllowed={scoringAllowed}
              eligibilityStatus={data.eligibility?.status ?? "not_reviewed"}
              completedReviewCount={application.completed_review_count}
              onSaved={() => {
                setScoresDirty(false);
                setCommentsDirty(false);
                return qc.invalidateQueries({ queryKey: ["business-grant", id] });
              }}
            />
          ),
        },
      ]}
    />
  );
}

function ReviewWorkspaceState({ state }: { state: "loading" | "unavailable" }) {
  const progress: ReviewProgress = {
    state: "pending",
    assignedReviewers: null,
    startedReviews: null,
    completedReviews: null,
    remainingReviews: null,
    denominator: { kind: "unknown", value: null },
    anomalies: [],
  };
  return (
    <ReviewWorkspace
      programName="Business Growth Grant"
      identity="Application review"
      status={{ value: "unavailable", nativeValue: null }}
      progress={progress}
      state={state}
      queuePath="/grants"
      sections={[]}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const visible = (Array.isArray(children) ? children : [children]).filter((child) => child);
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl font-black uppercase">{title}</h2>
      <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">{visible}</div>
    </section>
  );
}

function Info({ label, value, link = false }: { label: string; value: unknown; link?: boolean }) {
  if (value == null || value === "") return null;
  const rendered = String(value);
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      {link && /^https?:\/\//.test(rendered) ? (
        <a
          href={rendered}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex min-w-0 max-w-full items-center gap-1 break-all font-medium text-primary hover:underline"
        >
          {rendered}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <div className="mt-1 font-medium whitespace-pre-wrap break-words">{rendered}</div>
      )}
    </div>
  );
}

function ApplicationSections({
  sections,
  criteria,
  points,
  onScoreChange,
  canReview,
  scoringAllowed,
  eligibilityStatus,
}: {
  sections: { title: string; fields: [string, unknown][] }[];
  criteria: Criterion[];
  points: GrantScoreDraft;
  onScoreChange: (criterionId: string, score: number | null) => void;
  canReview: boolean;
  scoringAllowed: boolean;
  eligibilityStatus: Database["public"]["Enums"]["grant_eligibility_status"];
}) {
  const [selected, setSelected] = useState(0);
  const visibleSections = sections.map((section) => ({
    ...section,
    fields: section.fields.filter(([, value]) => value != null && value !== ""),
  }));
  const current = visibleSections[selected] ?? visibleSections[0];
  const currentCriterion = criterionForGrantSection(current.title, criteria);
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] xl:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]">
      <nav
        aria-label="Application sections"
        className="grid grid-cols-2 gap-1 self-start rounded-lg border border-border bg-muted/30 p-2 sm:grid-cols-3 lg:sticky lg:top-4 lg:grid-cols-1"
      >
        {visibleSections.map((section, index) => {
          const criterion = criterionForGrantSection(section.title, criteria);
          return (
            <button
              key={section.title}
              type="button"
              id={`grant-application-section-${index}`}
              aria-pressed={selected === index}
              onClick={() => setSelected(index)}
              className={`min-h-11 min-w-0 rounded-md px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-card"}`}
            >
              <span className="block">{section.title}</span>
              {criterion && (
                <span className="block text-xs font-normal opacity-80">
                  {points[criterion.id] == null
                    ? "Unscored"
                    : `${points[criterion.id]} / ${criterion.maximum_points}`}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <section
        aria-labelledby={`grant-application-section-${selected}`}
        className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="font-display text-xl font-black uppercase">{current.title}</h2>
        {currentCriterion && (
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Rubric-scored section
          </p>
        )}
        {current.fields.length ? (
          <dl className="mt-5 space-y-5">
            {current.fields.map(([label, value]) => (
              <div key={label} className="border-t border-border pt-4 first:border-0 first:pt-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                  {String(value)}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No response recorded for this section.
          </p>
        )}
        {currentCriterion && (
          <div className="mt-6 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Score this criterion after reviewing the response. Save Draft or Submit Review in the
              Rubric tab.
            </p>
            {!scoringAllowed && (
              <p id="inline-scoring-locked" role="status" className="mt-3 text-sm font-semibold">
                {eligibilityStatus === "needs_clarification"
                  ? "Competitive scoring is paused while clarification is required."
                  : "Competitive scoring is locked until eligibility is confirmed."}
              </p>
            )}
            <RubricScoreField
              criterion={grantRubricCriterion(currentCriterion, points)}
              inputPrefix="application-criterion"
              disabled={!canReview || !scoringAllowed}
              disabledReason={
                !scoringAllowed
                  ? "Competitive scoring is locked until eligibility has been cleared or an authorized exception is active."
                  : !canReview
                    ? "An active assignment and open review are required to edit this score."
                    : undefined
              }
              onScoreChange={onScoreChange}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function grantRubricCriterion(criterion: Criterion, points: GrantScoreDraft): RubricCriterion {
  return {
    id: criterion.id,
    name: criterion.name,
    description: criterion.description,
    maximum: criterion.maximum_points,
    score: points[criterion.id] ?? null,
    guidance: guidanceForGrantCriterion(criterion.name, criterion.maximum_points),
  };
}

function formatJson(value: Json | undefined): string {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function ReviewPanel({
  applicationId,
  assignmentId,
  criteria,
  rubricVersion,
  review,
  points,
  comments,
  onCommentsChange,
  onScoreChange,
  canReview,
  scoringAllowed,
  eligibilityStatus,
  completedReviewCount,
  onSaved,
}: {
  applicationId: string;
  assignmentId?: string;
  criteria: Criterion[];
  rubricVersion: string | null;
  review?: ProgramReview;
  points: GrantScoreDraft;
  comments: string;
  onCommentsChange: (value: string) => void;
  onScoreChange: (criterionId: string, score: number | null) => void;
  canReview: boolean;
  scoringAllowed: boolean;
  eligibilityStatus: Database["public"]["Enums"]["grant_eligibility_status"];
  completedReviewCount: number;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState<"save" | "submit" | null>(null);
  const summary = grantReviewSummary(criteria, points);
  const submitted = review?.status === "completed";
  const exception = scoringAllowed && eligibilityStatus !== "eligible";
  const { canSave, canSubmit } = grantReviewActionState({
    assigned: canReview && !!assignmentId,
    scoringAllowed,
    submitted,
    hasRubricVersion: !!rubricVersion,
    summary,
  });
  async function save(complete: boolean) {
    if (!canReview || !scoringAllowed || !assignmentId || !rubricVersion || criteria.length === 0)
      return;
    if (review?.status === "completed")
      return toast.error("An administrator must reopen this submitted review.");
    if (!summary.scoresValid)
      return toast.error("Scores must be between zero and each criterion's maximum.");
    if (complete && !summary.complete)
      return toast.error(
        "Score every active criterion before submitting. Zero is a valid intentional score.",
      );
    setPending(complete ? "submit" : "save");
    try {
      const adapter = createReviewWriteAdapter(supabase, "business_growth_grant");
      const input = {
        intent: complete ? ("submit" as const) : ("save_draft" as const),
        program: "business_growth_grant" as const,
        applicationId,
        assignmentId,
        reviewId: review?.id,
        currentVersion: review?.version ?? 0,
        rubricVersion,
        criteria: grantScoreEntries(criteria, points),
        comments,
        idempotencyKey: createIdempotencyKey(),
      };
      if (complete) await adapter.submit(input);
      else await adapter.saveDraft(input);
      toast.success(complete ? "Review submitted." : "Draft saved.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save review.");
    } finally {
      setPending(null);
    }
  }
  return (
    <Card className="rounded-xl border-border/60 p-4 sm:p-6">
      <div className="border-b border-border pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Competitive review
            </p>
            <h2 className="mt-1 font-display text-xl">Rubric summary</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {submitted ? "Submitted review · Read only" : review ? "Draft review" : "Not started"}{" "}
              · {completedReviewCount} completed review(s) for this application
            </p>
          </div>
          <Badge variant="outline">
            {summary.completedCriteria} of {summary.totalCriteria} scored
          </Badge>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Current score
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {summary.currentScore}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {summary.maximumScore} possible
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Unscored criteria are excluded from the points earned.
            </p>
          </div>
          <p className="text-sm font-medium">
            {summary.unscoredCriteria} {summary.unscoredCriteria === 1 ? "criterion" : "criteria"}{" "}
            remaining
          </p>
        </div>
        <div className="mt-5" role="group" aria-label="Review progress">
          <div className="flex justify-between gap-3 text-sm">
            <span>Review progress</span>
            <span>
              {summary.completedCriteria} of {summary.totalCriteria} criteria ·{" "}
              {summary.completionPercent}% complete
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Criteria scored"
            aria-valuenow={summary.completedCriteria}
            aria-valuemin={0}
            aria-valuemax={summary.totalCriteria || 1}
            aria-valuetext={`${summary.completedCriteria} of ${summary.totalCriteria} criteria scored`}
            className="mt-2 h-2 overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full bg-primary" style={{ width: `${summary.completionPercent}%` }} />
          </div>
        </div>
        <p role="status" className="mt-4 text-sm font-semibold">
          {submitted
            ? "This review has been submitted. Scores and comments are read only."
            : exception
              ? "Competitive scoring allowed by administrator exception."
              : scoringAllowed
                ? "Competitive scoring allowed: eligibility cleared."
                : `Competitive scoring locked: ${eligibilityStatus === "needs_clarification" ? "clarification required" : eligibilityStatus === "ineligible" ? "application ineligible" : "eligibility not reviewed"}.`}
        </p>
        {summary.unscoredCriteria > 0 && (
          <div className="mt-4 text-sm">
            <p className="font-semibold">Still needs scoring</p>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {summary.unscoredNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {criteria.length === 0 ? (
        <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          No active rubric criteria are available. Scoring is disabled until an administrator
          activates a populated version.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {!scoringAllowed && (
            <p
              role="status"
              className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm font-semibold"
            >
              {eligibilityStatus === "needs_clarification"
                ? "Competitive scoring is paused while clarification is required."
                : "Competitive scoring is locked until eligibility is confirmed."}
            </p>
          )}
          <GrantReviewerGuidance />
          <ReviewRubric
            criteria={criteria.map((criterion) => grantRubricCriterion(criterion, points))}
            disabled={!canReview || !scoringAllowed || submitted}
            disabledReason={
              !scoringAllowed
                ? "Competitive scoring is locked until eligibility has been cleared or an authorized exception is active."
                : !canReview || submitted
                  ? "An active assignment and open review are required to edit this score."
                  : undefined
            }
            onScoreChange={onScoreChange}
          />
          <div>
            <Label htmlFor="grant-reviewer-comments">Reviewer comments</Label>
            <Textarea
              id="grant-reviewer-comments"
              className="mt-1"
              rows={5}
              disabled={!canSave}
              value={comments}
              onChange={(event) => onCommentsChange(event.target.value)}
              placeholder="Strengths, concerns, and discussion notes…"
            />
          </div>
          <GrantConsistencyGuidance />
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
            <h3 className="font-semibold">Review readiness</h3>
            <ul className="mt-2 space-y-1">
              <li>
                {scoringAllowed
                  ? "Ready: eligibility cleared or administrator exception active"
                  : "Blocked: competitive scoring is locked"}
              </li>
              <li>
                {summary.complete
                  ? `Ready: ${summary.totalCriteria} of ${summary.totalCriteria} criteria scored`
                  : `Incomplete: ${summary.unscoredCriteria} rubric criteria remain unscored`}
              </li>
              <li>
                {summary.scoresValid
                  ? "Ready: current score values valid"
                  : "Blocked: score values need correction"}
              </li>
              <li>
                {canReview
                  ? "Ready: active reviewer assignment"
                  : "Blocked: active reviewer assignment required"}
              </li>
            </ul>
            <p className="mt-3 font-medium">
              {submitted
                ? "Review submitted."
                : !rubricVersion || summary.totalCriteria === 0
                  ? "An active, populated rubric is required before submitting."
                  : canSubmit
                    ? "Ready to submit."
                    : `Score all ${summary.totalCriteria} active criteria before submitting.`}
            </p>
          </div>
          {canReview && !submitted && (
            <ReviewActions
              onSaveDraft={() => save(false)}
              onSubmit={() => save(true)}
              pending={pending}
              disabled={!canSave}
              submitDisabled={!canSubmit}
              message={
                !canSubmit
                  ? "Save Draft can keep an incomplete review. Submit Review requires every active criterion."
                  : null
              }
            />
          )}
        </div>
      )}
    </Card>
  );
}
