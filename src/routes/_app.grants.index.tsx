import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/brand";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReviewQueue, type ReviewQueueColumn } from "@/components/review/ReviewQueue";
import { projectGrantQueue, type GrantQueueMetadata } from "@/lib/review-queue-projections";
import type { ReviewQueueItem } from "@/lib/review-domain";

export const Route = createFileRoute("/_app/grants/")({ component: GrantList });
type Item = ReviewQueueItem<GrantQueueMetadata>;
function GrantList() {
  const { selectedProgram, role } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [laraStatus, setLaraStatus] = useState("all");
  const [operatingModel, setOperatingModel] = useState("all");
  const [businessAge, setBusinessAge] = useState("all");
  const enabled = selectedProgram?.slug === "business_growth_grant";
  const query = useQuery({ queryKey: ["business-grants", selectedProgram?.programId], enabled, queryFn: async () => {
    const applicationsResult = await supabase.from("portal_applications").select("*").eq("program_id", selectedProgram!.programId).order("submitted_at", { ascending: false });
    if (applicationsResult.error) throw applicationsResult.error;
    const ids = (applicationsResult.data ?? []).map(item => item.id);
    const [detailsResult, assignmentsResult, reviewsResult] = await Promise.all([
      ids.length ? supabase.from("business_grant_application_details").select("application_id, business_name, business_operating_model, business_age_range, lara_status").in("application_id", ids) : Promise.resolve({ data: [], error: null }),
      supabase.from("reviewer_assignments").select("id, application_id, reviewer_id").eq("program_id", selectedProgram!.programId),
      supabase.from("program_reviews").select("id, application_id, reviewer_id, status").eq("program_id", selectedProgram!.programId),
    ]);
    return { applications: applicationsResult.data ?? [], details: detailsResult.data ?? [], detailError: !!detailsResult.error, assignments: assignmentsResult.data ?? [], assignmentError: !!assignmentsResult.error, reviews: reviewsResult.data ?? [], reviewError: !!reviewsResult.error };
  }});
  const projected = useMemo(() => projectGrantQueue({
    applications: { data: query.data?.applications ?? null, state: query.isLoading ? "loading" : query.isError ? "error" : "ready" },
    details: { data: query.data?.details ?? null, state: query.data?.detailError ? "error" : query.isLoading ? "loading" : query.isError ? "error" : "ready" },
    assignments: { data: query.data?.assignments ?? null, state: query.data?.assignmentError ? "error" : query.isLoading ? "loading" : query.isError ? "error" : "ready" },
    reviews: { data: query.data?.reviews ?? null, state: query.data?.reviewError ? "error" : query.isLoading ? "loading" : query.isError ? "error" : "ready" },
  }), [query.data, query.isError, query.isLoading]);
  const filtered = projected.items.filter(item => {
    if (status !== "all" && item.status.nativeValue !== status) return false;
    if (laraStatus !== "all" && item.metadata.laraStatus !== laraStatus) return false;
    if (operatingModel !== "all" && item.metadata.operatingModel !== operatingModel) return false;
    if (businessAge !== "all" && item.metadata.businessAge !== businessAge) return false;
    const q = search.toLowerCase(); return !q || item.applicantName.toLowerCase().includes(q) || (item.applicantEmail ?? "").toLowerCase().includes(q) || (item.metadata.businessName ?? "").toLowerCase().includes(q);
  });
  const values = (field: keyof GrantQueueMetadata) => [...new Set(projected.items.map(i => i.metadata[field]).filter((v): v is string => typeof v === "string"))].sort();
  if (!enabled) return <ReviewQueue items={[]} state="unavailable" columns={[]} />;
  const columns: ReviewQueueColumn<Item>[] = [
    { id: "business", label: "Business", cell: i => i.metadata.businessName ?? "Unavailable" },
    { id: "age", label: "Business age", cell: i => i.metadata.businessAge ?? "—" },
    { id: "lara", label: "LARA status", cell: i => i.metadata.laraStatus ?? "—" },
    { id: "model", label: "Operating model", cell: i => i.metadata.operatingModel ?? "—" },
    { id: "score", label: "Average score", cell: i => i.metadata.averageScore ?? "—" },
  ];
  return <div className="space-y-6"><PageHeader eyebrow="Business Growth Grants" title="Application review queue" description="Only applications assigned or otherwise authorized for your role are shown." />
    <Card className="p-4"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_repeat(4,180px)]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search business, applicant, or email" /></div>
    <Filter value={status} set={setStatus} label="review states" values={["not_started", "in_progress", "completed"]} /><Filter value={laraStatus} set={setLaraStatus} label="LARA states" values={values("laraStatus")} /><Filter value={operatingModel} set={setOperatingModel} label="operating models" values={values("operatingModel")} /><Filter value={businessAge} set={setBusinessAge} label="business ages" values={values("businessAge")} /></div></Card>
    <ReviewQueue items={filtered} state={projected.state === "ready" && filtered.length === 0 ? "empty" : projected.state} columns={columns} onRetry={() => query.refetch()} showAdminWarnings={role === "admin" || selectedProgram?.accessRole === "admin"} />
  </div>;
}
function Filter({ value, set, label, values }: { value: string; set: (v: string) => void; label: string; values: string[] }) { return <Select value={value} onValueChange={set}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All {label}</SelectItem>{values.map(v => <SelectItem key={v} value={v}>{v.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>; }
