import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, FileText, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Database, Json } from "@/integrations/supabase/types";

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
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading application…</div>;
  if (!data)
    return <Card className="p-8">This application is unavailable or not assigned to you.</Card>;
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
  return (
    <div className="space-y-6">
      <Link
        to="/grants"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to review queue
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
            Business Growth Grant
          </p>
          <h1 className="font-display text-3xl mt-1">{detail.business_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {application.applicant_name} · {application.applicant_email ?? "No email provided"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="capitalize">
            {application.review_status.replaceAll("_", " ")}
          </Badge>
          {mine && (
            <Badge
              className={
                mine.status === "completed"
                  ? "bg-success/15 text-success"
                  : "bg-warning/15 text-warning"
              }
            >
              {mine.status === "completed"
                ? "Your review is complete"
                : "Your review is in progress"}
            </Badge>
          )}
        </div>
      </div>
      <Section title="Applicant / Contact Information">
        <Info label="Contact name" value={detail.contact_name ?? application.applicant_name} />
        <Info label="Email" value={application.applicant_email} />
        <Info label="Phone" value={detail.contact_phone} />
      </Section>
      <Section title="Business Information">
        <Info label="Business name" value={detail.business_name} />
        <Info label="Legal business name" value={detail.legal_business_name} />
        <Info label="Structure" value={detail.business_structure} />
        <Info label="Year established" value={detail.year_established} />
        <Info label="Employees" value={detail.employee_count} />
        <Info label="Annual revenue range" value={detail.annual_revenue_range} />
        <Info label="Address" value={detail.business_address} />
        <Info label="Website" value={detail.website} link />
      </Section>
      <LongSection
        title="Business Description"
        fields={[
          ["Description", detail.business_description],
          ["Products and services", detail.products_services],
          ["Owner background", detail.owner_background],
        ]}
      />
      <LongSection
        title="Business Need and Proposed Use of Funds"
        fields={[
          [
            "Amount requested",
            detail.amount_requested == null
              ? null
              : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                  detail.amount_requested,
                ),
          ],
          ["Business need", detail.business_need],
          ["Proposed use of grant funds", detail.proposed_use_of_funds],
          ["Use-of-funds breakdown", detail.use_of_funds_breakdown],
        ]}
      />
      <LongSection
        title="Community Impact"
        fields={[
          ["Community impact", detail.community_impact],
          ["Jobs impact", detail.jobs_impact],
          ["Additional information", detail.additional_information],
        ]}
      />
      {data.documents.length > 0 && (
        <Card className="p-6 rounded-xl border-border/60">
          <h2 className="font-display text-xl">Supporting Documents</h2>
          <div className="mt-4 grid md:grid-cols-2 gap-3">
            {data.documents.map((document) => (
              <button
                key={document.id}
                onClick={async () => {
                  if (document.external_url)
                    return window.open(document.external_url, "_blank", "noopener,noreferrer");
                  if (document.storage_path) {
                    const { data: signed } = await supabase.storage
                      .from("business-grant-documents")
                      .createSignedUrl(document.storage_path, 600);
                    if (signed?.signedUrl)
                      window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
                  }
                }}
                className="flex items-center justify-between rounded-lg border border-border p-4 text-left hover:bg-muted/40"
              >
                <span className="flex items-center gap-3">
                  <FileText className="h-5 w-5 text-primary" />
                  <span>
                    <span className="block font-medium">{document.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {document.file_name ?? "Open supporting file"}
                    </span>
                  </span>
                </span>
                <ExternalLink className="h-4 w-4" />
              </button>
            ))}
          </div>
        </Card>
      )}
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
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const visible = (Array.isArray(children) ? children : [children]).filter((child) => child);
  return (
    <Card className="p-6 rounded-xl border-border/60">
      <h2 className="font-display text-xl">{title}</h2>
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
    <Card className="p-6 rounded-xl border-border/60">
      <h2 className="font-display text-xl">{title}</h2>
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
          {criteria.map((criterion) => (
            <div key={criterion.id} className="rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="max-w-2xl">
                  <Label className="font-display text-base">{criterion.name}</Label>
                  {criterion.description && (
                    <p className="text-xs text-muted-foreground mt-1">{criterion.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={criterion.maximum_points}
                    step="0.5"
                    className="w-24 text-right"
                    disabled={!canReview}
                    value={points[criterion.id] ?? 0}
                    onChange={(event) =>
                      setPoints((current) => ({
                        ...current,
                        [criterion.id]: Math.max(
                          0,
                          Math.min(criterion.maximum_points, Number(event.target.value) || 0),
                        ),
                      }))
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    / {criterion.maximum_points}
                  </span>
                </div>
              </div>
            </div>
          ))}
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
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => save(false)} disabled={busy}>
                <Save className="h-4 w-4 mr-1.5" />
                Save draft
              </Button>
              <Button onClick={() => save(true)} disabled={busy}>
                <Send className="h-4 w-4 mr-1.5" />
                Submit review
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
