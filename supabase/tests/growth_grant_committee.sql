-- Synthetic rollback-only test; never run against production as a fixture.
begin;
insert into auth.users(id,email)
select ('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'committee-'||i||'@example.invalid' from generate_series(1,8) i;
insert into public.user_program_access(user_id,program_id,access_role)
select ('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,
 case when i=1 then 'admin' else 'reviewer' end::public.program_access_role
from generate_series(1,7) i cross join public.programs p where p.slug='business_growth_grant';
insert into public.user_program_access(user_id,program_id,access_role)
select 'cc000000-0000-4000-8000-000000000008',id,'reviewer' from public.programs where slug='scholarship';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select ('cc000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,'committee-fixture-'||i,'Synthetic application '||i
from generate_series(1,43) i cross join public.programs p where p.slug='business_growth_grant';
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid; v uuid; begin
select id into p from public.programs where slug='business_growth_grant';
v:=public.create_rubric_version(p,null);
insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order) values(p,v,'Synthetic test criterion',100,1);
perform public.activate_rubric_version(p,v); end $$;
select public.set_grant_requirement(a.id,k,'verified','Synthetic human verification')
from public.portal_applications a cross join unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) k
where a.external_submission_id like 'committee-fixture-%' and a.external_submission_id<>'committee-fixture-41';
select public.confirm_grant_eligibility(id,'eligible','Synthetic human confirmation') from public.portal_applications
where external_submission_id like 'committee-fixture-%' and external_submission_id<>'committee-fixture-41';
insert into public.reviewer_assignments(application_id,program_id,reviewer_id,lifecycle)
select 'cc000000-0000-4000-9000-000000000042',id,'cc000000-0000-4000-8000-000000000002','suspended' from public.programs where slug='business_growth_grant';
insert into public.review_idempotency_keys(actor_id,program_id,application_id,intent,idempotency_key,request_hash)
select 'cc000000-0000-4000-8000-000000000002',id,'cc000000-0000-4000-9000-000000000043','save_draft','fixture-history','fixture' from public.programs where slug='business_growth_grant';
create function pg_temp.fail_second_assignment() returns trigger language plpgsql as $$
begin
 if current_setting('test.committee.force_failure',true)='yes' and new.reviewer_id='cc000000-0000-4000-8000-000000000003' then raise exception 'fixture forced failure'; end if;
 return new;
end $$;
create trigger test_committee_failure before insert on public.reviewer_assignments for each row execute function pg_temp.fail_second_assignment();
set local role authenticated;
do $$
declare
 p uuid; roster uuid[]; preview uuid; old_preview uuid; snap jsonb; alloc jsonb; result jsonb; aid uuid; assignment uuid;
 version_id uuid; own_review uuid; peer_assignment uuid; peer_review uuid; conflict uuid; actor uuid;
begin
 select id into p from public.programs where slug='business_growth_grant';
 select array_agg(('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid order by i) into roster from generate_series(2,7) i;
 preview:=public.preview_grant_pair_allocation(p,roster,'balanced');
 select snapshot,allocation into snap,alloc from public.grant_allocation_previews where id=preview;
 if jsonb_array_length(snap)<>43 or jsonb_array_length(alloc)<>40 then raise exception 'Incorrect pool/exclusions'; end if;
 if (select count(*) from jsonb_array_elements(snap) e where e->>'exclusion' is not null)<>3 then raise exception 'Excluded records missing'; end if;
 if (select count(distinct e->>'applicationId') from jsonb_array_elements(alloc) e)<>40 then raise exception 'Duplicate/missing coverage'; end if;
 if (select array_agg(n order by pair) from (select e->>'pair' pair,count(*) n from jsonb_array_elements(alloc) e group by 1) q)<>array[14::bigint,13,13] then raise exception 'Expected 14/13/13'; end if;
 if exists(select 1 from jsonb_array_elements(alloc) e where jsonb_array_length(e->'reviewers')<>2 or e->'reviewers'->>0=e->'reviewers'->>1) then raise exception 'Invalid reviewer pair'; end if;
 if (select allocation from public.grant_allocation_previews where id=preview)<>alloc then raise exception 'Reopen reshuffled'; end if;
 old_preview:=preview;
 preview:=public.preview_grant_pair_allocation(p,roster,'fixed',13);
 select allocation into alloc from public.grant_allocation_previews where id=preview;
 if (select count(*) from jsonb_array_elements(alloc) e where e->>'pair' is null)<>1 then raise exception 'Fixed 13 lost unallocated application'; end if;
 begin perform public.apply_grant_pair_allocation(old_preview); raise exception 'Superseded preview applied';
 exception when others then if sqlerrm not like 'Stale preview:%' then raise; end if; end;
 begin perform public.preview_grant_pair_allocation(p,roster[1:5]||roster[1],'balanced'); raise exception 'Duplicate roster allowed';
 exception when others then if sqlerrm not like 'Select six distinct%' then raise; end if; end;
 begin perform public.preview_grant_pair_allocation(p,roster[1:5]||'cc000000-0000-4000-8000-000000000008'::uuid,'balanced'); raise exception 'Cross-program roster allowed';
 exception when others then if sqlerrm not like 'Select six distinct%' then raise; end if; end;
 begin perform public.preview_grant_pair_allocation(p,roster,null); raise exception 'Implicit capacity allowed';
 exception when others then if sqlerrm not like 'Choose balanced%' then raise; end if; end;
 preview:=public.preview_grant_pair_allocation(p,roster,'balanced');
 perform public.set_grant_requirement('cc000000-0000-4000-9000-000000000001','owner_eligibility','verified','Reverification fixture');
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Stale eligibility applied';
 exception when others then if sqlerrm not like 'Stale preview:%' then raise; end if; end;
 perform public.confirm_grant_eligibility('cc000000-0000-4000-9000-000000000001','eligible');
 preview:=public.preview_grant_pair_allocation(p,roster,'balanced');
 delete from public.user_program_access where user_id=roster[6] and program_id=p;
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Revoked membership applied';
 exception when others then if sqlerrm not like 'Select six distinct%' then raise; end if; end;
 insert into public.user_program_access(user_id,program_id,access_role) values(roster[6],p,'reviewer');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id) values('cc000000-0000-4000-9000-000000000001',p,roster[1]);
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Stale assignment applied';
 exception when others then if sqlerrm not like 'Stale preview:%' then raise; end if; end;
 delete from public.reviewer_assignments where application_id='cc000000-0000-4000-9000-000000000001';
 -- Fail after the first member of a pair is inserted. Entire RPC subtransaction rolls back.
 perform set_config('test.committee.force_failure','yes',true);
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Forced failure did not happen';
 exception when others then if sqlerrm<>'fixture forced failure' then raise; end if; end;
 perform set_config('test.committee.force_failure','no',true);
 if (select count(*) from public.reviewer_assignments where program_id=p)<>1 then raise exception 'Partial assignments remained'; end if;
 if (select applied_at from public.grant_allocation_previews where id=preview) is not null then raise exception 'Failed preview marked applied'; end if;
 result:=public.apply_grant_pair_allocation(preview);
 if (result->>'assignments')::integer<>80 then raise exception 'Expected 80 individual assignments'; end if;
 result:=public.apply_grant_pair_allocation(preview);
 if result->>'replayed'<>'true' or (select count(*) from public.reviewer_assignments where program_id=p)<>81 then raise exception 'Retry duplicated assignments'; end if;
 if (select lifecycle from public.reviewer_assignments where application_id='cc000000-0000-4000-9000-000000000042')<>'suspended' then raise exception 'Existing work modified'; end if;
 -- Draft, independent peer submission, then a conflict: no draft/score/history is reset.
 select application_id,id into aid,assignment from public.reviewer_assignments where reviewer_id=roster[1] and lifecycle='active' order by application_id limit 1;
 select id into version_id from public.rubric_versions where program_id=p and active;
 select id into peer_assignment from public.reviewer_assignments where application_id=aid and reviewer_id=roster[2];
 perform set_config('request.jwt.claim.sub',roster[1]::text,true);
 result:=public.submit_business_grant_review(aid,assignment,null,0,version_id,'[]','Preserved private draft','save_draft','committee-draft');
 own_review:=(result->>'reviewId')::uuid;
 conflict:=public.report_grant_conflict(assignment,'Potential personal business relationship');
 if public.report_grant_conflict(assignment,'Potential personal business relationship')<>conflict then raise exception 'Report retry duplicated'; end if;
 begin perform public.submit_business_grant_review(aid,assignment,null,0,version_id,'[]','Preserved private draft','save_draft','committee-draft'); raise exception 'Held replay succeeded';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin perform public.submit_business_grant_review(aid,assignment,own_review,1,version_id,'[]','changed','save_draft','committee-held');
 raise exception 'Held canonical save succeeded';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin perform public.submit_business_grant_review(aid,assignment,own_review,1,version_id,'[]','changed','submit','committee-held-submit','grant_reviewer_certification_v1',true);
 raise exception 'Held canonical submission succeeded';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 if (select reviewer_comments from public.program_reviews where id=own_review)<>'Preserved private draft' then raise exception 'Draft changed'; end if;
 perform set_config('request.jwt.claim.sub',roster[2]::text,true);
 if exists(select 1 from public.grant_conflict_reports where id=conflict) or exists(select 1 from public.program_reviews where id=own_review) then raise exception 'Private peer data leaked'; end if;
 result:=public.submit_business_grant_review(aid,peer_assignment,null,0,version_id,
 (select jsonb_agg(jsonb_build_object('criterionId',id,'value',80)) from public.rubric_criteria where rubric_version_id=version_id),
 'Independent private peer review','submit','committee-peer-submit','grant_reviewer_certification_v1',true);
 peer_review:=(result->>'reviewId')::uuid;
 perform public.report_grant_conflict(peer_assignment,'Discovered conflict after submission');
 if (select status from public.program_reviews where id=peer_review)<>'completed' then raise exception 'Submitted review changed'; end if;
 perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000008',true);
 if exists(select 1 from public.grant_conflict_reports) or exists(select 1 from public.grant_allocation_previews) then raise exception 'Cross-program reports/previews leaked'; end if;
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Reviewer applied allocation';
 exception when insufficient_privilege then null; end;
 begin perform public.report_grant_conflict(assignment,'I am not the assigned reviewer'); raise exception 'Non-owner report allowed';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
 if (select completed_review_count from public.portal_applications where id=aid)<>1 or (select average_score from public.portal_applications where id=aid)<>80 then raise exception 'Conflict changed aggregates'; end if;
 if (select count(*) from public.grant_conflict_reports)<>2 then raise exception 'Admin unresolved view missing'; end if;
 -- Save fixture IDs for privileged direct-write tests.
 perform set_config('test.committee.own_review',own_review::text,true);
 perform set_config('test.committee.peer_review',peer_review::text,true);
 perform set_config('test.committee.application',aid::text,true);
end $$;
reset role;
do $$
declare r uuid:=current_setting('test.committee.own_review')::uuid; peer uuid:=current_setting('test.committee.peer_review')::uuid;
begin
 begin update public.program_reviews set reviewer_comments='bypass' where id=r; raise exception 'Privileged direct review write bypassed hold';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin insert into public.review_scores(review_id,criterion_id,points) select r,criterion_id,1 from public.review_scores where review_id=peer; raise exception 'Privileged score insert bypassed hold';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin update public.review_scores set points=1 where review_id=peer; raise exception 'Privileged direct score update bypassed hold';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin delete from public.review_scores where review_id=peer; raise exception 'Privileged score delete bypassed hold';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 begin update public.grant_review_certifications set certified_at=now() where program_review_id=peer; raise exception 'Certification bypassed hold';
 exception when others then if sqlerrm not like 'review_submission:conflict_hold:%' then raise; end if; end;
 if (select reviewer_comments from public.program_reviews where id=r)<>'Preserved private draft' then raise exception 'Draft not preserved'; end if;
 if (select total_score from public.program_reviews where id=peer)<>80 then raise exception 'Submitted score not preserved'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','cc000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid; v uuid; begin
select id into p from public.programs where slug='business_growth_grant';
v:=public.preview_grant_pair_allocation(p,array(select ('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid from generate_series(2,7) i),'balanced');
if (select jsonb_array_length(allocation) from public.grant_allocation_previews where id=v)<>0 then raise exception 'Empty pool not accounted for'; end if;
begin update public.grant_conflict_reports set resolved_at=now(); raise exception 'Unapproved resolution allowed'; exception when insufficient_privilege then null; end;
if has_table_privilege('anon','public.grant_conflict_reports','SELECT') or has_function_privilege('anon','public.report_grant_conflict(uuid,text)','EXECUTE') then raise exception 'Anonymous grant leaked'; end if;
end $$;
rollback;

