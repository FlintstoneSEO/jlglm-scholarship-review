-- Run after 20260928190000_admin_review_reset_and_access_safety.sql.
-- All users, applications, reviews, and audit assertions are rolled back.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) values
  ('fa000001-0000-4000-8000-000000000001','authenticated','authenticated','reset-global@example.invalid','test',now()),
  ('fa000001-0000-4000-8000-000000000002','authenticated','authenticated','reset-grant-admin@example.invalid','test',now()),
  ('fa000001-0000-4000-8000-000000000003','authenticated','authenticated','reset-scholar-admin@example.invalid','test',now()),
  ('fa000001-0000-4000-8000-000000000004','authenticated','authenticated','reset-reviewer@example.invalid','test',now()),
  ('fa000001-0000-4000-8000-000000000005','authenticated','authenticated','reset-viewer@example.invalid','test',now());

insert into public.user_roles(user_id,role) values
  ('fa000001-0000-4000-8000-000000000001','admin'),
  ('fa000001-0000-4000-8000-000000000004','reviewer') on conflict do nothing;

insert into public.user_program_access(user_id,program_id,access_role) values
  ('fa000001-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','admin'),
  ('fa000001-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','admin'),
  ('fa000001-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','reviewer'),
  ('fa000001-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111','reviewer'),
  ('fa000001-0000-4000-8000-000000000005','22222222-2222-4222-8222-222222222222','viewer');

insert into public.portal_applications(id,program_id,applicant_name,external_submission_id) values
  ('fa000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Reset Business Draft','test-reset-draft'),
  ('fa000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Reset Business Submitted','test-reset-submitted');
insert into public.reviewer_assignments(id,application_id,program_id,reviewer_id) values
  ('fa000003-0000-4000-8000-000000000001','fa000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004'),
  ('fa000003-0000-4000-8000-000000000002','fa000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004');

-- The normal Grant scoring gate applies to fixtures too. Verify all six requirements.
set local role authenticated;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000002',true);
do $$ declare application uuid; requirement text; begin
  foreach application in array array[
    'fa000002-0000-4000-8000-000000000001'::uuid,
    'fa000002-0000-4000-8000-000000000002'::uuid
  ] loop
    foreach requirement in array array[
      'owner_eligibility','business_eligibility','lara_good_standing',
      'required_documentation','profit_loss_2024','profit_loss_2025'
    ] loop
      perform public.set_grant_requirement(application,requirement,'verified','Rollback fixture verification');
    end loop;
    perform public.confirm_grant_eligibility(application,'eligible','Rollback fixture approval');
  end loop;
end $$;
reset role;

insert into public.rubric_versions(id,program_id,version,name,active)
values ('fa000004-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222',999999,'Reset fixture',false);
insert into public.rubric_criteria(id,program_id,rubric_version_id,name,maximum_points)
values ('fa000005-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fa000004-0000-4000-8000-000000000001','Reset criterion',10);
insert into public.program_reviews(id,assignment_id,application_id,program_id,reviewer_id,status,reviewer_comments,rubric_version_id) values
  ('fa000006-0000-4000-8000-000000000001','fa000003-0000-4000-8000-000000000001','fa000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004','in_progress','Draft test text','fa000004-0000-4000-8000-000000000001'),
  ('fa000006-0000-4000-8000-000000000002','fa000003-0000-4000-8000-000000000002','fa000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004','completed','Submitted test text','fa000004-0000-4000-8000-000000000001');
insert into public.review_scores(review_id,criterion_id,points) values
  ('fa000006-0000-4000-8000-000000000001','fa000005-0000-4000-8000-000000000001',3),
  ('fa000006-0000-4000-8000-000000000002','fa000005-0000-4000-8000-000000000001',8);
insert into public.grant_review_certifications(program_review_id,program_id,reviewer_id,review_version,certification_version)
values ('fa000006-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004',1,'test-fixture');
insert into public.review_lifecycle_events(program_id,program_review_id,actor_id,event_type,new_status,request_key) values
  ('22222222-2222-4222-8222-222222222222','fa000006-0000-4000-8000-000000000001','fa000001-0000-4000-8000-000000000004','draft_saved','in_progress','resetdraft01'),
  ('22222222-2222-4222-8222-222222222222','fa000006-0000-4000-8000-000000000002','fa000001-0000-4000-8000-000000000004','submitted','completed','resetsubmit01');
insert into public.review_idempotency_keys(actor_id,program_id,application_id,intent,idempotency_key,request_hash) values
  ('fa000001-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','fa000002-0000-4000-8000-000000000001','save_draft','resetdraft01','test'),
  ('fa000001-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','fa000002-0000-4000-8000-000000000002','submit','resetsubmit01','test');

