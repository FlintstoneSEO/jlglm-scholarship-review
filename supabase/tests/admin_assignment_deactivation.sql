-- Run after 20261006020146_admin_assignment_deactivation.sql on an approved test DB.
-- Every fixture and mutation is rolled back.
begin;
do $$ begin
 if has_function_privilege('anon','public.admin_deactivate_assignment(uuid)','execute') then
  raise exception 'Anonymous callers can execute deactivation'; end if;
end $$;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('da000001-0000-4000-8000-000000000001','authenticated','authenticated','deactivate-admin@example.invalid','test',now()),
 ('da000001-0000-4000-8000-000000000002','authenticated','authenticated','deactivate-reviewer@example.invalid','test',now()),
 ('da000001-0000-4000-8000-000000000003','authenticated','authenticated','deactivate-other-admin@example.invalid','test',now()),
 ('da000001-0000-4000-8000-000000000004','authenticated','authenticated','deactivate-viewer@example.invalid','test',now());
insert into public.user_program_access(user_id,program_id,access_role) values
 ('da000001-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','admin'),
 ('da000001-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','admin'),
 ('da000001-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','reviewer'),
 ('da000001-0000-4000-8000-000000000002','11111111-1111-4111-8111-111111111111','reviewer'),
 ('da000001-0000-4000-8000-000000000003','11111111-1111-4111-8111-111111111111','admin'),
 ('da000001-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222','viewer');
insert into public.portal_applications(id,program_id,applicant_name,external_submission_id) values
 ('da000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','Reset-history fixture','deactivate-reset'),
 ('da000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','Conflict fixture','deactivate-conflict');
insert into public.reviewer_assignments(id,application_id,program_id,reviewer_id) values
 ('da000003-0000-4000-8000-000000000001','da000002-0000-4000-8000-000000000001','22222222-2222-4222-8222-222222222222','da000001-0000-4000-8000-000000000002'),
 ('da000003-0000-4000-8000-000000000002','da000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','da000001-0000-4000-8000-000000000002');
insert into public.admin_review_reset_events(program_id,application_id,assignment_id,reviewer_id,review_id,review_type,reset_by,reason) values
 ('22222222-2222-4222-8222-222222222222','da000002-0000-4000-8000-000000000001','da000003-0000-4000-8000-000000000001','da000001-0000-4000-8000-000000000002',gen_random_uuid(),'business_growth_grant','da000001-0000-4000-8000-000000000001','test_data');

-- Reproduce the original FK error before testing the replacement action.
do $$ begin
 begin
  delete from public.reviewer_assignments where id='da000003-0000-4000-8000-000000000001';
  raise exception 'Reset-history assignment deletion unexpectedly succeeded';
 exception when integrity_constraint_violation then null; end;
end $$;

set local role authenticated;
do $$ declare actor uuid; begin
 foreach actor in array array[
  'da000001-0000-4000-8000-000000000002'::uuid,
  'da000001-0000-4000-8000-000000000003'::uuid,
  'da000001-0000-4000-8000-000000000004'::uuid
 ] loop
  perform set_config('request.jwt.claim.sub',actor::text,true);
  begin
   perform public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000001');
   raise exception 'Unauthorized deactivation succeeded';
  exception when insufficient_privilege then null; end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','',true);
do $$ begin
 begin
  perform public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000001');
  raise exception 'Unauthenticated deactivation succeeded';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ declare result jsonb; begin
 result:=public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000001');
 if result->>'replayed'<>'false' then raise exception 'First deactivation not applied'; end if;
 result:=public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000001');
 if result->>'replayed'<>'true' then raise exception 'Retry was not idempotent'; end if;
end $$;
reset role;

-- Current Grant reviews also block deactivation; declaration identity survives.
insert into public.portal_applications(id,program_id,applicant_name,external_submission_id) values
 ('da000002-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','Grant review fixture','deactivate-current-review');
insert into public.reviewer_assignments(id,application_id,program_id,reviewer_id) values
 ('da000003-0000-4000-8000-000000000003','da000002-0000-4000-8000-000000000003','22222222-2222-4222-8222-222222222222','da000001-0000-4000-8000-000000000002');
insert into public.grant_conflict_declarations(assignment_id,reviewer_id) values
 ('da000003-0000-4000-8000-000000000003','da000001-0000-4000-8000-000000000002');
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ declare requirement text; begin
 foreach requirement in array array['owner_eligibility','business_eligibility','lara_good_standing',
  'required_documentation','profit_loss_2024','profit_loss_2025'] loop
  perform public.set_grant_requirement('da000002-0000-4000-8000-000000000003',requirement,'verified','Rollback deactivation fixture');
 end loop;
 perform public.confirm_grant_eligibility('da000002-0000-4000-8000-000000000003','eligible','Rollback deactivation fixture');
