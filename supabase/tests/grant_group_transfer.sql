-- Synthetic fixtures only. Run against a disposable, fully migrated database.
begin;
create function pg_temp.expect_failure(statement text, pattern text) returns void language plpgsql as $$
begin
 begin execute statement;
 exception when others then
   if sqlerrm like pattern then return; end if;
   raise exception 'Unexpected failure: % (expected %)',sqlerrm,pattern;
 end;
 raise exception 'Expected failure did not occur: %',statement;
end $$;
insert into auth.users(id,email)
select ('ad000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'duplicate-fixture-'||i||'@example.invalid' from generate_series(1,9) i;
update public.profiles set full_name='Fictional reviewer '||right(id::text,1) where id::text like 'ad000000%';
insert into public.user_program_access(user_id,program_id,access_role)
select ('ad000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,
 case when i=1 then 'admin' when i=4 then 'viewer' else 'reviewer' end::public.program_access_role
from generate_series(1,9) i cross join public.programs p where p.slug='business_growth_grant' and i<>5;
insert into public.user_program_access(user_id,program_id,access_role)
select 'ad000000-0000-4000-8000-000000000005',id,'admin' from public.programs where slug='scholarship';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,is_test)
select ('ad000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,'duplicate-source-'||i,'Fictional applicant '||i,i=15
from generate_series(10,15) i cross join public.programs p where p.slug=case when i=14 then 'scholarship' else 'business_growth_grant' end;
insert into public.business_grant_application_details(application_id,business_name)
select a.id,'Fictional business '||right(a.id::text,2) from public.portal_applications a
join public.programs p on p.id=a.program_id where a.id::text like 'ad000000%' and p.slug='business_growth_grant';
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare gp uuid;v uuid;c uuid;a uuid;aid uuid;reviewer uuid;result jsonb;report uuid;begin
 select id into gp from public.programs where slug='business_growth_grant';
 v:=public.create_rubric_version(gp,null);
 insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order)
 values(gp,v,'Fictional 100 point criterion',100,1) returning id into c;
 perform public.activate_rubric_version(gp,v);
 perform set_config('test.duplicate.rubric',v::text,true);
 perform set_config('test.duplicate.criterion',c::text,true);
 foreach a in array array['ad000000-0000-4000-9000-000000000010','ad000000-0000-4000-9000-000000000011','ad000000-0000-4000-9000-000000000012']::uuid[] loop
 perform public.set_grant_requirement(a,key,'verified') from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) key;
 perform public.confirm_grant_eligibility(a,'eligible');
 end loop;
 foreach a in array array['ad000000-0000-4000-9000-000000000010','ad000000-0000-4000-9000-000000000011']::uuid[] loop
 foreach reviewer in array array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003']::uuid[] loop
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a,gp,reviewer,auth.uid()) returning id into aid;
 perform set_config('request.jwt.claim.sub',reviewer::text,true);
 perform public.declare_grant_no_conflict(aid);
 result:=public.submit_business_grant_review(a,aid,null,0,v,jsonb_build_array(jsonb_build_object('criterionId',c,'value',80)),
 'Private synthetic notes',case when a::text like '%10' and reviewer::text like '%3' then 'save_draft' else 'submit' end,
 'fixture-'||a||reviewer,'grant_reviewer_certification_v1',true);
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 end loop;end loop;
 select id into aid from public.reviewer_assignments where application_id='ad000000-0000-4000-9000-000000000010' and reviewer_id='ad000000-0000-4000-8000-000000000003';
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
 report:=public.report_grant_conflict(aid,'Synthetic conflict for preservation');
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 perform public.resolve_grant_conflict(report,'cleared','Synthetic clearance preserves all history',null);
end $$;
reset role;
update public.profiles set account_setup_completed=true where id::text like 'ad000000%';
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select set_config('test.transfer.group',public.save_grant_reviewer_group((select id from public.programs where slug='business_growth_grant'),'Synthetic destination',array['ad000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000007']::uuid[])::text,true);
reset role;
create temp table transfer_preserved as
select 'review' kind,to_jsonb(r) payload from public.program_reviews r where application_id::text like 'ad000000%'
union all select 'score',to_jsonb(s) from public.review_scores s join public.program_reviews r on r.id=s.review_id where r.application_id::text like 'ad000000%'
union all select 'certification',to_jsonb(c) from public.grant_review_certifications c join public.program_reviews r on r.id=c.program_review_id where r.application_id::text like 'ad000000%'
union all select 'conflict',to_jsonb(c) from public.grant_conflict_reports c where application_id::text like 'ad000000%'
union all select 'resolution',to_jsonb(z) from public.grant_conflict_resolutions z join public.grant_conflict_reports c on c.id=z.report_id where c.application_id::text like 'ad000000%';
set local role authenticated;
do $$ declare caller text; a uuid:='ad000000-0000-4000-9000-000000000010'; g uuid:=current_setting('test.transfer.group')::uuid;begin
 foreach caller in array array['002','004','005'] loop
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000'||caller,true);
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%administrator access required%');
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,null,gen_random_uuid())',a,g,'Synthetic reason'),'%administrator access required%');
 end loop;
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
end $$;
-- Safe rejection for prior-assignment collisions in every lifecycle.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010'; gp uuid; g uuid; i jsonb;begin
 select id into gp from public.programs where slug='business_growth_grant';
 g:=public.save_grant_reviewer_group(gp,'Synthetic collision',array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003']::uuid[]);
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%historical assignment%');
 g:=public.save_grant_reviewer_group(gp,'Synthetic invalid',array['ad000000-0000-4000-8000-000000000008']::uuid[]);
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%exactly two distinct%');
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,gen_random_uuid()),'%saved group%');
 g:=current_setting('test.transfer.group')::uuid;
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,null,gen_random_uuid())',a,g,' short '),'%Provide a reason%');
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,%L,gen_random_uuid())',a,g,'Synthetic reason','{}'),'%preview is stale%');
 perform set_config('test.transfer.impact',public.grant_transfer_impact(a,g)::text,true);
 -- A saved group revision invalidates the exact impact even with identical members.
 perform public.save_grant_reviewer_group(gp,'Synthetic destination',array['ad000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000007']::uuid[],g,1);
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,%L,gen_random_uuid())',a,g,'Synthetic reason',current_setting('test.transfer.impact')),'%preview is stale%');
end $$;
reset role;
-- Preserve a frozen applied allocation with original group attribution.
insert into public.grant_allocation_previews(program_id,actor_id,roster,capacity_mode,snapshot,allocation,group_snapshot,applied_at,applied_by)
select p.id,'ad000000-0000-4000-8000-000000000001',array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000007','ad000000-0000-4000-8000-000000000008','ad000000-0000-4000-8000-000000000009']::uuid[],'balanced','[]',
 jsonb_build_array(jsonb_build_object('applicationId','ad000000-0000-4000-9000-000000000010','pair',1,'reviewers',jsonb_build_array('ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003'))),
 jsonb_build_array(jsonb_build_object('id',g.id,'name',g.name,'revision',g.revision,'members',jsonb_build_array('ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003'))),now(),'ad000000-0000-4000-8000-000000000001'
