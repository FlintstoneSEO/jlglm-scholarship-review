import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader, StatusBadge } from "@/components/brand";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_app/grants/")({ component: GrantList });

function GrantList() {
  const { selectedProgram } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [laraStatus, setLaraStatus] = useState("all");
  const [operatingModel, setOperatingModel] = useState("all");
  const [businessAge, setBusinessAge] = useState("all");
  const enabled = selectedProgram?.slug === "business_growth_grant";
  const { data = [], isLoading } = useQuery({
    queryKey: ["business-grants", selectedProgram?.programId],
    enabled,
    queryFn: async () => {
      const { data: applications, error } = await supabase
        .from("portal_applications")
        .select("*")
        .eq("program_id", selectedProgram!.programId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const ids = (applications ?? []).map((item) => item.id);
      const { data: details } = ids.length
        ? await supabase
            .from("business_grant_application_details")
            .select(
              "application_id, business_name, business_operating_model, business_age_range, lara_status",
            )
            .in("application_id", ids)
        : { data: [] };
      const byId = new Map((details ?? []).map((detail) => [detail.application_id, detail]));
      return (applications ?? []).map((application) => ({
        ...application,
        detail: byId.get(application.id),
      }));
    },
  });
  const filtered = useMemo(
    () =>
      data.filter((item) => {
        if (status !== "all" && item.review_status !== status) return false;
        if (laraStatus !== "all" && item.detail?.lara_status !== laraStatus) return false;
        if (operatingModel !== "all" && item.detail?.business_operating_model !== operatingModel)
          return false;
        if (businessAge !== "all" && item.detail?.business_age_range !== businessAge) return false;
        const query = search.toLowerCase();
        return (
          !query ||
          item.applicant_name.toLowerCase().includes(query) ||
          (item.applicant_email ?? "").toLowerCase().includes(query) ||
          (item.detail?.business_name ?? "").toLowerCase().includes(query)
        );
      }),
    [businessAge, data, laraStatus, operatingModel, search, status],
  );
  const filterValues = (field: "lara_status" | "business_operating_model" | "business_age_range") =>
    [...new Set(data.map((item) => item.detail?.[field]).filter(Boolean) as string[])].sort();
  if (!enabled)
    return <Card className="p-6">Select Business Growth Grants to open this queue.</Card>;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business Growth Grants"
        title="Application review queue"
        description="Only applications assigned or otherwise authorized for your role are shown."
      />
      <Card className="p-4 rounded-xl border-border/60">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_repeat(4,180px)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, applicant, or email"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All review states</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={laraStatus} onValueChange={setLaraStatus}>
            <SelectTrigger>
              <SelectValue placeholder="LARA status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All LARA states</SelectItem>
              {filterValues("lara_status").map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={operatingModel} onValueChange={setOperatingModel}>
            <SelectTrigger>
              <SelectValue placeholder="Operating model" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All operating models</SelectItem>
              {filterValues("business_operating_model").map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={businessAge} onValueChange={setBusinessAge}>
            <SelectTrigger>
              <SelectValue placeholder="Time in business" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All business ages</SelectItem>
              {filterValues("business_age_range").map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>
      <Card className="rounded-xl border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Business</th>
                <th className="text-left px-4 py-3">Applicant</th>
                <th className="text-left px-4 py-3">Submitted</th>
                <th className="text-left px-4 py-3">Operating model</th>
                <th className="text-left px-4 py-3">Reviews</th>
                <th className="text-left px-4 py-3">Score</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted-foreground">
                    No applications match this view.
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-semibold">
                    {item.detail?.business_name ?? "Business name unavailable"}
                  </td>
                  <td className="px-4 py-3">
                    <div>{item.applicant_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.applicant_email ?? "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {item.submitted_at ? new Date(item.submitted_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">{item.detail?.business_operating_model ?? "—"}</td>
                  <td className="px-4 py-3">{item.completed_review_count}</td>
                  <td className="px-4 py-3">
                    {item.completed_review_count ? item.average_score : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.review_status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to="/grants/$id" params={{ id: item.id }}>
                      <Button size="sm" variant="ghost">
                        <ExternalLink className="h-4 w-4" />
                        <span className="sr-only">Open application</span>
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
