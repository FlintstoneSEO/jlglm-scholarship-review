begin;

-- Run after migrations on a disposable/production-like database. These assertions do not
-- fabricate live inventory results and intentionally roll back.
do $$
declare table_name text;
begin
  foreach table_name in array array['rubric_versions','review_lifecycle_events','review_idempotency_keys'] loop
    if not exists (
      select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=table_name and c.relrowsecurity
    ) then raise exception 'Phase D RLS missing on public.%',table_name; end if;
  end loop;
end $$;

do $$ begin
  if has_table_privilege('authenticated','public.reviews','INSERT')
     or has_table_privilege('authenticated','public.reviews','UPDATE')
     or has_table_privilege('authenticated','public.reviews','DELETE')
     or has_table_privilege('authenticated','public.program_reviews','INSERT')
     or has_table_privilege('authenticated','public.program_reviews','UPDATE')
     or has_table_privilege('authenticated','public.review_scores','INSERT')
     or has_table_privilege('authenticated','public.review_scores','UPDATE') then
    raise exception 'Direct review writes bypass the canonical Phase D functions';
  end if;
  if not has_function_privilege('authenticated','public.submit_scholarship_review(uuid,uuid,uuid,integer,integer,integer,text,public.recommendation,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','public.submit_business_grant_review(uuid,uuid,uuid,integer,uuid,jsonb,text,text,text,text,boolean)','EXECUTE')
     or not has_function_privilege('authenticated','public.reopen_review(text,uuid)','EXECUTE') then
    raise exception 'Authenticated Phase D RPC grants are incomplete';
  end if;
end $$;

do $$ begin
  if exists (
    select 1 from public.reviews r join public.applicants a on a.id=r.applicant_id
    where extract(year from coalesce(a.submission_date,a.created_at)) <= 2026 and r.canonical_identity
  ) then raise exception 'Historical Scholarship rows were incorrectly made canonical'; end if;
  if exists (
    select applicant_id,reviewer_id from public.reviews where canonical_identity and reviewer_id is not null
    group by applicant_id,reviewer_id having count(*) > 1
  ) then raise exception 'Canonical Scholarship identities are duplicated'; end if;
  if exists (
    select 1 from public.program_reviews pr join public.rubric_criteria rc on rc.program_id=pr.program_id
    where pr.rubric_version_id is not null and rc.rubric_version_id=pr.rubric_version_id
      and rc.program_id<>pr.program_id
  ) then raise exception 'A review is bound to a cross-program rubric'; end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='reviews_future_canonical_identity_key')
     or not exists (select 1 from pg_indexes where schemaname='public' and indexname='rubric_versions_one_active_per_program') then
    raise exception 'Phase D uniqueness indexes are missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reviews' and policyname='reviews_select_phase_d') then
    raise exception 'Scholarship peer-review policy is missing';
  end if;
end $$;

rollback;
