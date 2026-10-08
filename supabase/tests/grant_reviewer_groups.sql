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

set local role authenticated;
do $$
declare p uuid; roster uuid[]; g1 uuid; g2 uuid; g3 uuid; preview uuid; result jsonb; snap jsonb;
begin
 select id into p from public.programs where slug='business_growth_grant';
 select array_agg(('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid order by i) into roster from generate_series(2,7) i;
 g1:=public.save_grant_reviewer_group(p,'First pair',roster[1:2]);
 g2:=public.save_grant_reviewer_group(p,'Second pair',roster[3:4]);
 g3:=public.save_grant_reviewer_group(p,'Third pair',roster[5:6]);
 if (select count(*) from public.grant_reviewer_group_members)<>6 then raise exception 'Members not saved'; end if;
 begin perform public.save_grant_reviewer_group(p,'Missing user',array['cc000000-0000-4000-8000-999999999999'::uuid]); raise exception 'Nonexistent account accepted';
 exception when others then if sqlerrm not like 'Select distinct existing%' then raise; end if; end;
 begin perform public.save_grant_reviewer_group(p,'Wrong program',array['cc000000-0000-4000-8000-000000000008'::uuid]); raise exception 'Wrong program accepted';
 exception when others then if sqlerrm not like 'Select distinct existing%' then raise; end if; end;
 begin perform public.save_grant_reviewer_group(p,'Duplicates',array[roster[1],roster[1]]); raise exception 'Duplicates accepted';
 exception when others then if sqlerrm not like 'Select distinct existing%' then raise; end if; end;
 begin perform public.save_grant_reviewer_group(p,'Renamed',roster[1:2],g1,9); raise exception 'Stale revision accepted';
 exception when others then if sqlerrm not like 'Stale group:%' then raise; end if; end;
 if (select name from public.grant_reviewer_groups where id=g1)<>'First pair' then raise exception 'Failed edit mutated group'; end if;
 begin perform public.save_grant_reviewer_group(p,'First pair',roster[5:6],g2,1); raise exception 'Duplicate name edit accepted';
 exception when unique_violation then null; end;
 if (select revision from public.grant_reviewer_groups where id=g2)<>1 or (select count(*) from public.grant_reviewer_group_members where group_id=g2 and user_id=any(roster[3:4]))<>2 then raise exception 'Failed edit changed members/revision'; end if;
 begin perform public.preview_grant_group_allocation(p,array[g1,g1,g3],'balanced'); raise exception 'Duplicate group accepted';
 exception when others then if sqlerrm not like 'Select three distinct%' then raise; end if; end;
 preview:=public.preview_grant_group_allocation(p,array[g1,g2,g3],'balanced');
 select group_snapshot into snap from public.grant_allocation_previews where id=preview;
 if jsonb_array_length(snap)<>3 or snap->0->>'name'<>'First pair' then raise exception 'Missing group snapshot/order'; end if;
 perform public.save_grant_reviewer_group(p,'Third pair',roster[5:5],g3,1);
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Changed member count accepted';
 exception when others then if sqlerrm not like 'Stale preview:%' then raise; end if; end;
 perform public.save_grant_reviewer_group(p,'Third pair',roster[5:6],g3,2);
 perform public.save_grant_reviewer_group(p,'First pair renamed',roster[1:2],g1,1);
 begin perform public.apply_grant_pair_allocation(preview); raise exception 'Changed group preview accepted';
 exception when others then if sqlerrm not like 'Stale preview:%' then raise; end if; end;
 if (select count(*) from public.reviewer_assignments where program_id=p)<>1 then raise exception 'Stale group left partial allocation'; end if;
 if (select group_snapshot from public.grant_allocation_previews where id=preview)<>snap then raise exception 'Frozen history mutated'; end if;
 perform public.save_grant_reviewer_group(p,'Second pair',array[roster[1],roster[4]],g2,1);
 begin perform public.preview_grant_group_allocation(p,array[g1,g2,g3],'balanced'); raise exception 'Overlap accepted';
 exception when others then if sqlerrm not like 'Select six distinct%' then raise; end if; end;
 perform public.save_grant_reviewer_group(p,'Second pair',roster[3:4],g2,2);
 perform public.save_grant_reviewer_group(p,'Third pair',roster[5:5],g3,3);
 begin perform public.preview_grant_group_allocation(p,array[g1,g2,g3],'balanced'); raise exception 'One-person pair accepted';
 exception when others then if sqlerrm not like 'Each saved pair%' then raise; end if; end;
 perform public.save_grant_reviewer_group(p,'Third pair',roster[5:6],g3,4);
 preview:=public.preview_grant_group_allocation(p,array[g1,g2,g3],'balanced');
 result:=public.apply_grant_pair_allocation(preview);
 if (result->>'assignments')::integer<>80 then raise exception 'Group allocation coverage changed'; end if;
 perform public.save_grant_reviewer_group(p,'Future group',array[roster[5],roster[1]],g3,5);
 result:=public.apply_grant_pair_allocation(preview);
 if result->>'replayed'<>'true' or (select count(*) from public.reviewer_assignments where program_id=p)<>81 then raise exception 'Applied history/retry changed after group edit'; end if;
 perform set_config('request.jwt.claim.sub',roster[1]::text,true);
 if exists(select 1 from public.grant_reviewer_groups) or exists(select 1 from public.grant_reviewer_group_members) then raise exception 'Reviewer sees admin groups'; end if;
 begin perform public.save_grant_reviewer_group(p,'Unauthorized',roster[1:2]); raise exception 'Reviewer saved group';
 exception when insufficient_privilege then null; end;
 begin insert into public.grant_reviewer_group_members values(g1,roster[3]); raise exception 'Direct membership write allowed';
 exception when insufficient_privilege then null; end;
 begin update public.grant_reviewer_groups set name='Unsafe' where id=g1; raise exception 'Direct group write allowed';
 exception when insufficient_privilege then null; end;
 if has_function_privilege('anon','public.save_grant_reviewer_group(uuid,text,uuid[],uuid,integer)','execute') then raise exception 'Anonymous RPC allowed'; end if;
end $$;
rollback;
