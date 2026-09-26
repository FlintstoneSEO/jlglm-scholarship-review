import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { mapBusinessGrantRow } from "@/lib/business-grant-import";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/grant-import")({ component: GrantImportPage });

type PreviewRow = ReturnType<typeof mapBusinessGrantRow> & { rowNumber: number };

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  )
    return error.message;
  return "Unknown import error";
}

function GrantImportPage() {
  const { user, selectedProgram } = useAuth();
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    updated: number;
    failed: number;
    errors: { rowNumber: number; message: string }[];
  } | null>(null);
  const isAdmin =
    selectedProgram?.slug === "business_growth_grant" && selectedProgram.accessRole === "admin";
  const valid = useMemo(() => rows.filter((row) => row.data), [rows]);

  function parse(file: File) {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.trim(),
      complete: ({ data, errors }) => {
        if (errors.length) {
          toast.error(`Could not read CSV: ${errors[0].message}`);
          return;
        }
        setRows(data.map((row, index) => ({ ...mapBusinessGrantRow(row), rowNumber: index + 2 })));
        setFileName(file.name);
        setResult(null);
      },
      error: (error) => toast.error(`Could not read CSV: ${error.message}`),
    });
  }

  async function runImport() {
    if (!user || !selectedProgram || !isAdmin || valid.length === 0) return;
    setBusy(true);
    const { data: batch, error: batchError } = await supabase
      .from("import_batches")
      .insert({
        program_id: selectedProgram.programId,
        source: "csv",
        source_file_name: fileName,
        imported_by: user.id,
      })
      .select("id")
      .single();
    if (batchError || !batch) {
      setBusy(false);
      return toast.error(batchError?.message ?? "Could not start import.");
    }
    let imported = 0,
      updated = 0,
      failed = rows.length - valid.length;
    const runtimeErrors: { rowNumber: number; message: string }[] = [];
    const logs: {
      batch_id: string;
      external_submission_id: string | null;
      application_id?: string | null;
      row_number: number;
      status: "imported" | "updated" | "failed";
      error_message?: string | null;
    }[] = rows
      .filter((row) => !row.data)
      .map((row) => ({
        batch_id: batch.id,
        external_submission_id: null,
        row_number: row.rowNumber,
        status: "failed",
        error_message: row.errors.join("; "),
      }));
    for (const row of valid) {
      const item = row.data!;
      try {
        const { data: existing, error: existingError } = await supabase
          .from("portal_applications")
          .select("id")
          .eq("program_id", selectedProgram.programId)
          .eq("external_submission_id", item.externalSubmissionId)
          .maybeSingle();
        if (existingError) throw existingError;

        const applicationValues = {
          program_id: selectedProgram.programId,
          external_submission_id: item.externalSubmissionId,
          submitted_at: item.submittedAt,
          applicant_name: item.applicantName,
          applicant_email: item.applicantEmail,
          status: "submitted" as const,
        };
        let applicationId: string;
        if (existing) {
          const { error: applicationError } = await supabase
            .from("portal_applications")
            .update(applicationValues)
            .eq("id", existing.id);
          if (applicationError) throw applicationError;
          applicationId = existing.id;
        } else {
          const { error: applicationError } = await supabase
            .from("portal_applications")
            .insert(applicationValues);
          if (applicationError) throw applicationError;

          const { data: inserted, error: lookupError } = await supabase
            .from("portal_applications")
            .select("id")
            .eq("program_id", selectedProgram.programId)
            .eq("external_submission_id", item.externalSubmissionId)
            .single();
          if (lookupError || !inserted)
            throw lookupError ?? new Error("Imported application could not be reloaded");
          applicationId = inserted.id;
        }
        const { error: detailError } = await supabase
          .from("business_grant_application_details")
          .upsert(
            { application_id: applicationId, ...item.detail },
            { onConflict: "application_id" },
          );
        if (detailError) throw detailError;
        for (const document of item.documents) {
          let duplicateQuery = supabase
            .from("application_documents")
            .select("id")
            .eq("application_id", applicationId);
          duplicateQuery = document.document_type
            ? duplicateQuery.eq("document_type", document.document_type)
            : duplicateQuery.eq("external_url", document.external_url);
          const { data: duplicate } = await duplicateQuery.maybeSingle();
          if (duplicate) {
            const { error: documentError } = await supabase
              .from("application_documents")
              .update(document)
              .eq("id", duplicate.id);
            if (documentError) throw documentError;
          } else {
            const { error: documentError } = await supabase
              .from("application_documents")
              .insert({ application_id: applicationId, ...document });
            if (documentError) throw documentError;
          }
        }
        if (existing) updated++;
        else imported++;
        logs.push({
          batch_id: batch.id,
          external_submission_id: item.externalSubmissionId,
          application_id: applicationId,
          row_number: row.rowNumber,
          status: existing ? "updated" : "imported",
        });
      } catch (error) {
        failed++;
        const message = errorMessage(error);
        runtimeErrors.push({ rowNumber: row.rowNumber, message });
        logs.push({
          batch_id: batch.id,
          external_submission_id: item.externalSubmissionId,
          row_number: row.rowNumber,
          status: "failed",
          error_message: message,
        });
      }
    }
    if (logs.length) await supabase.from("import_rows").insert(logs);
    await supabase
      .from("import_batches")
      .update({
        completed_at: new Date().toISOString(),
        imported_count: imported,
        updated_count: updated,
        failed_count: failed,
      })
      .eq("id", batch.id);
    setBusy(false);
    setResult({ imported, updated, failed, errors: runtimeErrors });
    toast.success(`Import finished: ${imported} new, ${updated} updated, ${failed} failed.`);
  }

  if (!isAdmin)
    return <Card className="p-6">Business Growth Grant administrator access is required.</Card>;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold font-semibold">
          Controlled ingestion
        </p>
        <h1 className="font-display text-3xl mt-1">Import Business Growth Grants</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Download Form Responses 1 from Google Sheets as a CSV, then upload it here. Re-importing
          the same export updates source-owned answers without changing reviews or assignments.
        </p>
      </div>
      <Card className="p-7 rounded-xl border-border/60">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-10 hover:bg-muted/30">
          <Upload className="h-7 w-7 text-primary" />
          <span className="font-medium mt-3">Choose Google Sheets CSV export</span>
          <span className="text-xs text-muted-foreground mt-1">
            Required: applicant first and last name (or a legacy contact name), and business name
          </span>
          <input
            className="hidden"
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => event.target.files?.[0] && parse(event.target.files[0])}
          />
        </label>
      </Card>
      {rows.length > 0 && (
        <Card className="p-6 rounded-xl border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl">Validation preview</h2>
              <p className="text-xs text-muted-foreground">
                {valid.length} valid of {rows.length} rows in {fileName}
              </p>
            </div>
            <Button onClick={runImport} disabled={busy || valid.length === 0}>
              {busy ? "Importing…" : `Import ${valid.length} valid rows`}
            </Button>
          </div>
          {result && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {result.imported} imported, {result.updated} updated, {result.failed} failed
              </div>
              {result.errors.length > 0 && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {result.errors.slice(0, 5).map((error) => (
                    <p key={`${error.rowNumber}-${error.message}`}>
                      Row {error.rowNumber}: {error.message}
                    </p>
                  ))}
                  {result.errors.length > 5 && (
                    <p>And {result.errors.length - 5} more import errors.</p>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Row</th>
                  <th className="text-left py-2">Business</th>
                  <th className="text-left py-2">Applicant</th>
                  <th className="text-left py-2">External ID</th>
                  <th className="text-left py-2">Validation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.slice(0, 50).map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="py-2">{row.rowNumber}</td>
                    <td className="py-2">{row.data?.detail.business_name ?? "—"}</td>
                    <td className="py-2">{row.data?.applicantName ?? "—"}</td>
                    <td className="py-2 text-muted-foreground">
                      {row.data?.externalSubmissionId ?? "—"}
                    </td>
                    <td className="py-2">
                      {row.data ? (
                        <Badge variant="outline" className="text-success border-success/40">
                          Ready
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3.5 w-3.5" />
                          {row.errors.join("; ")}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
