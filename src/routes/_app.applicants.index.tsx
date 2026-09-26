import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Star, Award, Mail } from "lucide-react";
import {
  fullName,
  preliminaryScreeningLabel,
  statusLabel,
  reviewStatusLabel,
} from "@/lib/applicant-utils";
import type { Applicant } from "@/lib/applicant-utils";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { ReviewQueue, type ReviewQueueColumn } from "@/components/review/ReviewQueue";
import {
  filterScholarshipQueue,
  projectScholarshipQueue,
  type ScholarshipQueueMetadata,
} from "@/lib/review-queue-projections";
import type { ReadState, ReviewQueueItem } from "@/lib/review-domain";

export const Route = createFileRoute("/_app/applicants/")({
  component: ApplicantsList,
});

function ApplicantsList() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [screeningFilter, setScreeningFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const query = useQuery({
    queryKey: ["applicants", role],
    queryFn: async () => {
      let request = supabase
        .from("applicants")
        .select("*")
        .order("submission_date", { ascending: false });
      if (!isAdmin) request = request.eq("preliminary_screening_status", "eligible_for_review");
      const applicantsResult = await request;
      if (applicantsResult.error) throw applicantsResult.error;
      const applicants = (applicantsResult.data ?? []) as Applicant[];
      const applicantIds = applicants.map((a) => a.id);
      const applicationIds = applicants
        .map((a) => a.application_id)
        .filter((id): id is string => !!id);
      const [reviewsResult, assignmentsResult] = await Promise.all([
        applicantIds.length
          ? supabase
              .from("reviews")
              .select("id, applicant_id, reviewer_id, is_complete")
              .in("applicant_id", applicantIds)
          : Promise.resolve({ data: [], error: null }),
        applicationIds.length
          ? supabase
              .from("reviewer_assignments")
              .select("id, application_id, reviewer_id")
              .in("application_id", applicationIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      return {
        applicants,
        reviews: reviewsResult.data ?? [],
        reviewError: !!reviewsResult.error,
        assignments: assignmentsResult.data ?? [],
        assignmentError: !!assignmentsResult.error,
      };
    },
  });
  const sourceState: ReadState = query.isLoading ? "loading" : query.isError ? "error" : "ready";
  const projected = useMemo(
    () =>
      projectScholarshipQueue({
        applicants: { data: query.data?.applicants ?? null, state: sourceState },
        reviews: {
          data: query.data?.reviews ?? null,
          state: query.data?.reviewError ? "error" : sourceState,
        },
        assignments: {
          data: query.data?.assignments ?? null,
          state: query.data?.assignmentError ? "error" : sourceState,
        },
      }),
    [query.data, sourceState],
  );

  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [college, setCollege] = useState("");
  const [status, setStatus] = useState("all");
  const [reviewStatus, setReviewStatus] = useState("all");
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [missEssay, setMissEssay] = useState(false);
  const [missTranscript, setMissTranscript] = useState(false);
  const [missSig, setMissSig] = useState(false);
  const filtered = useMemo(
    () =>
      filterScholarshipQueue(projected.items, {
        search,
        school,
        college,
        applicationStatus: status,
        screeningStatus: screeningFilter,
        reviewStatus,
        minScore,
        maxScore,
        missingEssay: missEssay,
        missingTranscript: missTranscript,
        missingSignature: missSig,
      }),
    [
      projected.items,
      search,
      school,
      college,
      status,
      screeningFilter,
      reviewStatus,
      minScore,
      maxScore,
      missEssay,
      missTranscript,
      missSig,
    ],
  );

  const bulkUpdate = (nextStatus: Applicant["preliminary_screening_status"]) => async () => {
    const { error } = await supabase
      .from("applicants")
      .update({
        preliminary_screening_status: nextStatus,
        preliminary_screened_by: user?.id ?? null,
        preliminary_screened_at: new Date().toISOString(),
      })
      .in("id", selectedIds);
    if (error) throw error;
  };
  const mutationOptions = (message: string) => ({
    onSuccess: () => {
      toast.success(message);
      setSelectedIds([]);
      qc.invalidateQueries({ queryKey: ["applicants"] });
    },
    onError: () => toast.error("Unable to update screening status. Please try again."),
  });
  const bulkMutation = useMutation({
    mutationFn: bulkUpdate("did_not_meet_minimum_requirements"),
    ...mutationOptions("Preliminary screening status updated."),
  });
  const bulkEligibleMutation = useMutation({
    mutationFn: bulkUpdate("eligible_for_review"),
    ...mutationOptions("Marked as eligible for review."),
  });
  const apps = query.data?.applicants ?? [];
  type Item = ReviewQueueItem<ScholarshipQueueMetadata>;
  const columns: ReviewQueueColumn<Item>[] = [
    { id: "school", label: "High school", cell: (item) => item.metadata.school ?? "—" },
    { id: "college", label: "College / vocational", cell: (item) => item.metadata.college ?? "—" },
    {
      id: "application",
      label: "Application",
      cell: (item) => (
        <Badge variant="outline">
          {item.metadata.applicationStatus
            ? statusLabel(item.metadata.applicationStatus as Applicant["application_status"])
            : "Unavailable"}
        </Badge>
      ),
    },
    ...(isAdmin
      ? [
          {
            id: "screening",
            label: "Preliminary screening",
            cell: (item: Item) => (
              <Badge variant="outline">
                {preliminaryScreeningLabel(
                  item.metadata.screeningState as Applicant["preliminary_screening_status"],
                )}
              </Badge>
            ),
          },
        ]
      : []),
    {
      id: "score",
      label: "Score",
      cell: (item) => (
        <span className="font-medium">
          {(item.metadata.score ?? 0).toFixed(0)}{" "}
          <span className="text-xs text-muted-foreground">/90</span>
        </span>
      ),
    },
    { id: "rank", label: "Rank", cell: (item) => `#${item.metadata.rank ?? "—"}` },
    {
      id: "docs",
      label: "Docs",
      cell: (item) =>
        item.metadata.missingDocuments.length ? (
          <Badge variant="outline" className="text-warning border-warning/40 bg-warning/10">
            {item.metadata.missingDocuments.length} missing
          </Badge>
        ) : (
          <Badge variant="outline" className="text-success border-success/40 bg-success/10">
            Complete
          </Badge>
        ),
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Applicants</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {apps.length} applicants total · {filtered.length} matching
        </p>
      </div>
      <Card className="p-5 rounded-xl border-border/60">
        <div className="grid md:grid-cols-3 gap-3">
          <div className="relative">
            <Search
              className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              placeholder="Search name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Input
            placeholder="High school"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
          />
          <Input
            placeholder="College / vocational school"
            value={college}
            onChange={(e) => setCollege(e.target.value)}
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Application status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(
                [
                  "submitted",
                  "complete",
                  "incomplete",
                  "finalist",
                  "selected",
                  "not_selected",
                  "withdrawn",
                ] as const
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={screeningFilter} onValueChange={setScreeningFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Preliminary screening" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All screening statuses</SelectItem>
                <SelectItem value="pending_screening">Pending Screening</SelectItem>
                <SelectItem value="eligible_for_review">Eligible for Review</SelectItem>
                <SelectItem value="did_not_meet_minimum_requirements">
                  Did Not Meet Minimum Requirements
                </SelectItem>
              </SelectContent>
            </Select>
          )}
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Review status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All review states</SelectItem>
              {(
                ["not_started", "in_progress", "reviewed", "needs_discussion", "follow_up"] as const
              ).map((s) => (
                <SelectItem key={s} value={s}>
                  {reviewStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              placeholder="Min score"
              type="number"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
            />
            <Input
              placeholder="Max score"
              type="number"
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-4 text-sm">
          <label className="flex items-center gap-2">
            <Checkbox checked={missEssay} onCheckedChange={(c) => setMissEssay(!!c)} /> Missing
            essay
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={missTranscript} onCheckedChange={(c) => setMissTranscript(!!c)} />{" "}
            Missing transcript
          </label>
          <label className="flex items-center gap-2">
            <Checkbox checked={missSig} onCheckedChange={(c) => setMissSig(!!c)} /> Missing
            signature
          </label>
        </div>
      </Card>
      <Card className="p-5 rounded-xl border-border/60">
        <h2 className="font-display text-xl">Applicant Review Status</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Finalist Selection Pending. Use document status groups below for follow-up.
        </p>
        <div className="mt-4 grid md:grid-cols-3 gap-4">
          <DocumentGroup
            title="Missing Signature"
            names={apps.filter((a) => !a.applicant_signature_status)}
          />
          <DocumentGroup title="Missing Transcript" names={apps.filter((a) => !a.has_transcript)} />
          <DocumentGroup title="Missing Essay" names={apps.filter((a) => !a.has_essay)} />
        </div>
      </Card>
      {isAdmin && (
        <div className="flex flex-wrap justify-end gap-2 items-center">
          <span className="text-xs text-muted-foreground mr-auto">
            {selectedIds.length} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!selectedIds.length || bulkEligibleMutation.isPending}
            onClick={() => bulkEligibleMutation.mutate()}
            className="bg-success/10 text-success border-success/40 hover:bg-success/20"
          >
            Mark as Eligible for Review
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={!selectedIds.length || bulkMutation.isPending}
            onClick={() => {
              if (
                confirm(
                  "This will hide the selected applications from reviewer access. Existing data will not be deleted.",
                )
              )
                bulkMutation.mutate();
            }}
          >
            Mark as Did Not Meet Minimum Requirements
          </Button>
        </div>
      )}
      <ReviewQueue
        items={filtered}
        state={projected.state === "ready" && filtered.length === 0 ? "empty" : projected.state}
        columns={columns}
        onRetry={() => query.refetch()}
        showAdminWarnings={isAdmin}
        leadingColumn={
          isAdmin
            ? {
                label: "Select",
                cell: (item) => (
                  <Checkbox
                    aria-label={`Select ${item.applicantName}`}
                    checked={selectedIds.includes(item.applicationId)}
                    onCheckedChange={(checked) =>
                      setSelectedIds(
                        checked
                          ? [...new Set([...selectedIds, item.applicationId])]
                          : selectedIds.filter((id) => id !== item.applicationId),
                      )
                    }
                  />
                ),
              }
            : undefined
        }
        rowActions={(item) => (
          <>
            {item.applicantEmail && (
              <a
                href={`mailto:${item.applicantEmail}`}
                aria-label={`Email ${item.applicantName}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
            {isAdmin && (
              <QuickFlag
                id={item.applicationId}
                field="is_finalist"
                current={item.metadata.isFinalist}
                icon={<Star className="h-4 w-4" aria-hidden="true" />}
                title="Toggle Finalist"
              />
            )}
            {isAdmin && (
              <QuickFlag
                id={item.applicationId}
                field="is_selected"
                current={item.metadata.isSelected}
                icon={<Award className="h-4 w-4" aria-hidden="true" />}
                title="Toggle Selected"
              />
            )}
          </>
        )}
      />
    </div>
  );
}

function DocumentGroup({ title, names }: { title: string; names: Applicant[] }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-muted/20">
      <h3 className="text-sm font-semibold">{title}</h3>
      {names.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">No applicants currently flagged.</p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {names.map((a) => (
            <li key={a.id}>{fullName(a)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuickFlag({
  id,
  field,
  current,
  icon,
  title,
}: {
  id: string;
  field: "is_finalist" | "is_selected";
  current: boolean | null;
  icon: React.ReactNode;
  title: string;
}) {
  const [val, setVal] = useState(!!current);
  async function toggle() {
    const next = !val;
    setVal(next);
    if (field === "is_finalist") {
      await supabase
        .from("applicants")
        .update(
          next ? { is_finalist: true, application_status: "finalist" } : { is_finalist: false },
        )
        .eq("id", id);
    } else {
      await supabase
        .from("applicants")
        .update(
          next
            ? { is_selected: true, application_status: "selected", is_finalist: true }
            : { is_selected: false },
        )
        .eq("id", id);
    }
  }
  return (
    <Button
      size="sm"
      variant={val ? "default" : "ghost"}
      onClick={toggle}
      title={title}
      className={val ? "bg-gold text-gold-foreground hover:bg-gold/90" : ""}
    >
      {icon}
    </Button>
  );
}
