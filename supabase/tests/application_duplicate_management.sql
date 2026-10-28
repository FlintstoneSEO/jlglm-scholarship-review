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
-- Preserve every meaningful child row and both original source identities.
insert into public.application_documents(application_id,label,external_url)
values('ad000000-0000-4000-9000-000000000010','Synthetic evidence','https://example.invalid/evidence');
create temp table duplicate_before as
select 'retained' as kind,to_jsonb(a) as payload from public.portal_applications a where id='ad000000-0000-4000-9000-000000000011'
union all select 'reviews',to_jsonb(r) from public.program_reviews r where application_id::text like 'ad000000%'
union all select 'scores',to_jsonb(s) from public.review_scores s join public.program_reviews r on r.id=s.review_id where r.application_id::text like 'ad000000%'
union all select 'certifications',to_jsonb(c) from public.grant_review_certifications c join public.program_reviews r on r.id=c.program_review_id where r.application_id::text like 'ad000000%'
union all select 'assignments',to_jsonb(a) from public.reviewer_assignments a where application_id::text like 'ad000000%'
union all select 'documents',to_jsonb(d) from public.application_documents d where application_id::text like 'ad000000%'
union all select 'lifecycle',to_jsonb(e) from public.review_lifecycle_events e join public.program_reviews r on r.id=e.program_review_id where r.application_id::text like 'ad000000%'
union all select 'conflicts',to_jsonb(c) from public.grant_conflict_reports c where c.application_id::text like 'ad000000%'
union all select 'resolutions',to_jsonb(z) from public.grant_conflict_resolutions z join public.grant_conflict_reports c on c.id=z.report_id where c.application_id::text like 'ad000000%'
union all select 'declarations',to_jsonb(d) from public.grant_conflict_declarations d join public.reviewer_assignments a on a.id=d.assignment_id where a.application_id::text like 'ad000000%';
set local role authenticated;
-- No frontend or helper bypass for reviewers, viewers or other-program admins.
do $$ declare caller text;begin
 foreach caller in array array['002','004','005'] loop
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000'||caller,true);
 perform pg_temp.expect_failure($s$select public.grant_duplicate_impact('ad000000-0000-4000-9000-000000000010')$s$,'%administrator access required%');
 perform pg_temp.expect_failure($s$select private.mark_grant_application_duplicate('ad000000-0000-4000-9000-000000000010','ad000000-0000-4000-9000-000000000011','Synthetic reason',null)$s$,'%administrator access required%');
 end loop;
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
end $$;
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';b uuid:='ad000000-0000-4000-9000-000000000011';event uuid;impact jsonb;begin
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,a,'Synthetic reason'),'%different retained%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,b,'short'),'%provide a reason%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,'ad000000-0000-4000-9000-000000000014','Synthetic reason'),'%same program%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,'ad000000-0000-4000-9000-000000000015','Synthetic reason'),'%same program%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,'ad000000-0000-4000-9000-000000000099','Synthetic reason'),'%same program%');
 perform pg_temp.expect_failure(format('update public.portal_applications set duplicate_of=%L where id=%L',b,a),'%Use the administrator%');
 impact:=public.grant_duplicate_impact(a);
 if jsonb_array_length(impact->'assignments')<>2 then raise exception 'Impact incomplete';end if;
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,%L)',a,b,'Synthetic reason','{}'),'%Assignments or reviews changed%');
 event:=public.mark_grant_application_duplicate(a,b,'Synthetic reason',impact);
 if public.mark_grant_application_duplicate(a,b,' Synthetic reason ',impact)<>event then raise exception 'Not idempotent';end if;
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,%L)',a,b,'Different synthetic reason',impact),'%different request%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',b,'ad000000-0000-4000-9000-000000000013','Synthetic reason'),'%retained by existing duplicates%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)','ad000000-0000-4000-9000-000000000013',a,'Synthetic reason'),'%already excluded%');
 if exists(select 1 from public.active_portal_applications where id=a) or exists(select 1 from public.production_applications where id=a)
 or exists(select 1 from public.active_reviewer_assignments where application_id=a) or exists(select 1 from public.active_program_reviews where application_id=a)
 or exists(select 1 from public.program_rankings where application_id=a) then raise exception 'Duplicate entered active totals/workload/rankings';end if;
 if not exists(select 1 from jsonb_array_elements(public.grant_application_assignment_summary(a)->'history') e where e->>'kind'='marked_duplicate') then raise exception 'Duplicate audit absent from history';end if;
 if (select count(*) from public.application_duplicate_events where application_id=a)<>1 then raise exception 'Duplicate audit repeated';end if;
 -- Re-import source-owned answers using the original source identity.
 update public.portal_applications set applicant_name='Fictional updated source answer',status='submitted' where id=a;
 update public.business_grant_application_details set business_name='Fictional refreshed business' where application_id=a;
 if (select duplicate_of from public.portal_applications where id=a)<>b then raise exception 'Import cleared designation';end if;
 perform pg_temp.expect_failure(format('update public.portal_applications set duplicate_of=null where id=%L',a),'%administrator%');
