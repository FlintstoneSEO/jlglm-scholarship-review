import { createClient } from "npm:@supabase/supabase-js@2";

type Mapping = { source_column: string; target_field: string; required: boolean };
type Source = {
  id: string; program_id: string; spreadsheet_id: string; spreadsheet_url: string;
  worksheet_name: string | null; worksheet_gid: string | null; sync_enabled: boolean;
  created_by: string | null;
};

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-jlgl-sync-secret" };
const detailFields = new Set(["contact_name", "contact_phone", "business_name", "legal_business_name", "business_structure", "year_established", "business_address", "website", "business_description", "products_services", "owner_background", "employee_count", "annual_revenue_range", "amount_requested", "business_need", "proposed_use_of_funds", "use_of_funds_breakdown", "community_impact", "jobs_impact", "additional_information", "eligibility_answers"]);

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function text(value: unknown) { const result = value == null ? "" : String(value).trim(); return result || null; }
function numberValue(value: unknown) { if (value == null || value === "") return null; const parsed = Number(String(value).replace(/[$,]/g, "")); return Number.isFinite(parsed) ? parsed : null; }
function dateValue(value: unknown) { const parsed = value ? new Date(String(value)) : null; return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : null; }
function parseSpreadsheetId(input: string) { const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) ?? input.match(/^([a-zA-Z0-9_-]{20,})$/); return match?.[1] ?? null; }
function urlList(value: unknown) { return (text(value)?.split(/[\n,]/) ?? []).map((item) => item.trim()).filter((item) => /^https:\/\//i.test(item)); }

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function googleAccessToken() {
  const raw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Google service account is not configured.");
  const serviceAccount = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!serviceAccount.client_email || !serviceAccount.private_key) throw new Error("Google service account secret is incomplete.");
  const now = Math.floor(Date.now() / 1000);
  const encodedHeader = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const encodedPayload = base64Url(JSON.stringify({ iss: serviceAccount.client_email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const pem = serviceAccount.private_key.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(pem); const keyBytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", keyBytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)));
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${encodedHeader}.${encodedPayload}.${base64Url(signature)}` }) });
  if (!response.ok) throw new Error("Google authorization failed. Confirm the service-account secret.");
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error("Google authorization did not return an access token.");
  return { token: token.access_token, serviceAccountEmail: serviceAccount.client_email };
}
async function readSheet(spreadsheetId: string, worksheetName?: string | null) {
  const { token, serviceAccountEmail } = await googleAccessToken();
  const headers = { Authorization: `Bearer ${token}` };
  const metadataResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets(properties(sheetId,title))`, { headers });
  if (!metadataResponse.ok) throw new Error("Google could not open this spreadsheet. Share it with the service account as Viewer.");
  const metadata = await metadataResponse.json() as { sheets?: { properties: { sheetId: number; title: string } }[] };
  const sheet = worksheetName ? metadata.sheets?.find((item) => item.properties.title === worksheetName) : metadata.sheets?.[0];
  if (!sheet) throw new Error("The selected worksheet was not found.");
  const valuesResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(sheet.properties.title)}?majorDimension=ROWS`, { headers });
  if (!valuesResponse.ok) throw new Error("Google could not read rows from the selected worksheet.");
  const values = await valuesResponse.json() as { values?: unknown[][] };
  const [rawHeaders = [], ...rows] = values.values ?? [];
  const columns = rawHeaders.map((header) => String(header).trim()).filter(Boolean);
  return { serviceAccountEmail, worksheets: (metadata.sheets ?? []).map((item) => ({ name: item.properties.title, gid: String(item.properties.sheetId) })), worksheet: { name: sheet.properties.title, gid: String(sheet.properties.sheetId) }, columns, rows };
}

function sourceRecord(headers: string[], row: unknown[], mappings: Mapping[]) {
  const raw = Object.fromEntries(headers.map((header, index) => [header, row[index] ?? null]));
  const mapped = Object.fromEntries(mappings.map((mapping) => [mapping.target_field, raw[mapping.source_column] ?? null]));
  const missing = mappings.filter((mapping) => mapping.required && !text(raw[mapping.source_column])).map((mapping) => mapping.target_field);
  const applicantName = text(mapped.applicant_name) ?? text(mapped.contact_name);
  const businessName = text(mapped.business_name);
  if (!applicantName) missing.push("applicant_name");
  if (!businessName) missing.push("business_name");
  return { raw, mapped, missing: [...new Set(missing)], applicantName, businessName };
}

async function isProgramAdmin(admin: ReturnType<typeof createClient>, userId: string, programId: string) {
  const [{ data: global }, { data: membership }] = await Promise.all([
    admin.from("user_roles").select("id").eq("user_id", userId).eq("role", "admin").maybeSingle(),
    admin.from("user_program_access").select("id").eq("user_id", userId).eq("program_id", programId).eq("access_role", "admin").maybeSingle(),
  ]);
  return Boolean(global || membership);
}

async function syncSource(admin: ReturnType<typeof createClient>, source: Source, mappings: Mapping[], triggeredBy: string | null, triggerType: "manual" | "scheduled") {
  const { data: run, error: runError } = await admin.from("program_sync_runs").insert({ data_source_id: source.id, triggered_by: triggeredBy, trigger_type: triggerType, status: "running" }).select("id").single();
  if (runError || !run) throw runError ?? new Error("Could not start sync run.");
  const { data: batch } = source.created_by ? await admin.from("import_batches").insert({ program_id: source.program_id, source: "google_sheets", source_file_name: source.spreadsheet_url, imported_by: source.created_by }).select("id").single() : { data: null };
  let created = 0, updated = 0, skipped = 0, failed = 0;
  const errors: { row: number; error: string }[] = [];
  try {
    const sheet = await readSheet(source.spreadsheet_id, source.worksheet_name);
    const logs: { batch_id: string; external_submission_id: string; application_id?: string; row_number: number; status: "imported" | "updated" | "failed"; error_message?: string }[] = [];
    for (const [index, row] of sheet.rows.entries()) {
      const rowNumber = index + 2;
      try {
        const record = sourceRecord(sheet.columns, row, mappings);
        if (record.missing.length) throw new Error(`Missing required mapped fields: ${record.missing.join(", ")}`);
        const mappedExternalId = text(record.mapped.external_submission_id);
        // Prefer a form response ID when the sheet exposes one. Google Forms response
        // sheets are append-only, so the row key is a deterministic fallback.
        const sourceKey = mappedExternalId
          ? `${source.id}:${sheet.worksheet.gid}:response:${mappedExternalId}`
          : `${source.id}:${sheet.worksheet.gid}:row:${rowNumber}`;
        const { data: previous } = await admin.from("portal_applications").select("id").eq("data_source_id", source.id).eq("source_record_key", sourceKey).maybeSingle();
        const externalId = mappedExternalId ?? sourceKey;
        const { data: application, error: applicationError } = await admin.from("portal_applications").upsert({
          program_id: source.program_id, data_source_id: source.id, source_record_key: sourceKey,
          external_submission_id: externalId, submitted_at: dateValue(record.mapped.submitted_at),
          applicant_name: record.applicantName!, applicant_email: text(record.mapped.applicant_email),
          source_metadata: { type: "google_sheets", spreadsheet_id: source.spreadsheet_id, worksheet: sheet.worksheet.name, worksheet_gid: sheet.worksheet.gid, row_number: rowNumber },
        }, { onConflict: "data_source_id,source_record_key" }).select("id").single();
        if (applicationError || !application) throw applicationError ?? new Error("Application upsert returned no record.");
        const details: Record<string, unknown> = { application_id: application.id, raw_response: record.raw };
        for (const [key, value] of Object.entries(record.mapped)) {
          if (!detailFields.has(key)) continue;
          details[key] = key === "year_established" || key === "employee_count" || key === "amount_requested" ? numberValue(value) : key === "eligibility_answers" ? { value: text(value) } : text(value);
        }
        details.business_name = record.businessName;
        details.contact_name ??= record.applicantName;
        const { error: detailError } = await admin.from("business_grant_application_details").upsert(details, { onConflict: "application_id" });
        if (detailError) throw detailError;
        for (const url of urlList(record.mapped.supporting_documents)) {
          const { data: existingDocument } = await admin.from("application_documents").select("id").eq("application_id", application.id).eq("external_url", url).maybeSingle();
          if (!existingDocument) await admin.from("application_documents").insert({ application_id: application.id, label: "Supporting document", external_url: url });
        }
        if (previous) updated++; else created++;
        if (batch) logs.push({ batch_id: batch.id, external_submission_id: externalId, application_id: application.id, row_number: rowNumber, status: previous ? "updated" : "imported" });
      } catch (error) {
        failed++; const message = error instanceof Error ? error.message : "Unknown row error"; errors.push({ row: rowNumber, error: message });
        if (batch) logs.push({ batch_id: batch.id, external_submission_id: `${source.id}:${rowNumber}`, row_number: rowNumber, status: "failed", error_message: message });
      }
    }
    if (logs.length) await admin.from("import_rows").insert(logs);
    if (batch) await admin.from("import_batches").update({ completed_at: new Date().toISOString(), imported_count: created, updated_count: updated, failed_count: failed }).eq("id", batch.id);
    const status = failed ? (created || updated ? "partial" : "failed") : "completed";
    const summary = { rows_read: sheet.rows.length, created, updated, skipped, failed };
    await admin.from("program_sync_runs").update({ status, completed_at: new Date().toISOString(), rows_read: sheet.rows.length, records_created: created, records_updated: updated, records_skipped: skipped, records_failed: failed, error_details: errors }).eq("id", run.id);
    await admin.from("program_data_sources").update({ worksheet_name: sheet.worksheet.name, worksheet_gid: sheet.worksheet.gid, last_sync_at: new Date().toISOString(), last_sync_status: status, last_sync_summary: summary }).eq("id", source.id);
    return { runId: run.id, status, ...summary };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await admin.from("program_sync_runs").update({ status: "failed", completed_at: new Date().toISOString(), records_failed: failed, error_details: [{ error: message }, ...errors] }).eq("id", run.id);
    await admin.from("program_data_sources").update({ last_sync_at: new Date().toISOString(), last_sync_status: "failed", last_sync_summary: { created, updated, skipped, failed, error: message } }).eq("id", source.id);
    throw error;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "POST required" }, 405);
  try {
    const body = await request.json() as { action?: "inspect" | "sync"; dataSourceId?: string; programId?: string; spreadsheetUrl?: string; worksheetName?: string };
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"); const url = Deno.env.get("SUPABASE_URL");
    if (!serviceKey || !url) throw new Error("Supabase function secrets are unavailable.");
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const scheduled = request.headers.get("x-jlgl-sync-secret") && request.headers.get("x-jlgl-sync-secret") === Deno.env.get("GOOGLE_SHEETS_SYNC_CRON_TOKEN");
    let userId: string | null = null;
    if (!scheduled) {
      const authorization = request.headers.get("authorization");
      if (!authorization?.startsWith("Bearer ")) return json({ error: "Authentication required." }, 401);
      const { data, error } = await admin.auth.getUser(authorization.slice(7));
      if (error || !data.user) return json({ error: "Invalid user session." }, 401);
      userId = data.user.id;
    }
    if (body.action === "inspect") {
      if (!userId || !body.spreadsheetUrl) return json({ error: "An admin session and spreadsheet URL are required." }, 400);
      const spreadsheetId = parseSpreadsheetId(body.spreadsheetUrl); if (!spreadsheetId) return json({ error: "Enter a valid Google Sheets URL." }, 400);
      // Inspect is only permitted after a program/source is selected, or by a global admin during first setup.
      if (body.dataSourceId) {
        const { data: source } = await admin.from("program_data_sources").select("program_id").eq("id", body.dataSourceId).single();
        if (!source || !(await isProgramAdmin(admin, userId, source.program_id))) return json({ error: "Program administrator access is required." }, 403);
      } else {
        if (!body.programId || !(await isProgramAdmin(admin, userId, body.programId))) return json({ error: "Program administrator access is required." }, 403);
      }
      const sheet = await readSheet(spreadsheetId, body.worksheetName);
      return json({ spreadsheetId, serviceAccountEmail: sheet.serviceAccountEmail, worksheets: sheet.worksheets, worksheet: sheet.worksheet, columns: sheet.columns, rowCount: sheet.rows.length });
    }
    if (body.action !== "sync") return json({ error: "Unsupported action." }, 400);
    const query = admin.from("program_data_sources").select("id, program_id, spreadsheet_id, spreadsheet_url, worksheet_name, worksheet_gid, sync_enabled, created_by");
    const { data: sources, error } = scheduled ? await query.eq("sync_enabled", true) : body.dataSourceId ? await query.eq("id", body.dataSourceId) : { data: null, error: new Error("dataSourceId is required") };
    if (error || !sources) throw error ?? new Error("No data source found.");
    const results = [];
    for (const source of sources as Source[]) {
      if (!scheduled && (!userId || !(await isProgramAdmin(admin, userId, source.program_id)))) return json({ error: "Program administrator access is required." }, 403);
      const { data: mappings } = await admin.from("program_source_field_mappings").select("source_column, target_field, required").eq("data_source_id", source.id);
      results.push(await syncSource(admin, source, (mappings ?? []) as Mapping[], userId, scheduled ? "scheduled" : "manual"));
    }
    return json({ results });
  } catch (error) { return json({ error: error instanceof Error ? error.message : "Unexpected sync failure." }, 500); }
});
