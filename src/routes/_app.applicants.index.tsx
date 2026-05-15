import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Search, ExternalLink, Star, Award, Mail } from "lucide-react";
import { fullName, missingItems, preliminaryScreeningLabel, statusLabel, reviewStatusLabel } from "@/lib/applicant-utils";
import type { Applicant } from "@/lib/applicant-utils";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/applicants/")({
  component: ApplicantsList,
});

function ApplicantsList() {
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const [screeningFilter, setScreeningFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: ["applicants", role, screeningFilter],
    queryFn: async () => {
      let query = supabase.from("applicants").select("*").order("submission_date", { ascending: false });
      if (!isAdmin) query = query.eq("preliminary_screening_status", "eligible_for_review");
      if (isAdmin && screeningFilter !== "all") query = query.eq("preliminary_screening_status", screeningFilter as Applicant["preliminary_screening_status"]);
      const { data, error } = await query;
      if (error) throw error;
      return data as Applicant[];
    },
  });

  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("");
  const [college, setCollege] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [reviewStatus, setReviewStatus] = useState<string>("all");

  const bulkUpdate = (status: Applicant["preliminary_screening_status"]) => async () => {
    const { error } = await supabase.from("applicants").update({
      preliminary_screening_status: status,
      preliminary_screened_by: user?.id ?? null,
      preliminary_screened_at: new Date().toISOString(),
    }).in("id", selectedIds);
    if (error) throw error;
  };
  const bulkMutation = useMutation({
    mutationFn: bulkUpdate("did_not_meet_minimum_requirements"),
    onSuccess: () => { toast.success("Preliminary screening status updated."); setSelectedIds([]); qc.invalidateQueries({queryKey:["applicants"]}); },
    onError: () => toast.error("Unable to update screening status. Please try again."),
  });
  const bulkEligibleMutation = useMutation({
    mutationFn: bulkUpdate("eligible_for_review"),
    onSuccess: () => { toast.success("Marked as eligible for review."); setSelectedIds([]); qc.invalidateQueries({queryKey:["applicants"]}); },
    onError: () => toast.error("Unable to update screening status. Please try again."),
  });
  const [minScore, setMinScore] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [missEssay, setMissEssay] = useState(false);
  const [missTranscript, setMissTranscript] = useState(false);
  const [missSig, setMissSig] = useState(false);

  const ranked = useMemo(() => {
    const sorted = [...apps].sort((a, b) => Number(b.total_score) - Number(a.total_score));
    return new Map(sorted.map((a, i) => [a.id, i + 1] as const));
  }, [apps]);

  const filtered = useMemo(() => {
    return apps.filter((a) => {
      const name = fullName(a).toLowerCase();
      if (
        search &&
        !(
          name.includes(search.toLowerCase()) ||
          (a.email ?? "").toLowerCase().includes(search.toLowerCase())
        )
      )
        return false;
      if (school && !(a.graduation_high_school ?? "").toLowerCase().includes(school.toLowerCase()))
        return false;
      if (college && !(a.college_attending ?? "").toLowerCase().includes(college.toLowerCase()))
        return false;
      if (status !== "all" && a.application_status !== status) return false;
      if (reviewStatus !== "all" && a.review_status !== reviewStatus) return false;
      const sc = Number(a.total_score);
      if (minScore && sc < Number(minScore)) return false;
      if (maxScore && sc > Number(maxScore)) return false;
      if (missEssay && a.has_essay) return false;
      if (missTranscript && a.has_transcript) return false;
      if (missSig && a.applicant_signature_status) return false;
      return true;
    });
  }, [
    apps,
    search,
    school,
    college,
    status,
    reviewStatus,
    minScore,
    maxScore,
    missEssay,
    missTranscript,
    missSig,
  ]);

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
          <div className="relative md:col-span-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
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

          {isAdmin && <Select value={screeningFilter} onValueChange={setScreeningFilter}><SelectTrigger><SelectValue placeholder="Preliminary screening" /></SelectTrigger><SelectContent><SelectItem value="all">All screening statuses</SelectItem><SelectItem value="pending_screening">Pending Screening</SelectItem><SelectItem value="eligible_for_review">Eligible for Review</SelectItem><SelectItem value="did_not_meet_minimum_requirements">Did Not Meet Minimum Requirements</SelectItem></SelectContent></Select>}

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

      <Card className="rounded-xl border-border/60 overflow-hidden">
        {isAdmin && <div className="p-3 border-b flex justify-end"><Button size="sm" disabled={selectedIds.length===0 || bulkMutation.isPending} onClick={() => { if (confirm("This will hide the selected applications from reviewer access. Existing data will not be deleted.")) bulkMutation.mutate();}}>Mark as Did Not Meet Minimum Requirements</Button></div>}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                {isAdmin && <th className="text-left px-4 py-3">Select</th>}<th className="text-left px-4 py-3">Applicant</th>
                <th className="text-left px-4 py-3">High School</th>
                <th className="text-left px-4 py-3">College / Vocational</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Review</th>{isAdmin && <th className="text-left px-4 py-3">Preliminary Screening</th>}
                <th className="text-right px-4 py-3">Score</th>
                <th className="text-right px-4 py-3">Rank</th>
                <th className="text-left px-4 py-3">Docs</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={isAdmin ? 14 : 12} className="px-4 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 14 : 12} className="px-4 py-12 text-center text-muted-foreground">
                    No applicants match your filters.
                  </td>
                </tr>
              )}
              {filtered.map((a) => {
                const miss = missingItems(a);
                return (
                  <tr key={a.id} className="hover:bg-muted/40">
                    {isAdmin && <td className="px-4 py-3"><Checkbox checked={selectedIds.includes(a.id)} onCheckedChange={(c)=>setSelectedIds(c ? [...selectedIds,a.id] : selectedIds.filter((v)=>v!==a.id))} /></td>}
                    <td className="px-4 py-3">
                      <Link
                        to="/applicants/$id"
                        params={{ id: a.id }}
                        className="font-medium hover:text-primary"
                      >
                        {fullName(a)}
                      </Link>
                      {a.is_finalist && (
                        <Badge className="ml-2 bg-gold/20 text-gold-foreground border-gold/40">
                          Finalist
                        </Badge>
                      )}
                      {a.is_selected && (
                        <Badge className="ml-2 bg-success/20 text-success border-success/40">
                          Selected
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.graduation_high_school || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {a.college_attending || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {a.phone || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{statusLabel(a.application_status)}</Badge>
                    </td>
                    <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{reviewStatusLabel(a.review_status)}</Badge></td>{isAdmin && <td className="px-4 py-3"><Badge variant="outline">{preliminaryScreeningLabel(a.preliminary_screening_status)}</Badge></td>}
                    <td className="px-4 py-3 text-right font-medium">
                      {Number(a.total_score).toFixed(0)}{" "}
                      <span className="text-xs text-muted-foreground">/90</span>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      #{ranked.get(a.id) ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {miss.length === 0 ? (
                        <Badge
                          variant="outline"
                          className="text-success border-success/40 bg-success/10"
                        >
                          Complete
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-warning border-warning/40 bg-warning/10"
                        >
                          {miss.length} missing
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.updated_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Link to="/applicants/$id" params={{ id: a.id }}>
                          <Button size="sm" variant="ghost" title="View">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </Link>
                        {a.email && (
                          <a href={`mailto:${a.email}`}>
                            <Button size="sm" variant="ghost" title="Email">
                              <Mail className="h-4 w-4" />
                            </Button>
                          </a>
                        )}
                        {isAdmin && <QuickFlag
                          id={a.id}
                          field="is_finalist"
                          current={a.is_finalist}
                          icon={<Star className="h-4 w-4" />}
                          title="Toggle Finalist"
                        />}
                        {isAdmin && <QuickFlag
                          id={a.id}
                          field="is_selected"
                          current={a.is_selected}
                          icon={<Award className="h-4 w-4" />}
                          title="Toggle Selected"
                        />}
                      </div>
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
