-- Synthetic rollback-only fixtures. Use an isolated database, never production.
begin;
insert into auth.users(id,email) select ('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'practice-'||i||'@example.invalid' from generate_series(1,8) i;
insert into public.user_program_access(user_id,program_id,access_role)
select ('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,case when i=1 then 'admin' else 'reviewer' end::public.program_access_role
from generate_series(1,7) i cross join public.programs p where p.slug='business_growth_grant';
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid;v uuid; begin
select id into p from public.programs where slug='business_growth_grant';v:=public.create_rubric_version(p,null);
insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order) values(p,v,'Synthetic criterion',100,1);
perform public.activate_rubric_version(p,v);end $$;
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select 'cc000000-0000-4000-9000-000000000099',id,'real-fixture','Real isolation fixture' from public.programs where slug='business_growth_grant';
create function pg_temp.fail_practice_seed() returns trigger language plpgsql as $$ begin
 if current_setting('test.practice.force_failure',true)='yes' and new.practice_round=2 then raise exception 'Synthetic practice seed failure'; end if;
 return new; end $$;
create trigger test_practice_seed_failure before insert on public.portal_applications for each row execute function pg_temp.fail_practice_seed();
set local role authenticated;
do $$
declare p uuid;s uuid;roster uuid[];aid uuid;own uuid;peer uuid;version_id uuid;result jsonb;own_review uuid;peer_review uuid;report uuid;replacement uuid;g uuid[];preview uuid;realpreview uuid; old jsonb;
begin
select id into p from public.programs where slug='business_growth_grant';
select array_agg(('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid order by i) into roster from generate_series(2,7) i;
s:=public.start_grant_practice(p,'Synthetic walkthrough',roster);
if (select count(*) from public.portal_applications where practice_session_id=s)<>40 then raise exception 'Expected 40 practice applications';end if;
if exists(select 1 from public.program_rankings where application_id in(select id from public.portal_applications where practice_session_id=s)) then raise exception 'Practice ranked with real data';end if;

g:=array[public.save_grant_reviewer_group(p,'Pair 1',roster[1:2]),public.save_grant_reviewer_group(p,'Pair 2',roster[3:4]),public.save_grant_reviewer_group(p,'Pair 3',roster[5:6])];
for aid in select id from public.portal_applications where practice_session_id=s loop
perform public.set_grant_requirement(aid,'owner_eligibility','verified');perform public.set_grant_requirement(aid,'business_eligibility','verified');perform public.set_grant_requirement(aid,'lara_good_standing','verified');perform public.set_grant_requirement(aid,'required_documentation','verified');perform public.set_grant_requirement(aid,'profit_loss_2024','verified');perform public.set_grant_requirement(aid,'profit_loss_2025','verified');perform public.confirm_grant_eligibility(aid,'eligible');end loop;
realpreview:=public.preview_grant_group_allocation(p,g,'balanced');
if (select jsonb_array_length(snapshot) from public.grant_allocation_previews where id=realpreview)<>1 then raise exception 'Live pool mixed practice';end if;
preview:=public.preview_grant_practice_allocation(s,g,'balanced');
if (select superseded_at from public.grant_allocation_previews where id=realpreview) is not null then raise exception 'Practice superseded live preview';end if;
if (select array_agg(n order by pair) from (select e->>'pair' pair,count(*) n from public.grant_allocation_previews v,jsonb_array_elements(v.allocation) e where v.id=preview group by 1) q)<>array[14::bigint,13,13] then raise exception 'Distribution incorrect';end if;
result:=public.apply_grant_pair_allocation(preview);if (result->>'assignments')::integer<>80 then raise exception 'Practice assignment count';end if;
select application_id,id into aid,own from public.reviewer_assignments where reviewer_id=roster[1] and application_id in(select id from public.portal_applications where practice_session_id=s) limit 1;
select id into peer from public.reviewer_assignments where application_id=aid and reviewer_id=roster[2];
select id into version_id from public.rubric_versions where program_id=p and active;
perform set_config('request.jwt.claim.sub',roster[1]::text,true);
begin perform public.submit_business_grant_review(aid,own,null,0,version_id,'[]','uncleared','save_draft','practice-uncleared');raise exception 'Uncleared draft allowed';exception when others then if sqlerrm not like 'review_submission:conflict_declaration_required:%' then raise;end if;end;
begin perform public.declare_grant_no_conflict(peer);raise exception 'Nonowner declared';exception when insufficient_privilege then null;end;
perform public.declare_grant_no_conflict(own);perform public.declare_grant_no_conflict(own);
result:=public.submit_business_grant_review(aid,own,null,0,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',80)) from public.rubric_criteria where rubric_version_id=version_id),'Original private score','submit','practice-own-submit','grant_reviewer_certification_v1',true);own_review:=(result->>'reviewId')::uuid;
report:=public.report_grant_conflict(own,'Synthetic relationship discovered after submission');
begin perform public.submit_business_grant_review(aid,own,null,0,version_id,'[]','held','save_draft','practice-held');raise exception 'Held save allowed';exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise;end if;end;
perform set_config('request.jwt.claim.sub',roster[2]::text,true);
perform public.declare_grant_no_conflict(peer);
result:=public.submit_business_grant_review(aid,peer,null,0,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',60)) from public.rubric_criteria where rubric_version_id=version_id),'Unaffected private score','submit','practice-peer-submit','grant_reviewer_certification_v1',true);peer_review:=(result->>'reviewId')::uuid;
if exists(select 1 from public.program_reviews where id=own_review) then raise exception 'Partner score leaked';end if;
begin perform public.resolve_grant_conflict(report,'replaced','Reviewer may not resolve',roster[3]);raise exception 'Reviewer resolved';exception when insufficient_privilege then null;end;
perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
begin perform public.resolve_grant_conflict(report,'replaced','Duplicate partner rejected',roster[2]);raise exception 'Partner replacement allowed';exception when others then if sqlerrm not like 'Choose a different%' then raise;end if;end;
replacement:=public.resolve_grant_conflict(report,'replaced','Confirmed relationship; replace only this reviewer',roster[3]);
if (select average_score from public.portal_applications where id=aid)<>60 or (select completed_review_count from public.portal_applications where id=aid)<>1 then raise exception 'Excluded score still counts';end if;
if (select total_score from public.program_reviews where id=own_review)<>80 or (select reviewer_comments from public.program_reviews where id=own_review)<>'Original private score' then raise exception 'Conflict history lost';end if;
if (select lifecycle from public.reviewer_assignments where id=peer)<>'active' then raise exception 'Unaffected partner modified';end if;
perform set_config('request.jwt.claim.sub',roster[3]::text,true);
begin perform public.submit_business_grant_review(aid,replacement,null,0,version_id,'[]','replacement','save_draft','practice-new-clearance');raise exception 'Replacement skipped clearance';exception when others then if sqlerrm not like 'review_submission:conflict_declaration_required:%' then raise;end if;end;
perform public.declare_grant_no_conflict(replacement);
result:=public.submit_business_grant_review(aid,replacement,null,0,version_id,(select jsonb_agg(jsonb_build_object('criterionId',id,'value',100)) from public.rubric_criteria where rubric_version_id=version_id),'Replacement private score','submit','practice-replacement-submit','grant_reviewer_certification_v1',true);
perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
if (select average_score from public.portal_applications where id=aid)<>80 or (select completed_review_count from public.portal_applications where id=aid)<>2 then raise exception 'Replacement aggregate incorrect';end if;
perform set_config('test.practice.force_failure','yes',true);
begin perform public.reset_grant_practice(s,1);raise exception 'Forced reset failure missing';exception when others then if sqlerrm<>'Synthetic practice seed failure' then raise;end if;end;
perform set_config('test.practice.force_failure','no',true);
if (select round from public.grant_practice_sessions where id=s)<>1 or (select lifecycle from public.reviewer_assignments where id=replacement)<>'active' or (select count(*) from public.portal_applications where practice_session_id=s)<>40 then raise exception 'Failed reset left partial changes';end if;
perform public.reset_grant_practice(s,1);
if (select count(*) from public.portal_applications where practice_session_id=s and practice_round=2)<>40 then raise exception 'Fresh round missing';end if;
if exists(select 1 from public.reviewer_assignments x join public.portal_applications a on a.id=x.application_id where a.practice_session_id=s and x.lifecycle='active') then raise exception 'Reset retained active assignments';end if;
if not exists(select 1 from public.program_reviews where id=own_review) or not exists(select 1 from public.grant_conflict_resolutions where report_id=report) then raise exception 'Reset erased history';end if;
if not exists(select 1 from public.portal_applications where id='cc000000-0000-4000-9000-000000000099' and practice_session_id is null) then raise exception 'Real application touched';end if;
begin perform public.reset_grant_practice(s,1);raise exception 'Stale reset accepted';exception when others then if sqlerrm not like 'Practice session changed%' then raise;end if;end;
perform set_config('request.jwt.claim.sub',roster[3]::text,true);
begin perform public.submit_business_grant_review(aid,replacement,null,0,version_id,'[]','old-round','save_draft','practice-old-round');raise exception 'Old round saved';exception when others then if sqlerrm not like 'review_submission:authorization:%' then raise;end if;end;
perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
begin perform public.set_grant_requirement(aid,'owner_eligibility','verified');raise exception 'Archived screening modified';exception when others then if sqlerrm<>'Practice round has ended' then raise;end if;end;
perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000008',true);
if exists(select 1 from public.grant_practice_sessions where id=s) or exists(select 1 from public.portal_applications where practice_session_id=s) then raise exception 'Nonparticipant accessed practice';end if;
perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
perform public.reset_grant_practice(s,2,true);
if (select ended_at from public.grant_practice_sessions where id=s) is null then raise exception 'Session not ended';end if;
end $$;
reset role;
insert into public.user_program_access(user_id,program_id,access_role) select 'cc000000-0000-4000-8000-000000000008',id,'viewer' from public.programs where slug='business_growth_grant';
set local role authenticated;
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000008',true);
do $$ begin
if exists(select 1 from public.portal_applications where practice_session_id is not null) or exists(select 1 from public.business_grant_application_details where business_name like 'PRACTICE%') or exists(select 1 from public.application_documents where label like 'PRACTICE%') or exists(select 1 from public.application_eligibility_reviews where application_id in(select id from public.portal_applications where practice_session_id is not null)) then raise exception 'Grant viewer accessed practice data';end if;
begin perform public.start_grant_practice((select id from public.programs where slug='business_growth_grant'),'Unauthorized',array['cc000000-0000-4000-8000-000000000002'::uuid,'cc000000-0000-4000-8000-000000000003'::uuid]);raise exception 'Viewer created practice';exception when insufficient_privilege then null;end;
if has_function_privilege('anon','public.start_grant_practice(uuid,text,uuid[])','EXECUTE') or has_table_privilege('authenticated','public.grant_conflict_declarations','INSERT') then raise exception 'Practice or declaration privileges leaked';end if;
end $$;
rollback;
