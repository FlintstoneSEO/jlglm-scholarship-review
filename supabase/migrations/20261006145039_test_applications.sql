begin;

alter table public.portal_applications add column is_test boolean not null default false;
-- The session FK is deterministic evidence. Never infer from names or emails.
update public.portal_applications set is_test=true where practice_session_id is not null;
alter table public.portal_applications add constraint test_has_no_import_source
 check (not is_test or (data_source_id is null and source_record_key is null));
create index portal_application_test_scope on public.portal_applications(program_id,is_test);

create function private.guard_test_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' and new.practice_session_id is not null then new.is_test:=true; end if;
 if tg_op='INSERT' and exists(select 1 from public.portal_applications a where a.program_id=new.program_id
 and a.external_submission_id=new.external_submission_id and a.is_test) then
 raise exception 'Imports cannot overwrite a test application'; end if;
 if tg_op='UPDATE' and (new.is_test is distinct from old.is_test
 or (old.is_test and (new.external_submission_id is distinct from old.external_submission_id
 or new.program_id is distinct from old.program_id))) then
 raise exception 'Application test identity is immutable'; end if;
 if new.is_test and (new.data_source_id is not null or new.source_record_key is not null) then
 raise exception 'Test applications cannot belong to an import source'; end if;
 return new;
end $$;
create trigger test_identity before insert or update on public.portal_applications
 for each row execute function private.guard_test_identity();
revoke all on function private.guard_test_identity() from public,anon,authenticated;

-- Read scopes preserve RLS, including assigned-reviewer and program boundaries.
create view public.production_applications with (security_invoker=true) as
 select * from public.portal_applications where not is_test;
create view public.production_applicants with (security_invoker=true) as
 select a.* from public.applicants a join public.portal_applications p on p.id=a.application_id where not p.is_test;
create view public.production_scholarship_reviews with (security_invoker=true) as
 select r.* from public.reviews r join public.production_applicants a on a.id=r.applicant_id;
revoke all on public.production_applications,public.production_applicants,public.production_scholarship_reviews from public,anon,authenticated;
grant select on public.production_applications,public.production_applicants,public.production_scholarship_reviews to authenticated;

create or replace view public.program_rankings with (security_invoker=true) as
select dense_rank() over(partition by a.program_id order by a.average_score desc,a.submitted_at asc nulls last,a.id) as rank,
 a.id as application_id,a.program_id,coalesce(d.business_name,a.applicant_name) as display_name,
 a.applicant_name,a.completed_review_count,a.average_score,a.review_status
from public.portal_applications a left join public.business_grant_application_details d on d.application_id=a.id
where not a.is_test and private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]);

-- Production random allocation excludes every test, including independent tests.
create or replace function private.grant_committee_snapshot(p_program uuid,p_session uuid)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'name',a.applicant_name,'eligibility',coalesce(e.status::text,'not_reviewed'),'eligibilityUpdated',e.updated_at,
 'exclusion',case
 when exists(select 1 from public.reviewer_assignments r where r.application_id=a.id) then 'Existing assignment (active or suspended)'
 when exists(select 1 from public.program_reviews r where r.application_id=a.id)
 or exists(select 1 from public.admin_review_reset_events r where r.application_id=a.id)
 or exists(select 1 from public.review_idempotency_keys r where r.application_id=a.id) then 'Existing review activity or history'
 when coalesce(e.status::text,'not_reviewed')<>'eligible' then 'Eligibility not confirmed Eligible'
 else null end) order by a.id),'[]'::jsonb)
 from public.portal_applications a left join public.application_eligibility_reviews e on e.application_id=a.id
 where a.program_id=p_program and a.practice_session_id is not distinct from p_session
 and (p_session is not null or not a.is_test)
 and (p_session is null or private.grant_practice_current(a.id));
$$;

-- Independent operation log survives deletion; never retains applicant content.
create table public.test_application_events (
 id uuid primary key default gen_random_uuid(), application_id uuid not null,
 program_id uuid not null references public.programs(id), actor_id uuid not null references auth.users(id),
 action text not null check(action in ('created','reset','deleted')), occurred_at timestamptz not null default now()
);
alter table public.test_application_events enable row level security;
revoke all on public.test_application_events from public,anon,authenticated;
grant select on public.test_application_events to authenticated;
create policy test_event_admin_read on public.test_application_events for select to authenticated
 using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));