from public.programs p join public.grant_reviewer_groups g on g.program_id=p.id and g.name='Synthetic collision' where p.slug='business_growth_grant';
create temp table frozen_transfer_allocation as select id,to_jsonb(p) payload from public.grant_allocation_previews p;
-- Force the second insert to fail after the first insert and both suspensions.
create function pg_temp.fail_second_destination() returns trigger language plpgsql as $$ begin
 if new.reviewer_id='ad000000-0000-4000-8000-000000000007' then raise exception 'Synthetic second assignment failure'; end if; return new;end $$;
create trigger synthetic_second_destination before insert on public.reviewer_assignments for each row execute function pg_temp.fail_second_destination();
set local role authenticated;
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010'; g uuid:=current_setting('test.transfer.group')::uuid;begin
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,%L,gen_random_uuid())',a,g,'Synthetic rollback reason',public.grant_transfer_impact(a,g)),'%second assignment failure%');
 if (select count(*) from public.reviewer_assignments where application_id=a)<>2 or exists(select 1 from public.reviewer_assignments where application_id=a and transferred_at is not null) or exists(select 1 from public.grant_group_transfer_events where application_id=a) then raise exception 'Transfer failed atomic rollback';end if;
end $$;
reset role;
drop trigger synthetic_second_destination on public.reviewer_assignments;
-- Banned/setup/access unavailable accounts fail closed.
update auth.users set banned_until=now()+interval '1 day' where id='ad000000-0000-4000-8000-000000000006';
set local role authenticated;
select pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)','ad000000-0000-4000-9000-000000000010',current_setting('test.transfer.group')),'%available, setup-complete%');
reset role;
update auth.users set banned_until=null where id='ad000000-0000-4000-8000-000000000006';
set local role authenticated;
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010'; g uuid:=current_setting('test.transfer.group')::uuid; i jsonb; event uuid:=gen_random_uuid();begin
 i:=public.grant_transfer_impact(a,g);
 perform set_config('test.transfer.final_impact',i::text,true);
 perform set_config('test.transfer.event',event::text,true);
 if public.transfer_grant_application(a,g,'  Synthetic fresh evaluation  ',i,event)<>event then raise exception 'Wrong event';end if;
 if public.transfer_grant_application(a,g,'Synthetic fresh evaluation',i,event)<>event then raise exception 'Not idempotent';end if;
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,%L,%L)',a,g,'Different reason',i,event),'%different transfer%');
 if (select count(*) from public.grant_group_transfer_events where application_id=a)<>1 then raise exception 'Duplicate audit';end if;
 if (select count(*) from public.reviewer_assignments where application_id=a and lifecycle='active')<>2 then raise exception 'Active pair wrong';end if;
 if (select count(*) from public.active_reviewer_assignments where application_id=a)<>2 or exists(select 1 from public.active_program_reviews where application_id=a) then raise exception 'Historical work counted';end if;
 if exists(select 1 from public.portal_applications where id=a and (completed_review_count<>0 or average_score<>0 or review_status<>'not_started')) then raise exception 'Historical aggregates counted';end if;
 if (public.grant_application_assignment_summary(a)->'current_group'->>'id')<>g::text or jsonb_array_length(public.grant_application_assignment_summary(a)->'excluded_transfer_reviews')<>2 then raise exception 'Current/history attribution missing';end if;
 if not exists(select 1 from jsonb_array_elements(public.grant_application_assignment_summary(a)->'history') e where e->>'kind'='transferred' and e->>'reason'='Synthetic fresh evaluation') then raise exception 'History missing';end if;
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%different saved group%');
end $$;
reset role;
-- Exact evidence preservation: reviews, scores, certifications, reports and resolutions.
do $$ begin
 if exists(select 1 from transfer_preserved b where not exists(
 select 1 from (select 'review' kind,to_jsonb(r) payload from public.program_reviews r
 union all select 'score',to_jsonb(s) from public.review_scores s
 union all select 'certification',to_jsonb(c) from public.grant_review_certifications c
 union all select 'conflict',to_jsonb(c) from public.grant_conflict_reports c
 union all select 'resolution',to_jsonb(z) from public.grant_conflict_resolutions z) x where x.kind=b.kind and x.payload=b.payload)) then raise exception 'Evidence changed';end if;