end $$;
reset role;
insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status,rubric_version_id)
 select 'da000003-0000-4000-8000-000000000003','da000002-0000-4000-8000-000000000003',
 '22222222-2222-4222-8222-222222222222','da000001-0000-4000-8000-000000000002','in_progress',id
 from public.rubric_versions where program_id='22222222-2222-4222-8222-222222222222' and active;
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  perform public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000003');
  raise exception 'Current Grant review was ignored';
 exception when check_violation then null; end;
 begin
  update public.reviewer_assignments set lifecycle='suspended',deactivated_at=now(),
   deactivated_by='da000001-0000-4000-8000-000000000001'
   where id='da000003-0000-4000-8000-000000000003';
  raise exception 'Browser forged a deactivation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if not exists(select 1 from public.program_reviews where assignment_id='da000003-0000-4000-8000-000000000003')
 or not exists(select 1 from public.reviewer_assignments where id='da000003-0000-4000-8000-000000000003' and lifecycle='active') then
  raise exception 'Blocked deactivation changed current review or assignment'; end if;
end $$;
do $$ begin
 if not exists(select 1 from public.reviewer_assignments where id='da000003-0000-4000-8000-000000000001'
  and lifecycle='suspended' and deactivated_at is not null and deactivated_by='da000001-0000-4000-8000-000000000001')
 or (select count(*) from public.admin_review_reset_events where assignment_id='da000003-0000-4000-8000-000000000001')<>1 then
  raise exception 'Assignment or reset history was not preserved'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000002',true);
do $$ begin
 if private.current_user_can_access_application('da000002-0000-4000-8000-000000000001') then
  raise exception 'Deactivated reviewer still has application access'; end if;
end $$;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  update public.reviewer_assignments set lifecycle='active',deactivated_at=null,deactivated_by=null
   where id='da000003-0000-4000-8000-000000000001';
  raise exception 'Reactivation succeeded';
 exception when raise_exception then
  if sqlerrm='Reactivation succeeded' then raise; end if;
 end;
end $$;
reset role;

-- An unresolved conflict must use conflict resolution, even with no review.
insert into public.grant_conflict_reports(assignment_id,application_id,program_id,reviewer_id,reason)
 values('da000003-0000-4000-8000-000000000002','da000002-0000-4000-8000-000000000002','22222222-2222-4222-8222-222222222222','da000001-0000-4000-8000-000000000002','Rollback conflict fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ begin
 begin
  perform public.admin_deactivate_assignment('da000003-0000-4000-8000-000000000002');
  raise exception 'Unresolved conflict was bypassed';
 exception when check_violation then null; end;
end $$;
reset role;

-- Scholarship uses legacy reviews and an automatic eligibility assignment trigger.
insert into public.applicants(id,first_name,last_name,preliminary_screening_status)
 values('da000004-0000-4000-8000-000000000001','Deactivation','Scholarship','eligible_for_review');
insert into public.reviews(applicant_id,reviewer_id,reviewer_name)
 values('da000004-0000-4000-8000-000000000001','da000001-0000-4000-8000-000000000002','Rollback reviewer');
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
do $$ declare aid uuid; begin
 select r.id into aid from public.reviewer_assignments r join public.applicants a on a.application_id=r.application_id
  where a.id='da000004-0000-4000-8000-000000000001' and r.reviewer_id='da000001-0000-4000-8000-000000000002';
 begin
  perform public.admin_deactivate_assignment(aid);
  raise exception 'Current Scholarship review was ignored';
 exception when check_violation then null; end;
end $$;
reset role;
delete from public.reviews where applicant_id='da000004-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','da000001-0000-4000-8000-000000000001',true);
select public.admin_deactivate_assignment(r.id) from public.reviewer_assignments r join public.applicants a on a.application_id=r.application_id
 where a.id='da000004-0000-4000-8000-000000000001' and r.reviewer_id='da000001-0000-4000-8000-000000000002';
reset role;
update public.applicants set preliminary_screening_status='pending_screening' where id='da000004-0000-4000-8000-000000000001';
update public.applicants set preliminary_screening_status='eligible_for_review' where id='da000004-0000-4000-8000-000000000001';
do $$ begin
 if not exists(select 1 from public.reviewer_assignments r join public.applicants a on a.application_id=r.application_id
  where a.id='da000004-0000-4000-8000-000000000001' and r.reviewer_id='da000001-0000-4000-8000-000000000002'
  and r.lifecycle='suspended' and r.deactivated_at is not null) then
  raise exception 'Eligibility reactivated administrative deactivation'; end if;
 begin
  insert into public.reviews(applicant_id,reviewer_id,reviewer_name)
   values('da000004-0000-4000-8000-000000000001','da000001-0000-4000-8000-000000000002','Stale request');
  raise exception 'Stale review request created a review after deactivation';
 exception when insufficient_privilege then null; end;
end $$;
-- Explicitly deactivated assignments without reset-history FKs cannot be deleted either.
do $$ begin
 begin
  delete from public.reviewer_assignments r using public.applicants a
   where r.application_id=a.application_id and a.id='da000004-0000-4000-8000-000000000001'
   and r.reviewer_id='da000001-0000-4000-8000-000000000002';
  raise exception 'Deactivated history deletion succeeded';
 exception when raise_exception then
  if sqlerrm='Deactivated history deletion succeeded' then raise; end if;
 end;
end $$;
rollback;
