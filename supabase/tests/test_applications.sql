-- Isolated, rollback-only permission/lifecycle/isolation regression.
begin;
insert into auth.users(id,email) select ('ee000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'test-mode-'||i||'@example.invalid' from generate_series(1,4) i;
insert into public.user_roles(user_id,role) values('ee000000-0000-4000-8000-000000000001','admin');
insert into public.user_program_access(user_id,program_id,access_role)
select ('ee000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,
case when i=1 then 'admin' else 'reviewer' end::public.program_access_role
from generate_series(1,3) i cross join public.programs p;
insert into public.user_program_access(user_id,program_id,access_role)
select 'ee000000-0000-4000-8000-000000000004',id,'admin' from public.programs where slug='scholarship';
create function pg_temp.reject_test_delete() returns trigger language plpgsql as $$ begin
 if current_setting('test_applications.force_delete_failure',true)='yes' then raise exception 'Synthetic deletion failure'; end if;
 return old;
end $$;
create trigger test_atomic_delete before delete on public.portal_applications for each row execute function pg_temp.reject_test_delete();
select set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid; v uuid; begin
 select id into p from public.programs where slug='business_growth_grant';
 v:=public.create_rubric_version(p,null);
 insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order) values(p,v,'Test-mode synthetic criterion',100,1);
 perform public.activate_rubric_version(p,v);
end $$;
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select ('ee000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,'real-isolation-'||i,'Real Fixture '||i
from generate_series(1,2) i cross join public.programs p where p.slug='business_growth_grant';
set local role authenticated;
do $$
declare gp uuid; sp uuid; aid uuid; sid uuid; student uuid; assignment uuid; review_id uuid; version_id uuid;
 result jsonb; baseline jsonb; key text; real_count integer; report uuid;
begin
 select id into gp from public.programs where slug='business_growth_grant';
 select id into sp from public.programs where slug='scholarship';
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000004',true);
 begin perform public.create_test_application(gp); raise exception 'Other program administrator created Grant test'; exception when insufficient_privilege then null; end;
 result:=public.create_test_application(sp);
 perform public.delete_test_application((result->>'applicationId')::uuid);
 if has_function_privilege('anon','public.create_test_application(uuid)','execute')
 or has_function_privilege('anon','public.reset_test_application(uuid)','execute')
 or has_function_privilege('anon','public.delete_test_application(uuid)','execute') then raise exception 'Anonymous management allowed'; end if;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000002',true);
 begin perform public.create_test_application(gp); raise exception 'Reviewer created test'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
 result:=public.create_test_application(gp); aid:=(result->>'applicationId')::uuid;
 result:=public.create_test_application(sp); sid:=(result->>'applicationId')::uuid; student:=(result->>'applicantId')::uuid;
 if not (select is_test from public.portal_applications where id=aid) or not (select is_test from public.portal_applications where id=sid) then raise exception 'Test identity missing'; end if;
 if exists(select 1 from public.portal_applications where external_submission_id like 'real-isolation-%' and is_test) then raise exception 'Real default changed'; end if;
 if (select count(*) from public.application_documents where application_id=aid)<>3 then raise exception 'Grant fixtures missing'; end if;
 if (select preliminary_screening_status from public.applicants where id=student)<>'pending_screening' then raise exception 'Screening semantics changed'; end if;
 -- Snapshot all production result columns before deliberately extreme fictional scores.
 select jsonb_agg(to_jsonb(p) order by p.application_id) into baseline from public.program_rankings p where p.program_id=gp;
 select count(*) into real_count from public.production_applications where program_id=gp;
 if real_count<>2 then raise exception 'Production application count includes test'; end if;
 begin update public.portal_applications set is_test=false where id=aid; raise exception 'Test relabeled'; exception when others then if sqlerrm<>'Application test identity is immutable' then raise; end if; end;
 begin update public.portal_applications set is_test=true where external_submission_id='real-isolation-1'; raise exception 'Real relabeled'; exception when others then if sqlerrm<>'Application test identity is immutable' then raise; end if; end;
 select external_submission_id into key from public.portal_applications where id=aid;
 begin insert into public.portal_applications(program_id,external_submission_id,applicant_name) values(gp,key,'Imported row') on conflict(program_id,external_submission_id) do update set applicant_name=excluded.applicant_name;
 raise exception 'Import upsert changed test'; exception when others then if sqlerrm<>'Imports cannot overwrite a test application' then raise; end if; end;
 for key in select unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) loop
 perform public.set_grant_requirement(aid,key,'verified'); end loop;
 perform public.confirm_grant_eligibility(aid,'eligible');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values(aid,gp,'ee000000-0000-4000-8000-000000000002',auth.uid()) returning id into assignment;
 select id into version_id from public.rubric_versions where program_id=gp and active;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000003',true);
 if exists(select 1 from public.portal_applications where id=aid) then raise exception 'Unassigned reviewer accessed test'; end if;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000002',true);
 if not exists(select 1 from public.portal_applications where id=aid) then raise exception 'Assigned reviewer cannot access'; end if;
 perform public.declare_grant_no_conflict(assignment);
 result:=public.submit_business_grant_review(aid,assignment,null,0,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',100)) from public.rubric_criteria where rubric_version_id=version_id),'Fictional draft','save_draft','test-mode-grant-draft');
 review_id:=(result->>'reviewId')::uuid;
 result:=public.submit_business_grant_review(aid,assignment,review_id,(result->>'version')::integer,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',100)) from public.rubric_criteria where rubric_version_id=version_id),'Fictional submitted','submit','test-mode-grant-submit','grant_reviewer_certification_v1',true);
 begin perform public.reset_test_application(aid); raise exception 'Reviewer reset test'; exception when insufficient_privilege then null; end;
 begin perform public.delete_test_application(aid); raise exception 'Reviewer deleted test'; exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
 if (select average_score from public.portal_applications where id=aid)<>100 then raise exception 'Normal aggregate engine not exercised'; end if;
 if (select jsonb_agg(to_jsonb(p) order by p.application_id) from public.program_rankings p where p.program_id=gp) is distinct from baseline then raise exception 'Extreme test altered real rankings'; end if;
 if (select count(*) from public.production_applications where program_id=gp)<>real_count
 or exists(select 1 from public.production_applications where id=aid) then raise exception 'Production counts/progress/export scope leaks'; end if;
 begin perform public.reset_test_application('ee000000-0000-4000-9000-000000000001'); raise exception 'Real reset allowed'; exception when insufficient_privilege then null; end;
 begin perform public.delete_test_application('ee000000-0000-4000-9000-000000000001'); raise exception 'Real delete allowed'; exception when insufficient_privilege then null; end;
 -- Reset same application, same assignment; all draft/submission dependencies removed.
 perform public.reset_test_application(aid);
 if not exists(select 1 from public.portal_applications where id=aid and is_test)
 or not exists(select 1 from public.reviewer_assignments where id=assignment and lifecycle='active')
 or exists(select 1 from public.program_reviews where application_id=aid)
 or exists(select 1 from public.grant_conflict_declarations where assignment_id=assignment)
 or (select review_status from public.portal_applications where id=aid)<>'not_started' then raise exception 'Reset incomplete'; end if;
 -- Reviewer can repeat normal submission after reset (including same request keys).
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000002',true);
 perform public.declare_grant_no_conflict(assignment);
 result:=public.submit_business_grant_review(aid,assignment,null,0,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',100)) from public.rubric_criteria where rubric_version_id=version_id),'Repeated fictional draft','save_draft','test-mode-grant-draft');
 report:=public.report_grant_conflict(assignment,'Fictional conflict to exercise deletion');
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
 perform public.resolve_grant_conflict(report,'replaced','Fictional replacement to exercise dependency cleanup','ee000000-0000-4000-8000-000000000003');
 perform set_config('test_applications.force_delete_failure','yes',true);
 begin perform public.delete_test_application(aid); raise exception 'Expected synthetic deletion failure'; exception when others then
 if sqlerrm<>'Synthetic deletion failure' then raise; end if; end;
 perform set_config('test_applications.force_delete_failure','no',true);
 if not exists(select 1 from public.program_reviews where application_id=aid)
 or not exists(select 1 from public.grant_conflict_resolutions where report_id=report)
 or (select count(*) from public.reviewer_assignments where application_id=aid)<>2 then raise exception 'Failed delete left partial cleanup'; end if;
 perform public.delete_test_application(aid);
 if exists(select 1 from public.portal_applications where id=aid) or exists(select 1 from public.reviewer_assignments where application_id=aid)
 or exists(select 1 from public.program_reviews where application_id=aid) then raise exception 'Delete incomplete'; end if;
 -- Scholarship uses the actual legacy adapter/RPC and auto-assignment semantics.
 update public.applicants set preliminary_screening_status='eligible_for_review' where id=student;
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000002',true);
 select id into assignment from public.reviewer_assignments where application_id=sid and reviewer_id=auth.uid();
 result:=public.submit_scholarship_review(student,assignment,null,0,9,9,'Fictional scholarship draft',null,'save_draft','test-mode-sch-draft');
 result:=public.submit_scholarship_review(student,assignment,(result->>'reviewId')::uuid,(result->>'version')::integer,9,9,'Fictional scholarship submitted',null,'submit','test-mode-sch-submit');
 perform set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
 if exists(select 1 from public.production_applicants where id=student) or exists(select 1 from public.production_scholarship_reviews where applicant_id=student) then raise exception 'Scholarship reporting leaks'; end if;
 perform public.reset_test_application(sid);
 if exists(select 1 from public.reviews where applicant_id=student) or (select total_score from public.applicants where id=student)<>0 then raise exception 'Scholarship reset incomplete'; end if;
 perform public.admin_deactivate_assignment(assignment);
 perform public.delete_test_application(sid);
 if exists(select 1 from public.applicants where id=student) then raise exception 'Scholarship delete incomplete'; end if;
 if (select count(*) from public.production_applications where program_id=gp)<>2 then raise exception 'Real applications damaged'; end if;
end $$;
rollback;
