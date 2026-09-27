import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
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
import { ReviewRubric } from "@/components/review/ReviewRubric";
import { ReviewActions } from "@/components/review/ReviewActions";
import {
  GrantConsistencyGuidance,
  GrantReviewerGuidance,
} from "@/components/review/GrantReviewerGuidance";
import type { ReviewDocument, ReviewProgress, ReviewStatus } from "@/lib/review-domain";
import { createIdempotencyKey } from "@/lib/review-submission";
import { createReviewWriteAdapter } from "@/lib/review-submission-client";
import { guidanceForGrantCriterion } from "@/lib/grant-rubric-guidance";

export const Route = createFileRoute("/_app/grants/$id")({ component: GrantDetail });

type Criterion = Database["public"]["Tables"]["rubric_criteria"]["Row"];
type ProgramReview = Database["public"]["Tables"]["program_reviews"]["Row"];
type ReviewScore = Database["public"]["Tables"]["review_scores"]["Row"];

function GrantDetail() {
  const { id } = Route.useParams();
  const { user, selectedProgram } = useAuth();
  const qc = useQueryClient();
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
      ]);
      if (applicationResult.error) throw applicationResult.error;
      if (detailResult.error) throw detailResult.error;
      const reviewIds = (reviewResult.data ?? []).map((review) => review.id);
      const { data: scores } = reviewIds.length
        ? await supabase.from("review_scores").select("*").in("review_id", reviewIds)
        : { data: [] };
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
      };
    },
    enabled: !!user && selectedProgram?.slug === "business_growth_grant",
  });
  if (isLoading) return <ReviewWorkspaceState state="loading" />;
  if (!data) return <ReviewWorkspaceState state="unavailable" />;
  const { application, detail } = data;
  const mine = data.reviews.find((review) => review.reviewer_id === user?.id);
  const myAssignment = data.assignments.find((assignment) => assignment.reviewer_id === user?.id);
  const canReview =
    myAssignment?.lifecycle === "active" && selectedProgram?.accessRole === "reviewer";
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
  return (
    <ReviewWorkspace
      programName="Business Growth Grant"
      identity={detail.business_name}
      context={`${application.applicant_name} · ${application.applicant_email ?? "No email provided"}`}
      status={status}
      progress={progress}
      queuePath="/grants"
      sections={[
        {
          id: "overview",
          label: "Overview",
          content: (
            <div className="space-y-6">
              <Section title="Applicant">
                <Info label="Name" value={application.applicant_name} />
                <Info label="Email" value={application.applicant_email} />
                <Info label="Phone" value={detail.contact_phone} />
              </Section>
              <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
                <h2 className="font-display text-xl font-black uppercase">
                  Eligibility &amp; compliance
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pass/fail screening is separate from the 100-point competitive score. These record
                  indicators require reviewer verification.
                </p>
                <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                  <EligibilityItem
                    label="Black/African American ownership eligibility"
                    value={detail.descendant_eligibility}
                    note="The application response records identity; verify ownership separately."
                  />
                  <EligibilityItem
                    label="Business eligibility"
                    value={detail.eligibility_answers}
                  />
                  <EligibilityItem
                    label="LARA registration and good standing"
                    value={detail.lara_status}
                  />
                  <EligibilityItem
                    label="Required documentation"
                    value={
                      documents.length
                        ? `${documents.length} document(s) available; verify requirements`
                        : null
                    }
                    missing={documents.length === 0}
                  />
                  <EligibilityItem
                    label="2024 P&L"
                    value={
                      documents.some((document) => document.kind === "profit_loss_2024")
                        ? "Document available; verify contents"
                        : null
                    }
                    missing={!documents.some((document) => document.kind === "profit_loss_2024")}
                  />
                  <EligibilityItem
                    label="2025 P&L"
                    value={
                      documents.some((document) => document.kind === "profit_loss_2025")
                        ? "Document available; verify contents"
                        : null
                    }
                    missing={!documents.some((document) => document.kind === "profit_loss_2025")}
                  />
                </dl>
              </section>
              <Section title="Business at a glance">
                <Info label="Business name" value={detail.business_name} />
                <Info label="Business operating model" value={detail.business_operating_model} />
                <Info label="Time in business" value={detail.business_age_range} />
                <Info label="Owner's involvement" value={detail.owner_involvement} />
                <Info label="Documents" value={documents.length} />
                <Info
                  label="Rubric progress"
                  value={`${data.criteria.length} criteria · ${data.criteria.reduce((sum, criterion) => sum + criterion.maximum_points, 0)} possible points`}
                />
              </Section>
            </div>
          ),
        },
        {
          id: "application",
          label: "Application",
          content: (
            <ApplicationSections
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
              <SupportingDocuments
                documents={documents}
                onOpen={async (document) => {
                  if (document.url) {
                    window.open(document.url, "_blank", "noopener,noreferrer");
                    return;
                  }
                  if (document.storagePath) {
                    const { data: signed } = await supabase.storage
                      .from("business-grant-documents")
                      .createSignedUrl(document.storagePath, 600);
                    if (signed?.signedUrl)
                      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
                  }
                }}
              />
            </Card>
          ),
        },
        {
          id: "rubric",
          label: "Rubric",
          content: (
            <ReviewPanel
              key={`${mine?.id ?? "new"}-${data.scores.length}-${data.criteria.length}`}
              applicationId={id}
              assignmentId={myAssignment?.id}
              criteria={data.criteria}
              rubricVersion={data.rubricVersion}
              review={mine}
              scores={data.scores.filter((score) => score.review_id === mine?.id)}
              canReview={canReview}
              completedReviewCount={application.completed_review_count}
              onSaved={() => qc.invalidateQueries({ queryKey: ["business-grant", id] })}
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

function EligibilityItem({
  label,
  value,
  missing = false,
  note,
}: {
  label: string;
  value: unknown;
  missing?: boolean;
  note?: string;
}) {
  const display =
    value == null || value === "" || (typeof value === "object" && Object.keys(value).length === 0)
      ? "Not available in the application record"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const status =
    missing || display === "Not available in the application record" ? "Missing" : "Needs review";
  return (
    <div
      className={`rounded-md border p-3 ${status === "Missing" ? "border-warning/40 bg-warning/10" : "border-primary/25 bg-primary/5"}`}
    >
      <dt className="text-sm font-semibold">{label}</dt>
      <dd className="mt-1 break-words text-sm text-muted-foreground">
        <span
          className={`inline-block rounded px-2 py-0.5 font-semibold ${status === "Missing" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}
        >
          {status}
        </span>
        <span className="ml-2">{display}</span>
      </dd>
      {note && <dd className="mt-1 text-xs text-muted-foreground">{note}</dd>}
    </div>
  );
}

function ApplicationSections({
  sections,
}: {
  sections: { title: string; fields: [string, unknown][] }[];
}) {
  const [selected, setSelected] = useState(0);
  const visibleSections = sections.map((section) => ({
    ...section,
    fields: section.fields.filter(([, value]) => value != null && value !== ""),
  }));
  const current = visibleSections[selected] ?? visibleSections[0];
  return (
    <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(10rem,12rem)_minmax(0,1fr)] xl:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)]">
      <nav
        aria-label="Application sections"
        className="grid grid-cols-2 gap-1 self-start rounded-lg border border-border bg-muted/30 p-2 sm:grid-cols-3 lg:sticky lg:top-4 lg:grid-cols-1"
      >
        {visibleSections.map((section, index) => (
          <button
            key={section.title}
            type="button"
            id={`grant-application-section-${index}`}
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            className={`min-h-11 min-w-0 rounded-md px-3 py-2 text-left text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === index ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-card"}`}
          >
            {section.title}
          </button>
        ))}
      </nav>
      <section
        aria-labelledby={`grant-application-section-${selected}`}
        className="min-w-0 rounded-lg border border-border bg-card p-5 sm:p-6"
      >
        <h2 className="font-display text-xl font-black uppercase">{current.title}</h2>
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
      </section>
    </div>
  );
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
  scores,
  canReview,
  completedReviewCount,
  onSaved,
}: {
  applicationId: string;
  assignmentId?: string;
  criteria: Criterion[];
  rubricVersion: string | null;
  review?: ProgramReview;
  scores: ReviewScore[];
  canReview: boolean;
  completedReviewCount: number;
  onSaved: () => void;
}) {
  const initial = useMemo(
    () => new Map(scores.map((score) => [score.criterion_id, score.points])),
    [scores],
  );
  const [points, setPoints] = useState<Record<string, number>>(
    Object.fromEntries(criteria.map((criterion) => [criterion.id, initial.get(criterion.id) ?? 0])),
  );
  const [comments, setComments] = useState(review?.reviewer_comments ?? "");
  const [busy, setBusy] = useState(false);
  const total = criteria.reduce((sum, criterion) => sum + (points[criterion.id] ?? 0), 0);
  const maximum = criteria.reduce((sum, criterion) => sum + criterion.maximum_points, 0);
  async function save(complete: boolean) {
    if (!canReview || !assignmentId || !rubricVersion || criteria.length === 0) return;
    if (review?.status === "completed")
      return toast.error("An administrator must reopen this submitted review.");
    setBusy(true);
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
        criteria: criteria.map((criterion) => ({
          criterionId: criterion.id,
          value: points[criterion.id] ?? 0,
        })),
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
      setBusy(false);
    }
  }
  return (
    <Card className="p-6 rounded-xl border-border/60">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Reviewer Rubric</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {completedReviewCount} completed review(s). Each review is stored separately.
          </p>
        </div>
        <Badge className="bg-primary text-primary-foreground">
          {total} / {maximum}
        </Badge>
      </div>
      {criteria.length === 0 ? (
        <div className="mt-5 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          No active rubric criteria are available. Scoring is disabled until an administrator
          activates a populated version.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <GrantReviewerGuidance />
          <ReviewRubric
            criteria={criteria.map((criterion) => ({
              id: criterion.id,
              name: criterion.name,
              description: criterion.description,
              maximum: criterion.maximum_points,
              score: points[criterion.id] ?? null,
              guidance: guidanceForGrantCriterion(criterion.name, criterion.maximum_points),
            }))}
            disabled={!canReview}
            onScoreChange={(criterionId, score) => {
              const criterion = criteria.find((item) => item.id === criterionId);
              if (!criterion) return;
              setPoints((current) => ({
                ...current,
                [criterionId]: Math.max(0, Math.min(criterion.maximum_points, score ?? 0)),
              }));
            }}
          />
          <div>
            <Label>Reviewer comments</Label>
            <Textarea
              className="mt-1"
              rows={5}
              disabled={!canReview}
              value={comments}
              onChange={(event) => setComments(event.target.value)}
              placeholder="Strengths, concerns, and discussion notes…"
            />
          </div>
          <GrantConsistencyGuidance />
          {canReview && (
            <ReviewActions
              onSaveDraft={() => save(false)}
              onSubmit={() => save(true)}
              pending={busy ? "save" : null}
            />
          )}
        </div>
      )}
    </Card>
  );
}
