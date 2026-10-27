-- Isolated rollback-only summary authorization and replacement-chain fixtures.
begin;
insert into auth.users(id,email)
select ('ab000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'summary-'||i||'@example.invalid' from generate_series(1,9) i;
update public.profiles set full_name='Summary reviewer '||right(id::text,1) where id::text like 'ab000000%';
insert into public.user_program_access(user_id,program_id,access_role)
select ('ab000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,
  case when i=1 then 'admin' when i=7 then 'viewer' else 'reviewer' end::public.program_access_role
from generate_series(1,8) i cross join public.programs p where p.slug='business_growth_grant';
insert into public.user_program_access(user_id,program_id,access_role)
select 'ab000000-0000-4000-8000-000000000009',id,'admin' from public.programs where slug='scholarship';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select 'ab000000-0000-4000-9000-000000000099',id,'summary-fixture','Synthetic application' from public.programs where slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select 'ab000000-0000-4000-9000-000000000098',id,'summary-empty','Empty fixture' from public.programs where slug='business_growth_grant';
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare p uuid; a uuid:='ab000000-0000-4000-9000-000000000099'; own uuid;peer uuid;r uuid;replacement uuid;latest uuid;k text;result jsonb;begin
 select id into p from public.programs where slug='business_growth_grant';
 foreach k in array array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025'] loop perform public.set_grant_requirement(a,k,'verified');end loop;
 perform public.confirm_grant_eligibility(a,'eligible');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a,p,'ab000000-0000-4000-8000-000000000002',auth.uid()) returning id into own;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a,p,'ab000000-0000-4000-8000-000000000003',auth.uid()) returning id into peer;
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
 r:=public.report_grant_conflict(own,'Private original conflict explanation');
 result:=public.grant_application_assignment_summary(a);
 if not exists(select 1 from jsonb_array_elements(result->'assignments') x where x->>'status'='on_hold') then raise exception 'Held status missing';end if;
 if result::text like '%Private original%' then raise exception 'Reviewer received private reason';end if;
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
 replacement:=public.resolve_grant_conflict(r,'replaced','Private administrator resolution','ab000000-0000-4000-8000-000000000004');
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000004',true);
 r:=public.report_grant_conflict(replacement,'Private second conflict explanation');
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
 latest:=public.resolve_grant_conflict(r,'replaced','Private second resolution reason','ab000000-0000-4000-8000-000000000005');
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000003',true);
 r:=public.report_grant_conflict(peer,'Private cleared conflict explanation');
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
 perform public.resolve_grant_conflict(r,'cleared','Private cleared resolution reason',null);
 result:=public.grant_application_assignment_summary(a);
 if jsonb_array_length(result->'assignments')<>2 then raise exception 'Historical reviewer counted as active';end if;
 if (select count(*) from jsonb_array_elements(result->'history') e where e->>'kind'='replaced')<>2 then raise exception 'Replacement chain lost';end if;
 if (select count(*) from jsonb_array_elements(result->'history') e where e->>'kind'='cleared')<>1 then raise exception 'Cleared conflict lost';end if;
 if result::text not like '%Private original%' then raise exception 'Admin reason unavailable';end if;
 perform set_config('test.summary.assignment',latest::text,true);
end $$;
reset role;
-- Populate a current draft without relaxing native guards.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid;v uuid;begin
 select id into p from public.programs where slug='business_growth_grant';
 v:=public.create_rubric_version(p,null);
 insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order) values(p,v,'Summary fixture',100,1);
 perform public.activate_rubric_version(p,v);
 insert into public.grant_conflict_declarations(assignment_id,reviewer_id)
 select id,reviewer_id from public.reviewer_assignments where id=current_setting('test.summary.assignment')::uuid;
 insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status,rubric_version_id,reviewer_comments)
 select id,application_id,program_id,reviewer_id,'in_progress',v,'Secret peer notes' from public.reviewer_assignments where id=current_setting('test.summary.assignment')::uuid;
end $$;
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare result jsonb;begin
 result:=public.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');
 if jsonb_array_length(result->'assignments')<>2 then raise exception 'Peer roster incomplete';end if;
 if not exists(select 1 from jsonb_array_elements(result->'assignments') a where a->>'status'='draft' and a->>'replaces'='Summary reviewer 4') then raise exception 'Current replacement/draft missing';end if;
 if exists(select 1 from jsonb_array_elements(result->'history') e where e ? 'reason' or e ? 'actor_name') then raise exception 'Private history leaked';end if;
 if result::text like '%Secret peer notes%' or result::text like '%total_score%' then raise exception 'Private review leaked';end if;
 if (select count(*) from public.program_reviews where application_id='ab000000-0000-4000-9000-000000000099')<>0 then raise exception 'Peer review row policies broadened';end if;
end $$;
-- Authorized viewer gets the same redacted summary.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000007',true);
do $$ begin perform public.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');end $$;
-- Unassigned, replaced and wrong-program callers are denied, including direct helper calls.
do $$ declare caller text;begin
 foreach caller in array array['002','004','006','009'] loop
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000'||caller,true);
 begin perform public.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');raise exception 'Unauthorized caller accepted';exception when insufficient_privilege then null;end;
 begin perform private.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');raise exception 'Unauthorized helper accepted';exception when insufficient_privilege then null;end;
 end loop;
end $$;
reset role;
-- Empty roster and administrative deactivation remain distinct from unavailable data.
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare p uuid;a uuid;s uuid;assignment uuid;result jsonb;begin
 select id into p from public.programs where slug='business_growth_grant';
 a:='ab000000-0000-4000-9000-000000000098';
 result:=public.grant_application_assignment_summary(a);
 if result->'assignments'<>'[]'::jsonb or result->'history'<>'[]'::jsonb then raise exception 'Empty summary not explicit';end if;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values(a,p,'ab000000-0000-4000-8000-000000000008',auth.uid()) returning id into assignment;
 perform public.admin_deactivate_assignment(assignment);
 result:=public.grant_application_assignment_summary(a);
 if result->'assignments'<>'[]'::jsonb or not exists(select 1 from jsonb_array_elements(result->'history') e where e->>'kind'='deactivated') then raise exception 'Deactivation history lost';end if;
 -- Practice access must still require a current round and participant membership.
 s:=public.start_grant_practice(p,'Assignment summary isolation',array['ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000003']::uuid[]);
 select id into a from public.portal_applications where practice_session_id=s limit 1;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values(a,p,'ab000000-0000-4000-8000-000000000002',auth.uid());
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
 perform public.grant_application_assignment_summary(a);
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000007',true);
 begin perform public.grant_application_assignment_summary(a);raise exception 'Nonparticipant viewer saw practice';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000001',true);
 perform public.reset_grant_practice(s,1,true);
 perform set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000002',true);
 begin perform public.grant_application_assignment_summary(a);raise exception 'Archived practice accessible to participant';exception when insufficient_privilege then null;end;
end $$;
reset role;
-- An active assignment does not preserve access after program membership is removed.
delete from public.user_program_access where user_id='ab000000-0000-4000-8000-000000000005';
select set_config('request.jwt.claim.sub','ab000000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ begin
 begin perform public.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');raise exception 'Revoked program access accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.grant_application_assignment_summary('ab000000-0000-4000-9000-000000000099');raise exception 'Anonymous access accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