-- Unauthorized callers cannot create an audit event or alter operational rows.
set local role authenticated;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000004',true);
do $$ begin
  begin
    perform public.admin_reset_review('fa000006-0000-4000-8000-000000000001');
    raise exception 'Reviewer reset was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000005',true);
do $$ begin
  begin
    perform public.admin_reset_review('fa000006-0000-4000-8000-000000000001');
    raise exception 'Viewer reset was allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000003',true);
do $$ begin
  begin
    perform public.admin_reset_review('fa000006-0000-4000-8000-000000000001');
    raise exception 'Other-program admin reset was allowed';
  exception when insufficient_privilege then null; end;
end $$;

-- Program admin sees only their program and cannot change global roles.
do $$ begin
  if exists (select 1 from public.admin_list_user_access() where program_id <> '11111111-1111-4111-8111-111111111111') then
    raise exception 'Program admin saw another program'; end if;
  begin
    perform public.admin_set_global_role('fa000001-0000-4000-8000-000000000005','admin');
    raise exception 'Program admin escalated global role';
  exception when insufficient_privilege then null; end;
end $$;
do $$ declare affected integer; begin
  update public.user_program_access set access_role = 'admin'
    where user_id = 'fa000001-0000-4000-8000-000000000004'
      and program_id = '22222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Program admin changed unrelated program access'; end if;
end $$;

reset role;
do $$ begin
  if not exists (select 1 from public.program_reviews where id = 'fa000006-0000-4000-8000-000000000001')
    or exists (select 1 from public.admin_review_reset_events where review_id = 'fa000006-0000-4000-8000-000000000001') then
    raise exception 'Unauthorized reset changed data'; end if;
  if has_table_privilege('authenticated','public.program_reviews','DELETE')
    or has_table_privilege('authenticated','public.reviews','DELETE')
    or has_table_privilege('authenticated','public.review_scores','DELETE') then
    raise exception 'Direct review deletion is still granted'; end if;
  if not exists (select 1 from pg_trigger where tgrelid = 'public.user_roles'::regclass
      and tgname = 'protect_last_global_admin' and not tgisinternal) then
    raise exception 'Last-admin protection trigger is missing'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform public.admin_reset_review('fa000006-0000-4000-8000-000000000001','invalid_reason');
    raise exception 'Invalid reset reason was accepted';
  exception when invalid_parameter_value then null; end;
end $$;
select public.admin_reset_review('fa000006-0000-4000-8000-000000000001');
select public.admin_reset_review('fa000006-0000-4000-8000-000000000002');

reset role;
do $$ begin
  if exists (select 1 from public.program_reviews where id in ('fa000006-0000-4000-8000-000000000001','fa000006-0000-4000-8000-000000000002'))
    or exists (select 1 from public.review_scores where review_id in ('fa000006-0000-4000-8000-000000000001','fa000006-0000-4000-8000-000000000002'))
    or exists (select 1 from public.grant_review_certifications where program_review_id = 'fa000006-0000-4000-8000-000000000002')
    or exists (select 1 from public.review_lifecycle_events where program_review_id in ('fa000006-0000-4000-8000-000000000001','fa000006-0000-4000-8000-000000000002'))
    or exists (select 1 from public.review_idempotency_keys where idempotency_key in ('resetdraft01','resetsubmit01')) then
    raise exception 'Grant reset left operational activity'; end if;
  if (select count(*) from public.reviewer_assignments where id in ('fa000003-0000-4000-8000-000000000001','fa000003-0000-4000-8000-000000000002') and lifecycle = 'active') <> 2
    or (select count(*) from public.portal_applications where id in ('fa000002-0000-4000-8000-000000000001','fa000002-0000-4000-8000-000000000002') and review_status = 'not_started' and completed_review_count = 0 and average_score = 0) <> 2
    or (select count(*) from public.admin_review_reset_events where review_id in ('fa000006-0000-4000-8000-000000000001','fa000006-0000-4000-8000-000000000002') and reason = 'test_data') <> 2 then
    raise exception 'Grant reset lost identity, audit, or projection'; end if;
end $$;

-- A fresh review can occupy the preserved assignment and identity again.
insert into public.program_reviews(id,assignment_id,application_id,program_id,reviewer_id,status,rubric_version_id)
values ('fa000006-0000-4000-8000-000000000003','fa000003-0000-4000-8000-000000000001','fa000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','fa000001-0000-4000-8000-000000000004','in_progress','fa000004-0000-4000-8000-000000000001');

