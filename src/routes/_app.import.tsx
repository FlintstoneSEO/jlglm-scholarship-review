import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type ApplicantInsert = Database["public"]["Tables"]["applicants"]["Insert"];

export const Route = createFileRoute("/_app/import")({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: ImportPage,
});

const FIELDS = [
  ["submission_date", "Submission date"],
  ["first_name", "First name"],
  ["last_name", "Last name"],
  ["address", "Address"],
  ["phone", "Phone"],
  ["email", "Email"],
  ["high_school_graduate_or_ged", "High School Graduate or GED Recipient"],
  ["graduation_high_school", "Graduation High School"],
  ["ged_completion_date", "Date of GED Completion"],
  ["college_attending", "College, university, or vocational school"],
  ["essay_url", "Upload Essay"],
  ["transcript_url", "Upload Transcript"],
  ["applicant_signature_status", "Applicant's Signature"],
  ["applicant_signature_date", "Applicant Signature Date"],
  ["guardian_signature_status", "Parent/Guardian Signature"],
  ["guardian_signature_date", "Parent/Guardian Signature Date"],
  ["is_18_or_older", "Are you 18 years or older?"],
] as const;

function pickKey(row: Record<string, unknown>, candidates: string[]): string | null {
  const keys = Object.keys(row);
  for (const c of candidates) {
    const k = keys.find((k) => k.toLowerCase().trim() === c.toLowerCase().trim());
    if (k) return k;
  }
  // partial match
  for (const c of candidates) {
    const k = keys.find((k) => k.toLowerCase().includes(c.toLowerCase().substring(0, 12)));
    if (k) return k;
  }
  return null;
}

