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
import type { ReviewDocument, ReviewProgress, ReviewStatus } from "@/lib/review-domain";

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
        criteria: criterionResult.data ?? [],
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
  const canReview = !!myAssignment && selectedProgram?.accessRole !== "viewer";
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
            <div className="space-y-5">
              <Section title="Applicant">
                <Info label="Name" value={application.applicant_name} />
                <Info label="Email" value={application.applicant_email} />
                <Info label="Phone" value={detail.contact_phone} />
                <Info label="Descendant eligibility" value={detail.descendant_eligibility} />
              </Section>
              <Section title="Business Profile">
                <Info label="Business name" value={detail.business_name} />
                <Info label="Address" value={detail.business_address} />
                <Info label="Business operating model" value={detail.business_operating_model} />
                <Info label="Time in business" value={detail.business_age_range} />
                <Info label="Owner's involvement" value={detail.owner_involvement} />
                <Info label="Customers served during 2025" value={detail.customer_volume} />
              </Section>
            </div>
          ),
        },
        {
          id: "application",
          label: "Application",
          content: (
            <div className="space-y-5">
              <LongSection
                title="Business Description"
                fields={[["Tell us about your business", detail.business_description]]}
              />
              <LongSection
                title="Compliance"
                fields={[
                  ["LARA status", detail.lara_status],
                  ["LARA explanation", detail.lara_explanation],
                ]}
              />
              <LongSection
                title="Financial Health"
                fields={[
                  ["Financial performance changes", detail.financial_performance_change],
                  ["Applied for financing", detail.financing_applied],
                  ["Financing details", detail.financing_details],
                  ["Financial management resources", detail.financial_management_resources],
                ]}
              />
              <LongSection
                title="Growth Opportunity"
                fields={[
                  ["Growth opportunity", detail.growth_opportunity],
                  ["Specific $11,250 spending plan", detail.proposed_use_of_funds],
                ]}
              />
              <LongSection
                title="Expected Impact"
                fields={[
                  ["Expected impact categories", detail.expected_impact_categories],
                  ["Measurable impact", detail.measurable_impact],
                  ["1–3 most important outcomes / success measures", detail.success_metrics],
                ]}
              />
              <LongSection
                title="Why This Grant"
                fields={[["Why this grant, and why now?", detail.why_grant_now]]}
              />
              {rawEntries.length > 0 && (
                <Card className="p-6 rounded-xl border-border/60">
                  <details>
                    <summary className="cursor-pointer font-display text-xl">
                      Complete imported response
                    </summary>
                    <div className="mt-5 grid md:grid-cols-2 gap-4">
                      {rawEntries.map(([label, value]) => (
                        <Info key={label} label={label} value={formatJson(value)} />
                      ))}
                    </div>
                  </details>
                </Card>
              )}
            </div>
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
                  if (document.url)
                    return window.open(document.url, "_blank", "noopener,noreferrer");
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
              programId={application.program_id}
              assignmentId={myAssignment?.id}
              reviewerId={user?.id ?? ""}
              criteria={data.criteria}
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
    <Card className="border-border/60 border-l-4 border-l-brand-red p-6 rounded-xl">
      <h2 className="font-display text-xl font-black uppercase">{title}</h2>
      <div className="mt-4 grid md:grid-cols-2 gap-x-8 gap-y-4">{visible}</div>
    </Card>
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
          className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
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

function LongSection({ title, fields }: { title: string; fields: [string, unknown][] }) {
  const visible = fields.filter(([, value]) => value != null && value !== "");
  if (!visible.length) return null;
  return (
    <Card className="border-border/60 border-l-4 border-l-brand-red p-6 rounded-xl">
      <h2 className="font-display text-xl font-black uppercase">{title}</h2>
      <div className="mt-4 space-y-5">
        {visible.map(([label, value]) => (
          <Info key={label} label={label} value={value} />
        ))}
      </div>
    </Card>
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
  programId,
  assignmentId,
  reviewerId,
  criteria,
  review,
  scores,
  canReview,
  completedReviewCount,
  onSaved,
}: {
  applicationId: string;
  programId: string;
  assignmentId?: string;
  reviewerId: string;
  criteria: Criterion[];
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
    if (!canReview || !assignmentId || criteria.length === 0) return;
    setBusy(true);
    try {
      let reviewId = review?.id;
      if (!reviewId) {
        const { data, error } = await supabase
          .from("program_reviews")
          .insert({
            assignment_id: assignmentId,
            application_id: applicationId,
            program_id: programId,
            reviewer_id: reviewerId,
            status: "in_progress",
            started_at: new Date().toISOString(),
            reviewer_comments: comments,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Could not create review");
        reviewId = data.id;
      }
      const scoreRows = criteria.map((criterion) => ({
        review_id: reviewId!,
        criterion_id: criterion.id,
        points: points[criterion.id] ?? 0,
      }));
      const { error: scoreError } = await supabase
        .from("review_scores")
        .upsert(scoreRows, { onConflict: "review_id,criterion_id" });
      if (scoreError) throw scoreError;
      const { error: reviewError } = await supabase
        .from("program_reviews")
        .update({
          status: complete ? "completed" : "in_progress",
          reviewer_comments: comments,
          started_at: review?.started_at ?? new Date().toISOString(),
          submitted_at: complete ? new Date().toISOString() : (review?.submitted_at ?? null),
        })
        .eq("id", reviewId);
      if (reviewError) throw reviewError;
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
          The committee has not configured the Business Growth Grant rubric yet. Scoring is disabled
          until an administrator adds criteria.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <ReviewRubric
            criteria={criteria.map((criterion) => ({
              id: criterion.id,
              name: criterion.name,
              description: criterion.description,
              maximum: criterion.maximum_points,
              score: points[criterion.id] ?? null,
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
