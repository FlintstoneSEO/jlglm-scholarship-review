begin;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'programs', 'user_program_access', 'portal_applications',
    'business_grant_application_details', 'application_documents',
    'reviewer_assignments', 'rubric_criteria', 'program_reviews',
    'review_scores', 'import_batches', 'import_rows'
  ] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relname = table_name and c.relrowsecurity
    ) then raise exception 'RLS is not enabled on public.%', table_name;
    end if;
  end loop;
end $$;

do $$
begin
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('portal_applications', 'business_grant_application_details', 'program_reviews', 'review_scores')
      and (trim(coalesce(qual, '')) = 'true' or trim(coalesce(with_check, '')) = 'true')
  ) then raise exception 'A sensitive table has an unconditional RLS policy';
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.applicants where application_id is null) then
    raise exception 'A scholarship applicant was not linked to portal_applications';
  end if;
  if exists (
    select 1 from public.reviewer_assignments ra
    join public.portal_applications pa on pa.id = ra.application_id
    where ra.program_id <> pa.program_id
  ) then raise exception 'A reviewer assignment crosses programs';
  end if;
  if exists (
    select 1 from public.business_grant_application_details bg
    join public.portal_applications pa on pa.id = bg.application_id
    join public.programs p on p.id = pa.program_id
    where p.slug <> 'business_growth_grant'
  ) then raise exception 'Business grant details are attached to another program';
  end if;
  if exists (
    select 1 from public.rubric_criteria rc join public.programs p on p.id = rc.program_id
    where p.slug = 'business_growth_grant'
  ) then raise exception 'Business rubric criteria must be committee-configured, not migration-seeded';
  end if;
end $$;

rollback;