end $$;
-- Pending allocation becomes stale when an unreviewed application is excluded.
do $$ declare gp uuid;preview uuid;frozen jsonb;a uuid:='ad000000-0000-4000-9000-000000000012';begin
 select id into gp from public.programs where slug='business_growth_grant';
 preview:=public.preview_grant_pair_allocation(gp,array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003','ad000000-0000-4000-8000-000000000006','ad000000-0000-4000-8000-000000000007','ad000000-0000-4000-8000-000000000008','ad000000-0000-4000-8000-000000000009']::uuid[],'balanced',null);
 select to_jsonb(p) into frozen from public.grant_allocation_previews p where id=preview;
 perform public.mark_grant_application_duplicate(a,'ad000000-0000-4000-9000-000000000011','Synthetic unreviewed duplicate',public.grant_duplicate_impact(a));
 perform pg_temp.expect_failure(format('select public.apply_grant_pair_allocation(%L)',preview),'%Stale preview%');
 if (select to_jsonb(p) from public.grant_allocation_previews p where id=preview)<>frozen then raise exception 'Frozen allocation rewritten';end if;
end $$;
-- An assigned reviewer can read only their existing history, never target reviews.
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';aid uuid;rid uuid;v uuid;c uuid;begin
 select id into aid from public.reviewer_assignments where application_id=a and reviewer_id=auth.uid();
 select id into rid from public.program_reviews where assignment_id=aid;
 v:=current_setting('test.duplicate.rubric')::uuid;c:=current_setting('test.duplicate.criterion')::uuid;
 perform pg_temp.expect_failure(format('select public.submit_business_grant_review(%L,%L,%L,1,%L,%L,%L,%L,%L)',a,aid,rid,v,'[]','Stale draft','save_draft','stale-duplicate-draft'),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('select public.submit_business_grant_review(%L,%L,%L,1,%L,%L,%L,%L,%L,%L,true)',a,aid,rid,v,'[]','Stale submit','submit','stale-duplicate-submit','grant_reviewer_certification_v1'),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('update public.program_reviews set reviewer_comments=%L where id=%L','Attempt to edit history',rid),'%permission denied%');
 perform pg_temp.expect_failure(format('update public.review_scores set points=90 where review_id=%L',rid),'%permission denied%');
 if (select count(*) from public.program_reviews where application_id=a)<>1 then raise exception 'Peer review privacy changed';end if;
 if exists(select 1 from public.application_duplicate_events where application_id=a) then raise exception 'Admin audit leaked';end if;
 if exists(select 1 from public.active_portal_applications where id=a) then raise exception 'Reviewer queue still active';end if;
end $$;
reset role;
-- Compare original rows as owner, including all certifications and scores.
do $$ begin
 if exists(select 1 from jsonb_array_elements(private.grant_committee_snapshot((select id from public.programs where slug='business_growth_grant'),null)) x where x->>'id'='ad000000-0000-4000-9000-000000000010') then raise exception 'Duplicate in allocation pool';end if;
end $$;
do $$ declare item record;actual jsonb;begin
 for item in select * from duplicate_before loop
 case item.kind
 when 'retained' then select to_jsonb(a) into actual from public.portal_applications a where id=(item.payload->>'id')::uuid;
 when 'reviews' then select to_jsonb(r) into actual from public.program_reviews r where id=(item.payload->>'id')::uuid;
 when 'scores' then select to_jsonb(s) into actual from public.review_scores s where id=(item.payload->>'id')::uuid;
 when 'certifications' then select to_jsonb(c) into actual from public.grant_review_certifications c where program_review_id=(item.payload->>'program_review_id')::uuid;
 when 'assignments' then select to_jsonb(a) into actual from public.reviewer_assignments a where id=(item.payload->>'id')::uuid;
 when 'documents' then select to_jsonb(d) into actual from public.application_documents d where id=(item.payload->>'id')::uuid;
 when 'lifecycle' then select to_jsonb(e) into actual from public.review_lifecycle_events e where id=(item.payload->>'id')::uuid;
 when 'conflicts' then select to_jsonb(c) into actual from public.grant_conflict_reports c where id=(item.payload->>'id')::uuid;
 when 'resolutions' then select to_jsonb(z) into actual from public.grant_conflict_resolutions z where report_id=(item.payload->>'report_id')::uuid;
 when 'declarations' then select to_jsonb(d) into actual from public.grant_conflict_declarations d where assignment_id=(item.payload->>'assignment_id')::uuid;
 end case;
 if actual is distinct from item.payload then raise exception 'Preserved % changed: %',item.kind,item.payload;end if;
 end loop;
end $$;
-- Review/score/certification deletion and assignment creation cannot erase/reactivate history.
do $$ declare a uuid:='ad000000-0000-4000-9000-000000000010';r uuid;begin
 select id into r from public.program_reviews where application_id=a and status='completed';
 perform pg_temp.expect_failure(format('delete from public.grant_review_certifications where program_review_id=%L',r),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('delete from public.program_reviews where id=%L',r),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('update public.program_reviews set reviewer_comments=%L where id=%L','Owner attempt to edit',r),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('update public.review_scores set points=90 where review_id=%L',r),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('insert into public.reviewer_assignments(application_id,program_id,reviewer_id) select id,program_id,%L from public.portal_applications where id=%L','ad000000-0000-4000-8000-000000000006',a),'%duplicate_application:%');
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
set local role authenticated;
-- Compatible practice links work, while independent tests, other sessions and
-- archived rounds are rejected. Existing test cleanup cannot erase this history.
do $$ declare gp uuid;s uuid;other_session uuid;a uuid;b uuid;outside uuid;test_id uuid;begin
 select id into gp from public.programs where slug='business_growth_grant';
 s:=public.start_grant_practice(gp,'Synthetic duplicate scope',array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003']::uuid[]);
 other_session:=public.start_grant_practice(gp,'Synthetic other scope',array['ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003']::uuid[]);
 select id into a from public.portal_applications where practice_session_id=s order by id limit 1;
 select id into b from public.portal_applications where practice_session_id=s and id<>a order by id limit 1;
 select id into outside from public.portal_applications where practice_session_id=other_session limit 1;
 test_id:=(public.create_test_application(gp)->>'applicationId')::uuid;
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,outside,'Synthetic cross session reason'),'%same program%');
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,test_id,'Synthetic independent test reason'),'%same program%');
 perform public.mark_grant_application_duplicate(a,b,'Synthetic same practice designation',public.grant_duplicate_impact(a));
 perform pg_temp.expect_failure(format('select public.reset_test_application(%L)',a),'%duplicate_application:%');
 perform pg_temp.expect_failure(format('select public.delete_test_application(%L)',b),'%Retained duplicate history%');
 perform public.reset_grant_practice(s,1,true);
 select id into a from public.portal_applications where practice_session_id=s and duplicate_of is null and id<>b limit 1;
 perform pg_temp.expect_failure(format('select public.mark_grant_application_duplicate(%L,%L,%L,null)',a,b,'Synthetic archived scope reason'),'%Practice round has ended%');
 -- A reviewer assigned only to the excluded record gains no access to the retained record.
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values('ad000000-0000-4000-9000-000000000013',gp,'ad000000-0000-4000-8000-000000000006',auth.uid());
 perform public.mark_grant_application_duplicate('ad000000-0000-4000-9000-000000000013','ad000000-0000-4000-9000-000000000011','Synthetic access preservation',public.grant_duplicate_impact('ad000000-0000-4000-9000-000000000013'));
 perform set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000006',true);
 if not exists(select 1 from public.portal_applications where id='ad000000-0000-4000-9000-000000000013') then raise exception 'Own excluded history unavailable';end if;
 if exists(select 1 from public.portal_applications where id='ad000000-0000-4000-9000-000000000011') then raise exception 'Retained application access broadened';end if;
end $$;
reset role;
set local role anon;
select pg_temp.expect_failure($s$select public.grant_duplicate_impact('ad000000-0000-4000-9000-000000000010')$s$,'%permission denied%');
select pg_temp.expect_failure($s$select public.mark_grant_application_duplicate(null,null,null,null)$s$,'%permission denied%');
reset role;
rollback;
