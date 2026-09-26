-- Phase D read-only production inventory.
-- Run only through an authorized, read-only connection against the intended target.
-- This script contains SELECT statements only. Save results with target/date/operator.
begin transaction read only;

-- Server and migration visibility (migration schema may not be exposed to every operator).
select current_database() as database_name, current_user as database_user, now() as observed_at;
select * from supabase_migrations.schema_migrations order by version;

-- Live public/storage RLS policies relevant to reviews and access.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in (
  'applicants', 'reviews', 'applicant_notes', 'contact_logs',
  'reviewer_discussion_documents', 'portal_applications',
  'reviewer_assignments', 'rubric_criteria', 'program_reviews',
  'review_scores', 'user_program_access'
)) or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Scholarship duplicate identities and row-level evidence. No survivor is selected.
with duplicate_pairs as (
  select applicant_id, reviewer_id, count(*) as row_count
  from public.reviews
  group by applicant_id, reviewer_id
  having count(*) > 1
)
select d.applicant_id, d.reviewer_id, d.row_count,
       r.id as review_id, r.is_complete, r.writing_score, r.rhetoric_score,
       coalesce(r.writing_score, 0) + coalesce(r.rhetoric_score, 0) as subtotal,
       r.created_at, r.submitted_at
from duplicate_pairs d
join public.reviews r
  on r.applicant_id = d.applicant_id
 and r.reviewer_id is not distinct from d.reviewer_id
order by d.applicant_id, d.reviewer_id nulls first, r.created_at, r.id;

-- Duplicate impact on the current completed-row count and completed sum.
with duplicated_applicants as (
  select distinct applicant_id
  from public.reviews
  group by applicant_id, reviewer_id
  having count(*) > 1
)
select a.id as applicant_id, a.total_score as stored_total,
       count(*) filter (where r.is_complete) as completed_rows,
       coalesce(sum(coalesce(r.writing_score, 0) + coalesce(r.rhetoric_score, 0))
         filter (where r.is_complete), 0) as trigger_equivalent_total
from duplicated_applicants d
join public.applicants a on a.id = d.applicant_id
left join public.reviews r on r.applicant_id = a.id
group by a.id, a.total_score
order by a.id;

-- Scholarship applicant/application linkage.
select
  count(*) as applicants,
  count(*) filter (where a.application_id is null) as missing_application_link,
  count(*) filter (where pa.id is null and a.application_id is not null) as broken_application_link,
  count(*) filter (where p.slug is distinct from 'scholarship' and a.application_id is not null) as wrong_program_link
from public.applicants a
left join public.portal_applications pa on pa.id = a.application_id
left join public.programs p on p.id = pa.program_id;

-- Scholarship assignment target discrepancies (five remains the current rule).
select a.id as applicant_id, a.preliminary_screening_status,
       count(distinct ra.id) as assignment_count,
       count(distinct r.id) filter (where r.is_complete) as completed_review_rows
from public.applicants a
left join public.reviewer_assignments ra on ra.application_id = a.application_id
left join public.reviews r on r.applicant_id = a.id
group by a.id, a.preliminary_screening_status
having count(distinct ra.id) <> 5 or count(distinct r.id) filter (where r.is_complete) > 5
order by a.id;

-- Grant review/assignment mismatches.
select pr.id as review_id, pr.assignment_id, pr.application_id, pr.program_id, pr.reviewer_id,
       ra.application_id as assigned_application_id,
       ra.program_id as assigned_program_id,
       ra.reviewer_id as assigned_reviewer_id
from public.program_reviews pr
left join public.reviewer_assignments ra on ra.id = pr.assignment_id
where ra.id is null
   or (pr.application_id, pr.program_id, pr.reviewer_id)
      is distinct from (ra.application_id, ra.program_id, ra.reviewer_id)
order by pr.id;

-- Orphan or cross-program review score evidence.
select rs.id as score_id, rs.review_id, rs.criterion_id,
       pr.program_id as review_program_id, rc.program_id as criterion_program_id
from public.review_scores rs
left join public.program_reviews pr on pr.id = rs.review_id
left join public.rubric_criteria rc on rc.id = rs.criterion_id
where pr.id is null or rc.id is null or pr.program_id is distinct from rc.program_id
order by rs.id;

-- Current Grant rubric.
select rc.id, rc.name, rc.description, rc.maximum_points, rc.display_order,
       rc.active, rc.created_at, rc.updated_at
from public.rubric_criteria rc
join public.programs p on p.id = rc.program_id
where p.slug = 'business_growth_grant'
order by rc.active desc, rc.display_order, rc.name, rc.id;

-- Program memberships.
select p.slug, upa.access_role, count(*) as member_count
from public.user_program_access upa
join public.programs p on p.id = upa.program_id
group by p.slug, upa.access_role
order by p.slug, upa.access_role;

-- Current lifecycle counts by program.
select p.slug, pr.status, count(*) as review_count
from public.program_reviews pr
join public.programs p on p.id = pr.program_id
group by p.slug, pr.status
order by p.slug, pr.status;

select r.is_complete, count(*) as scholarship_review_count
from public.reviews r
group by r.is_complete
order by r.is_complete;

rollback;
