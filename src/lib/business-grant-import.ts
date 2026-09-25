import type { Json } from "@/integrations/supabase/types";

export const liveBusinessGrantHeaders = {
  submitted_at: "Timestamp",
  applicant_email: "Email Address",
  descendant_eligibility: "Do you identify as Black/Descendant of enslaved African Americans ?",
  applicant_first_name: "Applicant First Name",
  applicant_middle_name: "Applicant Middle Name",
  applicant_last_name: "Applicant Last Name",
  contact_phone: "Phone Number",
  business_name: "Business Name",
  business_address: "Business Address",
  business_operating_model: "Where does your business primarily operate?",
  business_age_range: "How long has your business been operating?",
  lara_status:
    "Is your business currently registered and in good standing with the Michigan Department of Licensing and Regulatory Affairs (LARA)?",
  lara_explanation: "You answered No or Unsure regarding LARA status, please explain.",
  lara_documentation: "Upload documentation demonstrating LARA good standing",
  business_description: "Tell us about your business",
  profit_loss_2024: "Upload 2024 Profit and Loss Statement",
  profit_loss_2025: "Upload 2025 Profit and Loss Statement",
  financial_performance_change:
    "What were the most significant changes in your business's financial performance between 2024 and 2025?",
  financing_applied:
    "In the past 12 months, have you applied for business financing from a bank, credit union, or other financial institution?",
  financing_details:
    "If you were denied or received less than requested, briefly describe the circumstances and amount requested.",
  financial_management_resources:
    "Which financial management resources does your business currently use? Select all that apply.",
  growth_opportunity:
    "What specific growth opportunity would this 11,250 dollar grant allow your business to pursue?",
  proposed_use_of_funds: "Provide a specific plan for how you would use the 11,250 dollar grant.",
  expected_impact_categories:
    "How will the grant investment change or improve your business within 12 months of receiving the funds? Select all that apply and describe the expected impact:",
  measurable_impact:
    "Provide details on your expected business impact, including specific measurable outcomes",
  success_metrics:
    "What are the 1 to 3 most important business outcomes you expect to achieve within 12 months, and how will you measure success?",
  owner_involvement: "Owner's Involvement",
  customer_volume:
    "Approximately how many customers or clients did your business serve during 2025?",
  why_grant_now: "Why This Grant, and Why Now?",
} as const;

type LegacyTarget =
  | "external_submission_id"
  | "applicant_name"
  | "contact_name"
  | "legal_business_name"
  | "business_structure"
  | "year_established"
  | "website"
  | "products_services"
  | "owner_background"
  | "employee_count"
  | "annual_revenue_range"
  | "amount_requested"
  | "business_need"
  | "use_of_funds_breakdown"
  | "community_impact"
  | "jobs_impact"
  | "eligibility_answers"
  | "additional_information"
  | "supporting_documents";
export type BusinessGrantTarget = keyof typeof liveBusinessGrantHeaders | LegacyTarget;

export const businessGrantSourceTargets: BusinessGrantTarget[] = [
  "external_submission_id",
  "submitted_at",
  "applicant_first_name",
  "applicant_middle_name",
  "applicant_last_name",
  "applicant_name",
  "applicant_email",
  "contact_phone",
  "descendant_eligibility",
  "business_name",
  "business_address",
  "business_operating_model",
  "business_age_range",
  "lara_status",
  "lara_explanation",
  "lara_documentation",
  "business_description",
  "profit_loss_2024",
  "profit_loss_2025",
  "financial_performance_change",
  "financing_applied",
  "financing_details",
  "financial_management_resources",
  "growth_opportunity",
  "proposed_use_of_funds",
  "expected_impact_categories",
  "measurable_impact",
  "success_metrics",
  "owner_involvement",
  "customer_volume",
  "why_grant_now",
  "contact_name",
  "legal_business_name",
  "business_structure",
  "year_established",
  "website",
  "products_services",
  "owner_background",
  "employee_count",
  "annual_revenue_range",
  "amount_requested",
  "business_need",
  "use_of_funds_breakdown",
  "community_impact",
  "jobs_impact",
  "eligibility_answers",
  "additional_information",
  "supporting_documents",
];