create function public.create_test_application(p_program uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare aid uuid; legacy_id uuid; slug text;
begin
 if auth.uid() is null or not private.current_user_has_program_role(p_program,array['admin']::public.program_access_role[]) then
 raise exception 'Program administrator access required' using errcode='42501'; end if;
 select p.slug into slug from public.programs p where p.id=p_program and p.active;
 if not found then raise exception 'Select an active program'; end if;
 insert into public.portal_applications(program_id,is_test,external_submission_id,applicant_name,applicant_email,submitted_at,source_metadata)
 values(p_program,true,'portal-test:'||gen_random_uuid(),'TEST - Sample Applicant','sample@example.invalid',now(),'{"origin":"portal_fixture"}') returning id into aid;
 if slug='scholarship' then
 legacy_id:=gen_random_uuid();
 insert into public.applicants(id,application_id,first_name,last_name,email,graduation_high_school,college_attending,
 essay_url,transcript_url,is_18_or_older,applicant_signature_status,submission_date)
 values(legacy_id,aid,'TEST - Sample','Student','sample@example.invalid','Fictional Community High School','Fictional Community College',
 '/practice-document?kind=scholarship_essay&applicantId='||legacy_id,'/practice-document?kind=scholarship_transcript&applicantId='||legacy_id,true,true,'2027-01-15');
 elsif slug='business_growth_grant' then
 insert into public.business_grant_application_details(application_id,business_name,business_description,business_need,proposed_use_of_funds,community_impact,amount_requested,descendant_eligibility,eligibility_answers,lara_status)
 values(aid,'TEST - Sample Business','Fictional neighborhood service business; all information is invented for workflow testing.',
 'Replace equipment to serve more customers.','Purchase equipment and train staff.','Fictional goal: serve 20 additional customers monthly.',5000,
 'Fictional self-identification for human screening','{"sample":"Fictional business eligibility answers; inspect sample evidence"}','Fictional good-standing response');
 update public.business_grant_application_details set
 contact_name='Sample Applicant',products_services='Fictional equipment repair services',
 owner_background='Fictional owner with five years of service experience',employee_count=3,
 business_operating_model='Fictional storefront service business',business_age_range='3–5 years (fictional)',
 financial_performance_change='Fictional annual revenue increased from $90,000 to $100,000.',
 financial_management_resources='Fictional monthly bookkeeping and cash-flow reviews.',
 growth_opportunity='Add repair capacity and reduce customer waiting time.',
 measurable_impact='Fictional goal: 20 additional completed repairs each month.',
 success_metrics='Track monthly repairs, waiting time and repeat customers.',
 owner_involvement='Fictional owner works full time in day-to-day operations.',
 customer_volume='Fictional example: 40 customers each month.',
 why_grant_now='Fictional aging equipment limits capacity despite customer demand.',
 use_of_funds_breakdown='Fictional allocation: $4,000 equipment and $1,000 staff training.',
 annual_revenue_range='Fictional example: $100,000'
 where application_id=aid;
 insert into public.application_documents(application_id,label,document_type,external_url)
 select aid,'TEST - Sample '||kind,kind,'/practice-document?kind='||kind from unnest(array['lara_documentation','profit_loss_2024','profit_loss_2025']) kind;
 end if;
 insert into public.test_application_events(application_id,program_id,actor_id,action) values(aid,p_program,auth.uid(),'created');
 return jsonb_build_object('applicationId',aid,'applicantId',legacy_id,
 'applicantName',(select applicant_name from public.portal_applications where id=aid),
 'status','Pending screening','assignedReviewers',0);
end $$;

create function private.assert_test_admin(p_application uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.portal_applications%rowtype;
begin
 select * into a from public.portal_applications where id=p_application for update;
 if not found or not a.is_test or auth.uid() is null
 or not private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]) then
 raise exception 'An authorized test application is required' using errcode='42501'; end if;
 return a.program_id;
end $$;