end $$;
-- Even privileged reset/reopen/delete paths cannot alter excluded evidence.
select pg_temp.expect_failure($s$update public.reviewer_assignments set lifecycle='active' where application_id='ad000000-0000-4000-9000-000000000010' and transferred_at is not null$s$,'%Transferred assignments%');
select pg_temp.expect_failure($s$delete from public.program_reviews where application_id='ad000000-0000-4000-9000-000000000010'$s$,'%Transferred review%');
select pg_temp.expect_failure($s$update public.review_scores set points=1 where review_id in(select id from public.program_reviews where application_id='ad000000-0000-4000-9000-000000000010')$s$,'%Transferred review%');
set local role authenticated;
-- Previous reviewer loses active application/document access; own evidence remains per existing policies.
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
do $$begin
 if exists(select 1 from public.portal_applications where id='ad000000-0000-4000-9000-000000000010') then raise exception 'Old reviewer retained active access';end if;
end $$;
select pg_temp.expect_failure($s$select public.submit_business_grant_review('ad000000-0000-4000-9000-000000000010',(select id from public.reviewer_assignments where application_id='ad000000-0000-4000-9000-000000000010'),null,0,current_setting('test.duplicate.rubric')::uuid,'[]','Stale draft','save_draft','stale-transfer-key')$s$,'%active assignment%');
-- Fresh reviewers have no declaration/review; after their own declaration, new scores count.
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000006',true);
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';aid uuid;result jsonb;begin
 select id into aid from public.reviewer_assignments where application_id=a and reviewer_id=auth.uid();
 if exists(select 1 from public.program_reviews where assignment_id=aid) or exists(select 1 from public.grant_conflict_declarations where assignment_id=aid) then raise exception 'Inherited review state';end if;
 perform public.declare_grant_no_conflict(aid);
 result:=public.submit_business_grant_review(a,aid,null,0,current_setting('test.duplicate.rubric')::uuid,jsonb_build_array(jsonb_build_object('criterionId',current_setting('test.duplicate.criterion'),'value',60)),'Fresh independent review','submit','fresh-transfer-submit','grant_reviewer_certification_v1',true);
 if (select completed_review_count from public.portal_applications where id=a)<>1 or (select average_score from public.portal_applications where id=a)<>60 then raise exception 'New score not authoritative';end if;
 if exists(select 1 from jsonb_array_elements(public.grant_application_assignment_summary(a)->'history') e where e->>'kind'='transferred' and (e ? 'reason' or e ? 'actor_name')) then raise exception 'Private audit leaked';end if;