const legacyAliases: Partial<Record<BusinessGrantTarget, string[]>> = {
  external_submission_id: [
    "external_submission_id",
    "submission id",
    "response id",
    "form response id",
    "id",
  ],
  applicant_name: ["applicant_name", "applicant name", "contact name", "name"],
  contact_name: ["contact name"],
  applicant_email: ["applicant_email", "email", "email address"],
  contact_phone: ["contact_phone", "phone", "phone number"],
  business_name: ["business_name", "business name", "name of business"],
  legal_business_name: ["legal_business_name", "legal business name"],
  business_structure: ["business_structure", "business structure", "entity type"],
  year_established: ["year_established", "year established", "year founded"],
  business_address: ["business_address", "business address"],
  website: ["website", "business website"],
  business_description: ["business_description", "business description", "describe your business"],
  products_services: ["products_services", "products and services", "products/services"],
  owner_background: ["owner_background", "owner background", "entrepreneur background"],
  employee_count: ["employee_count", "number of employees", "employees"],
  annual_revenue_range: ["annual_revenue_range", "annual revenue", "revenue range"],
  amount_requested: ["amount_requested", "grant amount requested", "amount requested"],
  business_need: ["business_need", "business need", "why do you need"],
  proposed_use_of_funds: ["proposed_use_of_funds", "proposed use of funds", "use of grant funds"],
  use_of_funds_breakdown: ["use_of_funds_breakdown", "funds breakdown", "budget"],
  community_impact: ["community_impact", "community impact"],
  jobs_impact: ["jobs_impact", "jobs impact", "employment impact"],
  additional_information: ["additional_information", "additional information", "anything else"],
  supporting_documents: [
    "supporting_documents",
    "supporting documents",
    "attachments",
    "upload documents",
  ],
};

export const requiredBusinessGrantTargets: ReadonlySet<string> = new Set([
  "applicant_first_name",
  "applicant_last_name",
  "business_name",
]);

export type BusinessGrantSourceMapping = {
  sourceColumn: string;
  targetField: string;
};

export function validateBusinessGrantMappings(
  mappings: BusinessGrantSourceMapping[],
  availableColumns?: string[],
) {
  const duplicateValues = (values: string[]) => {
    const counts = new Map<string, number>();
    values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
  };
  const mappedTargets = new Set(mappings.map((mapping) => mapping.targetField));
  return {
    duplicateSourceColumns: duplicateValues(mappings.map((mapping) => mapping.sourceColumn)),
    duplicateTargets: duplicateValues(mappings.map((mapping) => mapping.targetField)),
    missingRequiredTargets: [...requiredBusinessGrantTargets].filter(
      (target) => !mappedTargets.has(target),
    ),
    missingMappedSourceColumns: availableColumns
      ? mappings
          .filter((mapping) => !availableColumns.includes(mapping.sourceColumn))
          .map((mapping) => mapping.sourceColumn)
      : [],
  };
}

export const businessGrantDocumentTargets = {
  lara_documentation: {
    label: "LARA Good Standing Documentation",
    document_type: "lara_documentation",
  },
  profit_loss_2024: { label: "2024 Profit & Loss Statement", document_type: "profit_loss_2024" },
  profit_loss_2025: { label: "2025 Profit & Loss Statement", document_type: "profit_loss_2025" },
} as const;

export type BusinessGrantDocument = {
  label: string;
  document_type: string | null;
  external_url: string;
  file_name: string | null;
};

