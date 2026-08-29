import type { Json } from "@/integrations/supabase/types";

export type BusinessGrantImportRow = {
  externalSubmissionId: string;
  submittedAt: string | null;
  applicantName: string;
  applicantEmail: string | null;
  detail: {
    contact_name: string | null;
    contact_phone: string | null;
    business_name: string;
    legal_business_name: string | null;
    business_structure: string | null;
    year_established: number | null;
    business_address: string | null;
    website: string | null;
    business_description: string | null;
    products_services: string | null;
    owner_background: string | null;
    employee_count: number | null;
    annual_revenue_range: string | null;
    amount_requested: number | null;
    business_need: string | null;
    proposed_use_of_funds: string | null;
    use_of_funds_breakdown: string | null;
    community_impact: string | null;
    jobs_impact: string | null;
    eligibility_answers: Json;
    additional_information: string | null;
    raw_response: Json;
  };
  documents: { label: string; external_url: string; file_name: string | null }[];
};

const aliases: Record<string, string[]> = {
  externalSubmissionId: [
    "external_submission_id",
    "submission id",
    "response id",
    "form response id",
    "id",
  ],
  submittedAt: ["submission_date", "submitted at", "timestamp", "date submitted"],
  applicantName: ["applicant_name", "applicant name", "contact name", "name"],
  applicantEmail: ["applicant_email", "email", "email address"],
  contactPhone: ["contact_phone", "phone", "phone number"],
  businessName: ["business_name", "business name", "name of business"],
  legalBusinessName: ["legal_business_name", "legal business name"],
  businessStructure: ["business_structure", "business structure", "entity type"],
  yearEstablished: ["year_established", "year established", "year founded"],
  businessAddress: ["business_address", "business address"],
  website: ["website", "business website"],
  businessDescription: ["business_description", "business description", "describe your business"],
  productsServices: ["products_services", "products and services", "products/services"],
  ownerBackground: ["owner_background", "owner background", "entrepreneur background"],
  employeeCount: ["employee_count", "number of employees", "employees"],
  annualRevenueRange: ["annual_revenue_range", "annual revenue", "revenue range"],
  amountRequested: ["amount_requested", "grant amount requested", "amount requested"],
  businessNeed: ["business_need", "business need", "why do you need"],
  proposedUse: ["proposed_use_of_funds", "proposed use of funds", "use of grant funds"],
  useBreakdown: ["use_of_funds_breakdown", "funds breakdown", "budget"],
  communityImpact: ["community_impact", "community impact"],
  jobsImpact: ["jobs_impact", "jobs impact", "employment impact"],
  additionalInformation: ["additional_information", "additional information", "anything else"],
  supportingDocuments: [
    "supporting_documents",
    "supporting documents",
    "attachments",
    "upload documents",
  ],
};

export const businessGrantSourceTargets = [
  "external_submission_id", "submitted_at", "applicant_name", "applicant_email", "contact_phone",
  "business_name", "legal_business_name", "business_structure", "year_established", "business_address",
  "website", "business_description", "products_services", "owner_background", "employee_count",
  "annual_revenue_range", "amount_requested", "business_need", "proposed_use_of_funds",
  "use_of_funds_breakdown", "community_impact", "jobs_impact", "additional_information", "supporting_documents",
] as const;

const targetAliases: Record<(typeof businessGrantSourceTargets)[number], string[]> = {
  external_submission_id: aliases.externalSubmissionId,
  submitted_at: aliases.submittedAt,
  applicant_name: aliases.applicantName,
  applicant_email: aliases.applicantEmail,
  contact_phone: aliases.contactPhone,
  business_name: aliases.businessName,
  legal_business_name: aliases.legalBusinessName,
  business_structure: aliases.businessStructure,
  year_established: aliases.yearEstablished,
  business_address: aliases.businessAddress,
  website: aliases.website,
  business_description: aliases.businessDescription,
  products_services: aliases.productsServices,
  owner_background: aliases.ownerBackground,
  employee_count: aliases.employeeCount,
  annual_revenue_range: aliases.annualRevenueRange,
  amount_requested: aliases.amountRequested,
  business_need: aliases.businessNeed,
  proposed_use_of_funds: aliases.proposedUse,
  use_of_funds_breakdown: aliases.useBreakdown,
  community_impact: aliases.communityImpact,
  jobs_impact: aliases.jobsImpact,
  additional_information: aliases.additionalInformation,
  supporting_documents: aliases.supportingDocuments,
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function suggestBusinessGrantMappings(headers: string[]) {
  const used = new Set<string>();
  return businessGrantSourceTargets.flatMap((targetField) => {
    const candidate = headers.find(
      (header) => !used.has(header) && targetAliases[targetField].some((alias) => normalize(alias) === normalize(header)),
    );
    if (!candidate) return [];
    used.add(candidate);
    return [{ sourceColumn: candidate, targetField }];
  });
}

function value(row: Record<string, unknown>, field: keyof typeof aliases): unknown {
  const normalized = new Map(Object.keys(row).map((key) => [normalize(key), key]));
  for (const alias of aliases[field]) {
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

export function mapBusinessGrantRow(row: Record<string, unknown>): {
  data?: BusinessGrantImportRow;
  errors: string[];
} {
  const externalSubmissionId = text(value(row, "externalSubmissionId"));
  const applicantName = text(value(row, "applicantName"));
  const businessName = text(value(row, "businessName"));
  const errors = [
    !externalSubmissionId && "Missing stable external submission ID",
    !applicantName && "Missing applicant/contact name",
    !businessName && "Missing business name",
  ].filter(Boolean) as string[];
  if (errors.length) return { errors };
  const documentValue = text(value(row, "supportingDocuments"));
  const documents = (
    documentValue
      ?.split(/[,\n]/)
      .map((url) => url.trim())
      .filter((url) => /^https?:\/\//i.test(url)) ?? []
  ).map((url, index) => ({
    label: `Supporting document ${index + 1}`,
    external_url: url,
    file_name: null,
  }));
  return {
    errors: [],
    data: {
      externalSubmissionId: externalSubmissionId!,
      submittedAt: timestamp(value(row, "submittedAt")),
      applicantName: applicantName!,
      applicantEmail: text(value(row, "applicantEmail")),
      detail: {
        contact_name: applicantName,
        contact_phone: text(value(row, "contactPhone")),
        business_name: businessName!,
        legal_business_name: text(value(row, "legalBusinessName")),
        business_structure: text(value(row, "businessStructure")),
        year_established: numberValue(value(row, "yearEstablished")),
        business_address: text(value(row, "businessAddress")),
        website: text(value(row, "website")),
        business_description: text(value(row, "businessDescription")),
        products_services: text(value(row, "productsServices")),
        owner_background: text(value(row, "ownerBackground")),
        employee_count: numberValue(value(row, "employeeCount")),
        annual_revenue_range: text(value(row, "annualRevenueRange")),
        amount_requested: numberValue(value(row, "amountRequested")),
        business_need: text(value(row, "businessNeed")),
        proposed_use_of_funds: text(value(row, "proposedUse")),
        use_of_funds_breakdown: text(value(row, "useBreakdown")),
        community_impact: text(value(row, "communityImpact")),
        jobs_impact: text(value(row, "jobsImpact")),
        eligibility_answers: {},
        additional_information: text(value(row, "additionalInformation")),
        raw_response: row as Json,
      },
      documents,
    },
  };
}
