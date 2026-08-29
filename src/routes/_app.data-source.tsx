import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, ExternalLink, LoaderCircle, RefreshCw, Settings2, Sheet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, StatusBadge } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { businessGrantSourceTargets, suggestBusinessGrantMappings } from "@/lib/business-grant-import";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_app/data-source")({ component: DataSourcePage });

type InspectResult = { spreadsheetId: string; serviceAccountEmail: string; worksheets: { name: string; gid: string }[]; worksheet: { name: string; gid: string }; columns: string[]; rowCount: number };
type Mapping = { sourceColumn: string; targetField: string; required: boolean };

function extractSheetId(value: string) {
  return value.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? (value.match(/^[a-zA-Z0-9_-]{20,}$/)?.[0] ?? "");
}

function DataSourcePage() {
  const { user, selectedProgram } = useAuth();
  const client = useQueryClient();
  const isAdmin = selectedProgram?.slug === "business_growth_grant" && selectedProgram.accessRole === "admin";
  const { data: source, isLoading } = useQuery({
    queryKey: ["business-grant-data-source", selectedProgram?.programId], enabled: Boolean(isAdmin),
    queryFn: async () => {
      const { data, error } = await supabase.from("program_data_sources").select("*").eq("program_id", selectedProgram!.programId).eq("source_type", "google_sheets").maybeSingle();
      if (error) throw error; return data;
    },
  });
  const { data: savedMappings = [] } = useQuery({
    queryKey: ["business-grant-source-mappings", source?.id], enabled: Boolean(source?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("program_source_field_mappings").select("source_column, target_field, required").eq("data_source_id", source!.id).order("target_field");
      if (error) throw error; return data;
    },
  });
  const { data: runs = [] } = useQuery({
    queryKey: ["business-grant-sync-runs", source?.id], enabled: Boolean(source?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("program_sync_runs").select("*").eq("data_source_id", source!.id).order("started_at", { ascending: false }).limit(10);
      if (error) throw error; return data;
    },
  });
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [worksheetName, setWorksheetName] = useState("");
  const [inspection, setInspection] = useState<InspectResult | null>(null);
  const [mappings, setMappings] = useState<Mapping[]>([]);

  useEffect(() => {
    if (!source) return;
    setSpreadsheetUrl(source.spreadsheet_url); setWorksheetName(source.worksheet_name ?? "");
  }, [source]);
  useEffect(() => {
    if (savedMappings.length) setMappings(savedMappings.map((item) => ({ sourceColumn: item.source_column, targetField: item.target_field, required: item.required })));
  }, [savedMappings]);

  const inspect = useMutation({
    mutationFn: async (name = worksheetName || undefined) => {
      const { data, error } = await supabase.functions.invoke("google-sheets-sync", { body: { action: "inspect", dataSourceId: source?.id, programId: selectedProgram?.programId, spreadsheetUrl, worksheetName: name } });
      if (error) throw error; if (data?.error) throw new Error(data.error); return data as InspectResult;
    },
    onSuccess: (result) => {
      setInspection(result); setWorksheetName(result.worksheet.name);
      if (!mappings.length) setMappings(suggestBusinessGrantMappings(result.columns).map((item) => ({ ...item, required: item.targetField === "applicant_name" || item.targetField === "business_name" })));
      toast.success(`Connected to ${result.worksheet.name}.`);
    }, onError: (error) => toast.error(error instanceof Error ? error.message : "Could not inspect Google Sheet."),
  });
  const save = useMutation({
    mutationFn: async () => {
      const spreadsheetId = inspection?.spreadsheetId ?? extractSheetId(spreadsheetUrl); if (!spreadsheetId) throw new Error("Test a valid Google Sheets URL before saving.");
      const { data, error } = await supabase.from("program_data_sources").upsert({ program_id: selectedProgram!.programId, source_type: "google_sheets", spreadsheet_id: spreadsheetId, spreadsheet_url: spreadsheetUrl, worksheet_name: worksheetName || null, worksheet_gid: inspection?.worksheet.gid ?? null, service_account_email: inspection?.serviceAccountEmail ?? null, created_by: user!.id }, { onConflict: "program_id,source_type" }).select("id").single();
      if (error || !data) throw error ?? new Error("Could not save the data source.");
      const { error: deleteError } = await supabase.from("program_source_field_mappings").delete().eq("data_source_id", data.id); if (deleteError) throw deleteError;
      if (mappings.length) { const { error: mappingError } = await supabase.from("program_source_field_mappings").insert(mappings.map((mapping) => ({ data_source_id: data.id, source_column: mapping.sourceColumn, target_field: mapping.targetField, required: mapping.required }))); if (mappingError) throw mappingError; }
    },
    onSuccess: () => { toast.success("Google Sheets source and mappings saved."); client.invalidateQueries({ queryKey: ["business-grant-data-source"] }); client.invalidateQueries({ queryKey: ["business-grant-source-mappings"] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save data source."),
  });
  const syncNow = useMutation({
    mutationFn: async () => { const { data, error } = await supabase.functions.invoke("google-sheets-sync", { body: { action: "sync", dataSourceId: source!.id } }); if (error) throw error; if (data?.error) throw new Error(data.error); return data; },
    onSuccess: (data) => { const result = data.results?.[0]; toast.success(`Sync finished: ${result?.created ?? 0} new, ${result?.updated ?? 0} updated.`); client.invalidateQueries({ queryKey: ["business-grant-data-source"] }); client.invalidateQueries({ queryKey: ["business-grant-sync-runs"] }); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Sync failed."),
  });
  const toggleSync = useMutation({
    mutationFn: async (syncEnabled: boolean) => { const { error } = await supabase.from("program_data_sources").update({ sync_enabled: syncEnabled }).eq("id", source!.id); if (error) throw error; },
    onSuccess: () => { client.invalidateQueries({ queryKey: ["business-grant-data-source"] }); toast.success("Automatic sync setting updated."); },
    onError: () => toast.error("Could not update automatic sync."),
  });
  const mappedTargets = useMemo(() => new Set(mappings.map((mapping) => mapping.targetField)), [mappings]);

  if (!isAdmin) return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;
  return <div className="space-y-7">
    <PageHeader eyebrow="Business Growth Grants" title="Application source" description="Connect the private Google Form response sheet once. The portal securely syncs applicant data into Supabase; reviewers never read Google Sheets directly.">
      {source && <Button onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>{syncNow.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Sync now</Button>}
    </PageHeader>
    <Card className="border-l-4 border-l-primary p-6 shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Sheet className="text-primary" /><h2 className="text-lg font-black uppercase">Google Sheets</h2></div><p className="mt-1 text-sm text-muted-foreground">Share the spreadsheet with the service account as Viewer. Credentials remain in Supabase secrets.</p></div>{source && <StatusBadge status={source.last_sync_status === "failed" ? "needs_attention" : source.sync_enabled ? "completed" : "not_started"} />}</div>
      <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]"><div className="space-y-2"><Label htmlFor="sheet-url">Google Sheet URL</Label><Input id="sheet-url" value={spreadsheetUrl} onChange={(event) => setSpreadsheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." /></div><Button className="self-end" variant="secondary" onClick={() => inspect.mutate()} disabled={inspect.isPending || !spreadsheetUrl}>{inspect.isPending ? <LoaderCircle className="animate-spin" /> : <Database />} Test connection</Button></div>
      {inspection && <div className="mt-5 grid gap-3 rounded-lg border border-success/25 bg-success/5 p-4 text-sm md:grid-cols-3"><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Connection</span><span className="mt-1 flex items-center gap-1 font-semibold text-success"><CheckCircle2 className="h-4 w-4" /> Verified</span></div><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Detected rows</span><span className="font-semibold">{inspection.rowCount}</span></div><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Service account</span><span className="break-all font-semibold">{inspection.serviceAccountEmail}</span></div></div>}
      {(inspection || source) && <div className="mt-5 space-y-2"><Label>Worksheet</Label><Select value={worksheetName} onValueChange={(value) => { setWorksheetName(value); inspect.mutate(value); }}><SelectTrigger><SelectValue placeholder="Choose a worksheet" /></SelectTrigger><SelectContent>{(inspection?.worksheets ?? (source?.worksheet_name ? [{ name: source.worksheet_name, gid: source.worksheet_gid ?? "" }] : [])).map((sheet) => <SelectItem key={sheet.gid || sheet.name} value={sheet.name}>{sheet.name}</SelectItem>)}</SelectContent></Select></div>}
    </Card>
    {inspection && <Card className="p-6 shadow-[var(--shadow-card)]"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-black uppercase">Field mapping</h2><p className="mt-1 text-sm text-muted-foreground">Suggested matches are editable. Required mappings prevent incomplete rows from being imported.</p></div><Button variant="secondary" onClick={() => setMappings(suggestBusinessGrantMappings(inspection.columns).map((item) => ({ ...item, required: item.targetField === "applicant_name" || item.targetField === "business_name" })))}>Suggest matches</Button></div><div className="mt-5 space-y-3">{mappings.map((mapping, index) => <div className="grid gap-2 rounded-lg border border-border p-3 md:grid-cols-[1fr_1fr_auto]" key={`${mapping.sourceColumn}-${mapping.targetField}`}><Select value={mapping.sourceColumn} onValueChange={(value) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sourceColumn: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{inspection.columns.map((column) => <SelectItem key={column} value={column}>{column}</SelectItem>)}</SelectContent></Select><Select value={mapping.targetField} onValueChange={(value) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, targetField: value } : item))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{businessGrantSourceTargets.map((target) => <SelectItem key={target} value={target}>{target.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select><div className="flex items-center justify-between gap-3"><Label className="text-xs">Required</Label><Switch checked={mapping.required} onCheckedChange={(required) => setMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, required } : item))} /><Button size="sm" variant="ghost" onClick={() => setMappings((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button></div></div>)}</div><div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" onClick={() => setMappings((current) => [...current, { sourceColumn: inspection.columns.find((column) => !current.some((item) => item.sourceColumn === column)) ?? inspection.columns[0], targetField: businessGrantSourceTargets.find((target) => !mappedTargets.has(target)) ?? "additional_information", required: false }])}>Add mapping</Button><Button onClick={() => save.mutate()} disabled={save.isPending || !mappings.length}>{save.isPending ? "Saving…" : "Save configuration"}</Button></div></Card>}
    {source && <Card className="p-6 shadow-[var(--shadow-card)]"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-black uppercase">Automatic sync</h2><p className="mt-1 text-sm text-muted-foreground">Runs server-side every 15 minutes after the scheduled job is enabled in Supabase.</p></div><div className="flex items-center gap-3"><Label htmlFor="automatic-sync" className="text-sm font-semibold">{source.sync_enabled ? "Enabled" : "Disabled"}</Label><Switch id="automatic-sync" checked={source.sync_enabled} onCheckedChange={(value) => toggleSync.mutate(value)} disabled={toggleSync.isPending} /></div></div><div className="mt-4 grid gap-3 text-sm md:grid-cols-3"><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Worksheet</span>{source.worksheet_name ?? "Not selected"}</div><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Last sync</span>{source.last_sync_at ? new Date(source.last_sync_at).toLocaleString() : "Never"}</div><div><span className="block text-xs font-bold uppercase tracking-wide text-muted-foreground">Last result</span>{source.last_sync_summary ? `${(source.last_sync_summary as { created?: number }).created ?? 0} created / ${(source.last_sync_summary as { updated?: number }).updated ?? 0} updated` : "No runs yet"}</div></div></Card>}
    {source && <Card className="overflow-hidden shadow-[var(--shadow-card)]"><div className="flex items-center justify-between border-b border-border px-6 py-4"><div><h2 className="text-lg font-black uppercase">Sync history</h2><p className="text-sm text-muted-foreground">Failed rows are logged without stopping valid rows.</p></div><Link to="/grant-import"><Button variant="ghost" size="sm">Legacy file import <ExternalLink /></Button></Link></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-muted/70 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"><tr><th className="px-6 py-3">Started</th><th className="px-6 py-3">Trigger</th><th className="px-6 py-3">Result</th><th className="px-6 py-3">Records</th></tr></thead><tbody className="divide-y divide-border">{runs.length === 0 ? <tr><td className="px-6 py-6 text-muted-foreground" colSpan={4}>No sync runs yet.</td></tr> : runs.map((run) => <tr key={run.id}><td className="px-6 py-3">{new Date(run.started_at).toLocaleString()}</td><td className="px-6 py-3 capitalize">{run.trigger_type}</td><td className="px-6 py-3"><StatusBadge status={run.status === "failed" ? "needs_attention" : run.status === "partial" ? "in_progress" : run.status === "completed" ? "completed" : "not_started"} /></td><td className="px-6 py-3">{run.records_created} new · {run.records_updated} updated · {run.records_failed} failed</td></tr>)}</tbody></table></div></Card>}
    {isLoading && <p className="text-sm text-muted-foreground">Loading source configuration…</p>}
  </div>;
}