export type BusinessGrantImportRow = {
  externalSubmissionId: string;
  submittedAt: string | null;
  applicantName: string;
  applicantEmail: string | null;
  detail: Record<string, Json | undefined> & { business_name: string; raw_response: Json };
  documents: BusinessGrantDocument[];
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function aliasesFor(target: BusinessGrantTarget): string[] {
  const live = liveBusinessGrantHeaders[target as keyof typeof liveBusinessGrantHeaders];
  return [...(live ? [live] : []), ...(legacyAliases[target] ?? []), target];
}

export function suggestBusinessGrantMappings(headers: string[]) {
  const used = new Set<string>();
  return businessGrantSourceTargets.flatMap((targetField) => {
    const candidate = headers.find(
      (header) =>
        !used.has(header) &&
        aliasesFor(targetField).some((alias) => normalize(alias) === normalize(header)),
    );
    if (!candidate) return [];
    used.add(candidate);
    return [{ sourceColumn: candidate, targetField }];
  });
}

function value(row: Record<string, unknown>, target: BusinessGrantTarget): unknown {
  const normalized = new Map(Object.keys(row).map((key) => [normalize(key), key]));
  for (const alias of aliasesFor(target)) {
    const key = normalized.get(normalize(alias));
    if (key) return row[key];
  }
  return null;
}

function text(input: unknown): string | null {
  const result = input == null ? "" : String(input).trim();
  return result || null;
}

function numberValue(input: unknown): number | null {
  if (input == null || input === "") return null;
  const parsed = Number(String(input).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(input: unknown): string | null {
  if (!input) return null;
  const parsed = input instanceof Date ? input : new Date(String(input));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function deriveApplicantName(first: unknown, middle: unknown, last: unknown) {
  return [text(first), text(middle), text(last)].filter(Boolean).join(" ");
}

function urlList(input: unknown) {
  return (
    text(input)
      ?.split(/[\n,]/)
      .map((url) => url.trim())
      .filter((url) => /^https?:\/\//i.test(url)) ?? []
  );
}

export function mapBusinessGrantRow(row: Record<string, unknown>): {
  data?: BusinessGrantImportRow;
  errors: string[];
} {
  const firstName = text(value(row, "applicant_first_name"));
  const middleName = text(value(row, "applicant_middle_name"));
  const lastName = text(value(row, "applicant_last_name"));
  const legacyName = text(value(row, "applicant_name"));
  const applicantName = deriveApplicantName(firstName, middleName, lastName) || legacyName;
  const businessName = text(value(row, "business_name"));
  const hasLiveNameFields = firstName != null || middleName != null || lastName != null;
  const errors = [
    hasLiveNameFields && !firstName && "Missing applicant first name",
    hasLiveNameFields && !lastName && "Missing applicant last name",
    !applicantName && "Missing applicant/contact name",
    !businessName && "Missing business name",
  ].filter(Boolean) as string[];
  if (errors.length) return { errors };
  const validApplicantName = applicantName!;
  const validBusinessName = businessName!;

  const submittedAt = timestamp(value(row, "submitted_at"));
  const suppliedId = text(value(row, "external_submission_id"));
  const externalSubmissionId =
    suppliedId ??
    `derived:${submittedAt ?? "undated"}:${normalize(validApplicantName)}:${normalize(validBusinessName)}`;
  const detailTargets = businessGrantSourceTargets.filter(
    (target) =>
      ![
        "external_submission_id",
        "submitted_at",
        "applicant_name",
        "applicant_email",
        "business_name",
        "lara_documentation",
        "profit_loss_2024",
        "profit_loss_2025",
        "supporting_documents",
      ].includes(target),
  );
  const detailValues: Record<string, Json | undefined> = {};
  for (const target of detailTargets) {
    const raw = value(row, target);
    detailValues[target] = ["year_established", "employee_count", "amount_requested"].includes(
      target,
    )
      ? numberValue(raw)
      : text(raw);
  }
  const detail = {
    ...detailValues,
    business_name: validBusinessName,
    raw_response: row as Json,
    contact_name: validApplicantName,
    applicant_first_name: firstName,
    applicant_middle_name: middleName,
    applicant_last_name: lastName,
    eligibility_answers: {},
  };

  const documents: BusinessGrantDocument[] = [];
  for (const [target, metadata] of Object.entries(businessGrantDocumentTargets)) {
    for (const url of urlList(value(row, target as BusinessGrantTarget))) {
      documents.push({ ...metadata, external_url: url, file_name: null });
    }
  }
  for (const [index, url] of urlList(value(row, "supporting_documents")).entries()) {
    documents.push({
      label: `Supporting document ${index + 1}`,
      document_type: null,
      external_url: url,
      file_name: null,
    });
  }

  return {
    errors: [],
    data: {
      externalSubmissionId,
      submittedAt,
      applicantName: validApplicantName,
      applicantEmail: text(value(row, "applicant_email")),
      detail,
      documents,
    },
  };
}