end $$;
reset role;
-- Historical destination collisions are rejected rather than reused, for suspended,
-- deactivated and conflict-replaced assignments. Each scenario rolls itself back.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000011';gp uuid;aid uuid;g uuid:=current_setting('test.transfer.group')::uuid;report uuid;mode text;begin
 select id into gp from public.programs where slug='business_growth_grant';
 foreach mode in array array['suspended','deactivated','replaced'] loop
 begin
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 if mode='replaced' then
 -- Keep exactly two active source slots after a synthetic conflict replacement.
 update public.reviewer_assignments set lifecycle='suspended' where application_id=a and reviewer_id='ad000000-0000-4000-8000-000000000003';
 end if;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,lifecycle) values(a,gp,'ad000000-0000-4000-8000-000000000006',case when mode='suspended' then 'suspended' else 'active' end::public.assignment_lifecycle) returning id into aid;
 if mode='deactivated' then perform public.admin_deactivate_assignment(aid);end if;
 if mode='replaced' then
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000006',true);
 report:=public.report_grant_conflict(aid,'Synthetic destination conflict restriction');
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 perform public.resolve_grant_conflict(report,'replaced','Synthetic replacement preservation','ad000000-0000-4000-8000-000000000009');
 end if;
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%historical assignment%');
 raise exception 'Rollback collision scenario';
 exception when others then if sqlerrm<>'Rollback collision scenario' then raise;end if;end;
 end loop;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
-- The transferred pair cannot acquire a third active reviewer through stale admin controls.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';gp uuid;begin
 select program_id into gp from public.portal_applications where id=a;
 perform pg_temp.expect_failure(format('insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values(%L,%L,%L)',a,gp,'ad000000-0000-4000-8000-000000000008'),'%already has its two active reviewers%');
 perform pg_temp.expect_failure(format('delete from public.reviewer_assignments where application_id=%L and reviewer_id=%L',a,'ad000000-0000-4000-8000-000000000007'),'%history must be retained%');
end $$;
-- Transfer eligibility, withdrawn status and unavailable setup/access are fail-closed.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000011';g uuid:=current_setting('test.transfer.group')::uuid;mode text;begin
 foreach mode in array array['eligibility','withdrawn','setup','membership','conflict'] loop begin
 if mode='eligibility' then perform public.set_grant_requirement(a,'owner_eligibility','pending');
 elsif mode='withdrawn' then update public.portal_applications set status='withdrawn' where id=a;
 elsif mode='setup' then update public.profiles set account_setup_completed=false where id='ad000000-0000-4000-8000-000000000006';
 elsif mode='membership' then delete from public.user_program_access where user_id='ad000000-0000-4000-8000-000000000006';
 else
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
 perform public.report_grant_conflict((select id from public.reviewer_assignments where application_id=a and reviewer_id=auth.uid()),'Synthetic unresolved source conflict');
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 end if;
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),case mode when 'eligibility' then '%Confirm this application Eligible%' when 'withdrawn' then '%active, nonduplicate%' when 'conflict' then '%Resolve outstanding conflicts%' else '%available, setup-complete%' end);
 raise exception 'Rollback invalid state';
 exception when others then if sqlerrm<>'Rollback invalid state' then raise;end if;end;end loop;
end $$;
-- Practice participants and archived rounds stay isolated; test-only scores never rank.
do $$ declare gp uuid;s uuid;a uuid;g uuid;roster uuid[];impact jsonb;begin
 select id into gp from public.programs where slug='business_growth_grant';
 roster:=array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000007','ad000000-0000-4000-8000-000000000008','ad000000-0000-4000-8000-000000000009']::uuid[];
 s:=public.start_grant_practice(gp,'Synthetic transfer practice',roster);
 select id into a from public.portal_applications where practice_session_id=s limit 1;
 perform public.set_grant_requirement(a,key,'verified') from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) key;
 perform public.confirm_grant_eligibility(a,'eligible');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id) select a,gp,x from unnest(roster[1:2]) x;
 g:=public.save_grant_reviewer_group(gp,'Synthetic nonparticipant pair',array['ad000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000008']::uuid[]);
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%participants%');
 g:=current_setting('test.transfer.group')::uuid;
 impact:=public.grant_transfer_impact(a,g);
 perform public.transfer_grant_application(a,g,'Synthetic practice evaluation',impact,gen_random_uuid());
 if exists(select 1 from public.production_applications where id=a) or exists(select 1 from public.program_rankings where application_id=a) then raise exception 'Practice entered real scope';end if;
 if exists(select 1 from public.reviewer_assignments x join public.portal_applications p on p.id=x.application_id where p.id=a and (not p.is_test or p.practice_session_id<>s or p.practice_round<>1)) then raise exception 'Practice boundary changed';end if;
 perform public.reset_grant_practice(s,1);
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)',a,g),'%Practice round has ended%');
 if not exists(select 1 from public.grant_group_transfer_events where application_id=a) then raise exception 'Practice reset erased transfer history';end if;