insert into public.applicants(id,first_name,last_name,preliminary_screening_status) values
  ('fa000007-0000-4000-8000-000000000001','Reset','Scholar Draft','eligible_for_review'),
  ('fa000007-0000-4000-8000-000000000002','Reset','Scholar Submitted','eligible_for_review');
insert into public.reviews(id,applicant_id,reviewer_id,reviewer_name,writing_score,rhetoric_score,is_complete,reviewer_notes,canonical_identity) values
  ('fa000008-0000-4000-8000-000000000001','fa000007-0000-4000-8000-000000000001','fa000001-0000-4000-8000-000000000004','Reset Reviewer',3,2,false,'Draft text',true),
  ('fa000008-0000-4000-8000-000000000002','fa000007-0000-4000-8000-000000000002','fa000001-0000-4000-8000-000000000004','Reset Reviewer',8,7,true,'Submitted text',true);
insert into public.review_lifecycle_events(program_id,scholarship_review_id,actor_id,event_type,new_status,request_key) values
  ('11111111-1111-4111-8111-111111111111','fa000008-0000-4000-8000-000000000001','fa000001-0000-4000-8000-000000000004','draft_saved','in_progress','schdraft01'),
  ('11111111-1111-4111-8111-111111111111','fa000008-0000-4000-8000-000000000002','fa000001-0000-4000-8000-000000000004','submitted','submitted','schsubmit01');
insert into public.review_idempotency_keys(actor_id,program_id,application_id,intent,idempotency_key,request_hash)
select 'fa000001-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111',a.application_id,
  case when a.id = 'fa000007-0000-4000-8000-000000000001' then 'save_draft' else 'submit' end,
  case when a.id = 'fa000007-0000-4000-8000-000000000001' then 'schdraft01' else 'schsubmit01' end,'test'
from public.applicants a where a.id in ('fa000007-0000-4000-8000-000000000001','fa000007-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000001',true);
do $$ begin
  if (select count(*) from public.admin_list_user_access()
      where user_id = 'fa000001-0000-4000-8000-000000000004') <> 2 then
    raise exception 'Global admin cannot see both programs for the reviewer'; end if;
end $$;
insert into public.user_program_access(user_id,program_id,access_role)
values ('fa000001-0000-4000-8000-000000000005','11111111-1111-4111-8111-111111111111','viewer');
delete from public.user_program_access
where user_id = 'fa000001-0000-4000-8000-000000000005'
  and program_id = '11111111-1111-4111-8111-111111111111';
do $$ begin
  if (select count(*) from public.user_program_access where user_id = 'fa000001-0000-4000-8000-000000000005') <> 1
    or not exists (select 1 from public.user_program_access where user_id = 'fa000001-0000-4000-8000-000000000005'
      and program_id = '22222222-2222-4222-8222-222222222222') then
    raise exception 'Changing one program changed another'; end if;
end $$;
select public.admin_reset_review('fa000008-0000-4000-8000-000000000001');
select set_config('request.jwt.claim.sub','fa000001-0000-4000-8000-000000000003',true);
select public.admin_reset_review('fa000008-0000-4000-8000-000000000002');
reset role;

do $$ begin
  if exists (select 1 from public.reviews where id in ('fa000008-0000-4000-8000-000000000001','fa000008-0000-4000-8000-000000000002'))
    or exists (select 1 from public.review_lifecycle_events where scholarship_review_id in ('fa000008-0000-4000-8000-000000000001','fa000008-0000-4000-8000-000000000002'))
    or exists (select 1 from public.review_idempotency_keys where idempotency_key in ('schdraft01','schsubmit01')) then
    raise exception 'Scholarship reset left review activity'; end if;
  if (select count(*) from public.applicants where id in ('fa000007-0000-4000-8000-000000000001','fa000007-0000-4000-8000-000000000002') and review_status = 'not_started' and total_score = 0) <> 2
    or (select count(*) from public.admin_review_reset_events where review_type = 'scholarship' and review_id in ('fa000008-0000-4000-8000-000000000001','fa000008-0000-4000-8000-000000000002')) <> 2 then
    raise exception 'Scholarship reset lost applicants, projection, or audit'; end if;
end $$;

-- New canonical review can be recorded for the preserved applicant/reviewer pair.
insert into public.reviews(id,applicant_id,reviewer_id,reviewer_name,canonical_identity)
values ('fa000008-0000-4000-8000-000000000003','fa000007-0000-4000-8000-000000000001','fa000001-0000-4000-8000-000000000004','Reset Reviewer',true);

rollback;
