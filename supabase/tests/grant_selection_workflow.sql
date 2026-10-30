-- Isolated synthetic fixtures, rolled back. Never use production as a test fixture.
begin;
insert into auth.users(id,email) select ('ad000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'selection-'||i||'@example.invalid' from generate_series(1,4)i;
insert into public.user_program_access(user_id,program_id,access_role) select ('ad000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,case when i=1 then 'admin' when i=2 then 'reviewer' else 'viewer' end::public.program_access_role from generate_series(1,3)i cross join public.programs p where slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name) select ('ad000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,'selection-'||i,'Synthetic selection '||i from generate_series(1,5)i cross join public.programs p where slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,is_test) select 'ad000000-0000-4000-9000-000000000006',id,'selection-test','Synthetic test',true from public.programs where slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name) select 'ad000000-0000-4000-9000-000000000007',id,'selection-cross','Synthetic cross program' from public.programs where slug='scholarship';
set local role authenticated;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000001',true);
do $$ declare p uuid; ids uuid[]; bad uuid[]; r uuid[]; msg text; begin
 select id into p from public.programs where slug='business_growth_grant';
 select array_agg(('ad000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid order by i) into ids from generate_series(1,5)i;
 foreach bad slice 1 in array array[ids[1:2],array[ids[1],ids[1]],array[ids[1],null::uuid]] loop
 begin perform public.save_grant_selection(p,bad,'{}',0);raise exception 'TEST: invalid finalist count accepted';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 end loop;
 begin perform public.save_grant_selection(p,ids[1:3],ids[1:2],0);raise exception 'TEST: unsaved finalists finalized';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 foreach bad slice 1 in array array[array[ids[1],ids[2],ids[2]],array[ids[1],ids[2],null::uuid],array[ids[1],ids[2],'ad000000-0000-4000-9000-000000000006'::uuid],array[ids[1],ids[2],'ad000000-0000-4000-9000-000000000007'::uuid]] loop
 begin perform public.save_grant_selection(p,bad,'{}',0);raise exception 'TEST: invalid finalist identity accepted';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 end loop;
 perform public.save_grant_selection(p,ids[1:3],'{}',0);
 begin perform public.save_grant_selection(p,ids[2:4],'{}',0);raise exception 'TEST: stale write accepted';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 foreach r slice 1 in array array[array[ids[1],ids[1]],array[ids[1],ids[4]],array[ids[1],null::uuid]] loop
 begin perform public.save_grant_selection(p,ids[1:3],r,1);raise exception 'TEST: invalid recipients accepted';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 end loop;
 if (select count(*) from public.grant_selection_history where program_id=p)<>1 then raise exception 'Failed writes changed history';end if;
 perform public.save_grant_selection(p,ids[1:3],ids[1:2],1);
 if (select cardinality(finalist_ids)<>3 or cardinality(recipient_ids)<>2 or revision<>2 or finalized_at is null from public.grant_selection_decisions where program_id=p) then raise exception 'Final state invalid';end if;
 begin perform public.save_grant_selection(p,ids[2:4],'{}',2);raise exception 'TEST: finalized record edited';exception when others then if sqlerrm like 'TEST:%' then raise;end if;end;
 perform public.grant_selection_groups(p);
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.grant_selection_decisions) or exists(select 1 from public.grant_selection_history) then raise exception 'Reviewer read allowed';end if;
 begin perform public.save_grant_selection('22222222-2222-4222-8222-222222222222','{}','{}',0);raise exception 'Reviewer write allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub','ad000000-0000-4000-8000-000000000003',true);
do $$ begin if exists(select 1 from public.grant_selection_decisions) then raise exception 'Viewer read allowed';end if;end $$;
reset role;
rollback;