end $$;
-- Plain test applications are supported without entering production rankings.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000015';gp uuid;g uuid:=current_setting('test.transfer.group')::uuid;begin
 select id into gp from public.programs where slug='business_growth_grant';
 perform public.set_grant_requirement(a,key,'verified') from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) key;
 perform public.confirm_grant_eligibility(a,'eligible');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id) select a,gp,x from unnest(array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003']::uuid[]) x;
 perform public.transfer_grant_application(a,g,'Synthetic plain test evaluation',public.grant_transfer_impact(a,g),gen_random_uuid());
 if exists(select 1 from public.program_rankings where application_id=a) then raise exception 'Test entered real ranking';end if;
 perform pg_temp.expect_failure(format('select public.grant_transfer_impact(%L,%L)','ad000000-0000-4000-9000-000000000014',g),'%administrator access required%');
end $$;
-- A later conflict still replaces just one destination reviewer. A later full transfer
-- then excludes the prior destination review without reviving any earlier identity.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';aid uuid;report uuid;gp uuid;g uuid;begin
 select program_id into gp from public.portal_applications where id=a;
 select id into aid from public.reviewer_assignments where application_id=a and reviewer_id='ad000000-0000-4000-8000-000000000007';
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000007',true);
 report:=public.report_grant_conflict(aid,'Synthetic conflict after group transfer');
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
 perform public.resolve_grant_conflict(report,'replaced','Synthetic one reviewer replacement','ad000000-0000-4000-8000-000000000008');
 if (select count(*) from public.reviewer_assignments where application_id=a and lifecycle='active')<>2 then raise exception 'Replacement after transfer broke pair';end if;
 g:=public.save_grant_reviewer_group(gp,'Synthetic next fresh group',array['ad000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000009']::uuid[]);
 perform public.transfer_grant_application(a,g,'Synthetic second fresh evaluation',public.grant_transfer_impact(a,g),gen_random_uuid());
 if (select count(*) from public.grant_group_transfer_events where application_id=a)<>2 or (select completed_review_count from public.portal_applications where id=a)<>0 then raise exception 'Second transfer history or scoring incorrect';end if;
end $$;
-- Previously suspended, nonconflict reviews also become excluded evidence.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000011';gp uuid;g uuid:=current_setting('test.transfer.group')::uuid;begin
 select program_id into gp from public.portal_applications where id=a;
 update public.reviewer_assignments set lifecycle='suspended' where application_id=a and reviewer_id='ad000000-0000-4000-8000-000000000003';
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values(a,gp,'ad000000-0000-4000-8000-000000000008');
 perform pg_temp.expect_failure(format('select public.transfer_grant_application(%L,%L,%L,null,gen_random_uuid())',a,g,repeat(chr(9),12)),'%Provide a reason%');
 perform public.transfer_grant_application(a,g,chr(9)||'Synthetic suspended history'||chr(10),public.grant_transfer_impact(a,g),gen_random_uuid());
 if (select completed_review_count from public.portal_applications where id=a)<>0 or exists(select 1 from public.active_program_reviews where application_id=a) then raise exception 'Suspended historical score still counted';end if;
 if (select reason from public.grant_group_transfer_events where application_id=a)<>'Synthetic suspended history' then raise exception 'Reason not canonically trimmed';end if;
end $$;
-- Frozen allocation JSON and its group/member snapshot remain byte-for-byte evidence.
do $$begin
 if exists(select 1 from frozen_transfer_allocation f left join public.grant_allocation_previews p on p.id=f.id where f.payload is distinct from to_jsonb(p)) then raise exception 'Frozen allocation changed';end if;
 if (public.grant_application_assignment_summary('ad000000-0000-4000-9000-000000000010')->'original_group'->>'name')<>'Synthetic collision' then raise exception 'Original attribution lost';end if;
end $$;
rollback;