-- One cleanup primitive, independent of review-engine implementation. Narrow parent scopes.
create function private.clear_test_reviews(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_test_admin(p_application);
 -- Remove test-only conflict holds before deleting their guarded review rows.
 delete from public.grant_conflict_resolutions where report_id in (select id from public.grant_conflict_reports where application_id=p_application);
 delete from public.grant_conflict_reports where application_id=p_application;
 delete from public.grant_review_certifications where program_review_id in (select id from public.program_reviews where application_id=p_application);
 delete from public.review_lifecycle_events where program_review_id in (select id from public.program_reviews where application_id=p_application)
 or scholarship_review_id in (select r.id from public.reviews r join public.applicants a on a.id=r.applicant_id where a.application_id=p_application);
 delete from public.review_idempotency_keys where application_id=p_application;
 -- Score FK cascades after parent deletion; avoids recomputing suspended reviews.
 delete from public.program_reviews where application_id=p_application;
 delete from public.reviews where applicant_id in (select id from public.applicants where application_id=p_application);
 delete from public.applicant_notes where applicant_id in (select id from public.applicants where application_id=p_application);
 -- Reset conflicts/clearance too, but preserve every assignment's lifecycle/history.
 delete from public.grant_conflict_declarations where assignment_id in (select id from public.reviewer_assignments where application_id=p_application);
 perform private.refresh_grant_totals(p_application);
end $$;
create function public.reset_test_application(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 pid:=private.assert_test_admin(p_application);
 perform private.clear_test_reviews(p_application);
 insert into public.test_application_events(application_id,program_id,actor_id,action) values(p_application,pid,auth.uid(),'reset');
end $$;

-- The real-application history guard remains intact. Test-only deletion is scoped.
create or replace function private.guard_assignment_deactivation() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
 if old.deactivated_at is not null and not exists(select 1 from public.portal_applications where id=old.application_id and is_test
 and private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[])) then
 raise exception 'Deactivated assignment history must be retained'; end if;
 return old;
 end if;
 if tg_op='UPDATE' and old.deactivated_at is not null and (
 new.deactivated_at is distinct from old.deactivated_at or new.deactivated_by is distinct from old.deactivated_by
 or new.lifecycle<>'suspended' or new.application_id is distinct from old.application_id
 or new.program_id is distinct from old.program_id or new.reviewer_id is distinct from old.reviewer_id) then
 raise exception 'An administratively deactivated assignment cannot be reactivated or have its history changed'; end if;
 if tg_op='INSERT' then
 if current_user in ('authenticated','anon') and new.deactivated_at is not null then
 raise exception 'Use the administrator deactivation action' using errcode='42501'; end if;
 return new;
 end if;
 if current_user in ('authenticated','anon') and (new.deactivated_at is distinct from old.deactivated_at
 or new.deactivated_by is distinct from old.deactivated_by) then
 raise exception 'Use the administrator deactivation action' using errcode='42501'; end if;
 return new;
end $$;

create function public.delete_test_application(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 pid:=private.assert_test_admin(p_application);
 -- External storage needs coordinated object cleanup, not a SQL-only cascade.
 if exists(select 1 from public.application_documents where application_id=p_application and storage_path is not null)
 or exists(select 1 from public.reviewer_discussion_documents d join public.applicants a on a.id=d.applicant_id where a.application_id=p_application) then
 raise exception 'Remove uploaded discussion/supporting files before deleting this test application'; end if;
 perform private.clear_test_reviews(p_application);
 delete from public.admin_review_reset_events where application_id=p_application;
 delete from public.reviewer_assignments where application_id=p_application;
 delete from public.contact_logs where applicant_id in (select id from public.applicants where application_id=p_application);
 delete from public.applicants where application_id=p_application;
 delete from public.portal_applications where id=p_application and is_test;
 insert into public.test_application_events(application_id,program_id,actor_id,action) values(p_application,pid,auth.uid(),'deleted');
end $$;
revoke all on function private.assert_test_admin(uuid),private.clear_test_reviews(uuid) from public,anon,authenticated;
revoke all on function public.create_test_application(uuid),public.reset_test_application(uuid),public.delete_test_application(uuid) from public,anon,authenticated;
grant execute on function public.create_test_application(uuid),public.reset_test_application(uuid),public.delete_test_application(uuid) to authenticated;
commit;