function asBool(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === "yes" || s === "true" || s === "y" || s === "1" || s === "signed" || s === "complete";
}
function asDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}
function asTimestamp(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function ImportPage() {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapped, setMapped] = useState<ApplicantInsert[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ ok: number; fail: number } | null>(null);

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target!.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
      setRows(json);
      setMapped(json.map(mapRow));
      setDone(null);
    };
    reader.readAsArrayBuffer(file);
  }

  function mapRow(r: Record<string, unknown>): ApplicantInsert {
    const get = (cands: string[]) => {
      const k = pickKey(r, cands);
      return k ? r[k] : null;
    };
    const first_name = String(get(["first_name", "First name", "First"]) ?? "").trim();
    const last_name = String(get(["last_name", "Last name", "Last"]) ?? "").trim();
    const essay = get(["essay_url", "Upload Essay", "Essay"]);
    const transcript = get(["transcript_url", "Upload Transcript", "Transcript"]);

    const out: ApplicantInsert = {
      first_name, last_name,
      submission_date: asTimestamp(get(["submission_date", "Submission Date", "Date"])),
      address: (get(["address", "Address"]) as string | null) ?? null,
      phone: (get(["phone", "Phone"]) as string | null) ?? null,
      email: (get(["email", "Email"]) as string | null) ?? null,
      high_school_graduate_or_ged: (get(["high_school_graduate_or_ged", "High School Graduate", "GED Recipient"]) as string | null) ?? null,
      graduation_high_school: (get(["graduation_high_school", "Graduation High School", "High School"]) as string | null) ?? null,
      ged_completion_date: asDate(get(["ged_completion_date", "Date of GED Completion", "GED"])),
      college_attending: (get(["college_attending", "College", "vocational"]) as string | null) ?? null,
      essay_url: essay ? String(essay) : null,
      transcript_url: transcript ? String(transcript) : null,
      applicant_signature_status: asBool(get(["applicant_signature", "Applicant's Signature"])),
      applicant_signature_date: asDate(get(["applicant_signature_date", "Applicant Signature Date"])),
      guardian_signature_status: asBool(get(["guardian_signature", "Parent/Guardian Signature"])),
      guardian_signature_date: asDate(get(["guardian_signature_date", "Parent/Guardian Signature Date"])),
      is_18_or_older: asBool(get(["18", "older"])),
    };

    const hasEssay = !!out.essay_url;
    const hasTranscript = !!out.transcript_url;
    const complete = hasEssay && hasTranscript && out.applicant_signature_status && (out.is_18_or_older || out.guardian_signature_status);
    out.application_status = complete ? "complete" : "incomplete";
    out.review_status = "not_started";
    return out;
  }

  async function importAll() {
    if (mapped.length === 0) return;
    setImporting(true);
    let ok = 0, fail = 0;
    const chunks: ApplicantInsert[][] = [];
    for (let i = 0; i < mapped.length; i += 50) chunks.push(mapped.slice(i, i + 50));
    for (const chunk of chunks) {
      const { error, count } = await supabase.from("applicants").insert(chunk, { count: "exact" });
      if (error) { fail += chunk.length; console.error(error); }
      else ok += count ?? chunk.length;
    }
    setImporting(false);
    setDone({ ok, fail });
    if (fail === 0) toast.success(`Imported ${ok} applicants`);
    else toast.warning(`Imported ${ok}, ${fail} failed`);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">Admin</p>
        <h1 className="font-display text-3xl mt-1">Import Applicants</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload your applicant CSV or Excel file. Field mapping happens automatically.</p>
      </div>

      <Card className="p-8 rounded-xl border-border/60">
        <label className="flex flex-col items-center justify-center gap-3 border-2 border-dashed border-border rounded-xl p-12 cursor-pointer hover:bg-muted/40 transition-colors">
          <div className="h-14 w-14 rounded-full bg-primary/10 text-primary grid place-items-center"><Upload className="h-6 w-6" /></div>
          <div className="text-center">
            <div className="font-medium">Drop your CSV or Excel file here</div>
            <div className="text-sm text-muted-foreground mt-1">.csv, .xlsx, .xls supported</div>
          </div>
          <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
        </label>

        <div className="mt-6 grid md:grid-cols-2 gap-3 text-sm">
          <div className="p-3 rounded-lg bg-muted">
            <div className="font-semibold flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-primary" /> Expected fields</div>
            <ul className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              {FIELDS.map(([k, label]) => <li key={k}>• {label}</li>)}
            </ul>
          </div>
          <div className="p-3 rounded-lg bg-muted">
            <div className="font-semibold">Auto-derived after import</div>
            <ul className="mt-2 text-xs text-muted-foreground space-y-1">
              <li>• Has essay / transcript</li>
              <li>• Has applicant / guardian signature</li>
              <li>• Missing items list</li>
              <li>• Application complete</li>
              <li>• Initial status</li>
            </ul>
          </div>
        </div>
      </Card>

      {mapped.length > 0 && (
        <Card className="p-6 rounded-xl border-border/60">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg">Preview ({mapped.length} rows)</h3>
              <p className="text-xs text-muted-foreground">Review the first rows before importing.</p>
            </div>
            <Button onClick={importAll} disabled={importing} className="bg-primary text-primary-foreground">
              {importing ? "Importing…" : `Import ${mapped.length} applicants`}
            </Button>
          </div>

          {done && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 text-sm ${done.fail === 0 ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
              {done.fail === 0 ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              Imported {done.ok} successfully{done.fail > 0 && `, ${done.fail} failed`}.
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">High School</th>
                  <th className="text-left px-3 py-2">College</th>
                  <th className="text-left px-3 py-2">Essay</th>
                  <th className="text-left px-3 py-2">Transcript</th>
                  <th className="text-left px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {mapped.slice(0, 25).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2">{r.first_name} {r.last_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.email || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.graduation_high_school || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.college_attending || "—"}</td>
                    <td className="px-3 py-2">{r.essay_url ? <Badge variant="outline" className="text-success border-success/40 bg-success/10">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    <td className="px-3 py-2">{r.transcript_url ? <Badge variant="outline" className="text-success border-success/40 bg-success/10">Yes</Badge> : <Badge variant="outline">No</Badge>}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{r.application_status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {mapped.length > 25 && <p className="text-xs text-muted-foreground mt-2">Showing first 25 of {mapped.length} rows.</p>}
          </div>
        </Card>
      )}

      <Card className="p-5 rounded-xl border-border/60 bg-secondary/40">
        <p className="text-sm"><strong>Important:</strong> The committee makes the final decision. This app will calculate scores, flag missing materials, and rank applicants — but it will never automatically choose recipients.</p>
      </Card>
    </div>
  );
}
