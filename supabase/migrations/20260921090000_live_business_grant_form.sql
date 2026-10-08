begin;

alter table public.business_grant_application_details
  add column if not exists applicant_first_name text,
  add column if not exists applicant_middle_name text,
  add column if not exists applicant_last_name text,
  add column if not exists descendant_eligibility text,
  add column if not exists business_operating_model text,
  add column if not exists business_age_range text,
  add column if not exists lara_status text,
  add column if not exists lara_explanation text,
  add column if not exists financial_performance_change text,
  add column if not exists financing_applied text,
  add column if not exists financing_details text,
  add column if not exists financial_management_resources text,
  add column if not exists growth_opportunity text,
  add column if not exists expected_impact_categories text,
  add column if not exists measurable_impact text,
  add column if not exists success_metrics text,
  add column if not exists owner_involvement text,
  add column if not exists customer_volume text,
  add column if not exists why_grant_now text;

-- Safely normalize previously imported live-form rows without replacing values
-- already curated in the portal. The complete source row remains in raw_response.
update public.business_grant_application_details
set
  applicant_first_name = coalesce(applicant_first_name, nullif(trim(raw_response ->> 'Applicant First Name'), '')),
  applicant_middle_name = coalesce(applicant_middle_name, nullif(trim(raw_response ->> 'Applicant Middle Name'), '')),
  applicant_last_name = coalesce(applicant_last_name, nullif(trim(raw_response ->> 'Applicant Last Name'), '')),
  descendant_eligibility = coalesce(descendant_eligibility, nullif(trim(raw_response ->> 'Do you identify as Black/Descendant of enslaved African Americans ?'), '')),
  business_operating_model = coalesce(business_operating_model, nullif(trim(raw_response ->> 'Where does your business primarily operate?'), '')),
  business_age_range = coalesce(business_age_range, nullif(trim(raw_response ->> 'How long has your business been operating?'), '')),
  lara_status = coalesce(lara_status, nullif(trim(raw_response ->> 'Is your business currently registered and in good standing with the Michigan Department of Licensing and Regulatory Affairs (LARA)?'), '')),
  lara_explanation = coalesce(lara_explanation, nullif(trim(raw_response ->> 'You answered No or Unsure regarding LARA status, please explain.'), '')),
  financial_performance_change = coalesce(financial_performance_change, nullif(trim(raw_response ->> 'What were the most significant changes in your business''s financial performance between 2024 and 2025?'), '')),
  financing_applied = coalesce(financing_applied, nullif(trim(raw_response ->> 'In the past 12 months, have you applied for business financing from a bank, credit union, or other financial institution?'), '')),
  financing_details = coalesce(financing_details, nullif(trim(raw_response ->> 'If you were denied or received less than requested, briefly describe the circumstances and amount requested.'), '')),
  financial_management_resources = coalesce(financial_management_resources, nullif(trim(raw_response ->> 'Which financial management resources does your business currently use? Select all that apply.'), '')),
  growth_opportunity = coalesce(growth_opportunity, nullif(trim(raw_response ->> 'What specific growth opportunity would this 11,250 dollar grant allow your business to pursue?'), '')),
  proposed_use_of_funds = coalesce(proposed_use_of_funds, nullif(trim(raw_response ->> 'Provide a specific plan for how you would use the 11,250 dollar grant.'), '')),
  expected_impact_categories = coalesce(expected_impact_categories, nullif(trim(raw_response ->> 'How will the grant investment change or improve your business within 12 months of receiving the funds? Select all that apply and describe the expected impact:'), '')),
  measurable_impact = coalesce(measurable_impact, nullif(trim(raw_response ->> 'Provide details on your expected business impact, including specific measurable outcomes'), '')),
  success_metrics = coalesce(success_metrics, nullif(trim(raw_response ->> 'What are the 1 to 3 most important business outcomes you expect to achieve within 12 months, and how will you measure success?'), '')),
  owner_involvement = coalesce(owner_involvement, nullif(trim(raw_response ->> 'Owner''s Involvement'), '')),
  customer_volume = coalesce(customer_volume, nullif(trim(raw_response ->> 'Approximately how many customers or clients did your business serve during 2025?'), '')),
  why_grant_now = coalesce(why_grant_now, nullif(trim(raw_response ->> 'Why This Grant, and Why Now?'), '')),
  updated_at = now()
where raw_response <> '{}'::jsonb;

update public.portal_applications pa
set applicant_name = trim(concat_ws(' ', details.applicant_first_name, nullif(details.applicant_middle_name, ''), details.applicant_last_name))
from public.business_grant_application_details details
where details.application_id = pa.id
  and details.applicant_first_name is not null
  and details.applicant_last_name is not null;

alter table public.application_documents
  add column if not exists document_type text;

alter table public.application_documents
  drop constraint if exists application_documents_document_type_check;

alter table public.application_documents
  add constraint application_documents_document_type_check check (
    document_type is null or document_type in ('lara_documentation', 'profit_loss_2024', 'profit_loss_2025')
  );

create unique index if not exists application_documents_application_type_key
  on public.application_documents(application_id, document_type)
  where document_type is not null;

comment on table public.business_grant_application_details is
  'Normalized Business Growth Grant responses. raw_response retains the complete source row for audit and schema-drift recovery.';
comment on column public.application_documents.document_type is
  'Stable form upload category; null is retained for legacy generic supporting documents.';

commit;
