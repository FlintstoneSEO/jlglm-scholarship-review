-- Synthetic, isolated, rollback-only coverage. Never run fixtures on production.
begin;
insert into auth.users(id,email)
select ('ee000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,
       'odd-count-'||i||'@example.invalid' from generate_series(1,7) i;
insert into public.user_program_access(user_id,program_id,access_role)
select ('ee000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,
       case when i=1 then 'admin' else 'reviewer' end::public.program_access_role
from generate_series(1,7) i cross join public.programs p where p.slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select ('ee000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,
       'odd-fixture-'||i,'Synthetic odd-count application '||i
from generate_series(1,7) i cross join public.programs p where p.slug='business_growth_grant';
select set_config('request.jwt.claim.sub','ee000000-0000-4000-8000-000000000001',true);
select public.set_grant_requirement(a.id,k,'verified','Synthetic verified evidence')
from public.portal_applications a cross join unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) k
where a.external_submission_id like 'odd-fixture-%' and a.external_submission_id<>'odd-fixture-6';
select public.confirm_grant_eligibility(id,'eligible','Synthetic human confirmation')
from public.portal_applications where external_submission_id like 'odd-fixture-%' and external_submission_id<>'odd-fixture-6';
insert into public.reviewer_assignments(application_id,program_id,reviewer_id,lifecycle)
select 'ee000000-0000-4000-9000-000000000007',id,'ee000000-0000-4000-8000-000000000002','suspended'
from public.programs where slug='business_growth_grant';
set local role authenticated;
do $$ declare
 p uuid; roster uuid[]; g uuid[]; preview uuid; followup uuid; result jsonb;
 allocation jsonb; original_assignment jsonb; original_eligibility jsonb; finalized jsonb;
 counts integer[]; ready bigint; total bigint;
begin
 select id into p from public.programs where slug='business_growth_grant';
 select array_agg(('ee000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid order by i) into roster from generate_series(2,7) i;
 g:=array[
   public.save_grant_reviewer_group(p,'Odd group 1',roster[1:2]),
   public.save_grant_reviewer_group(p,'Odd group 2',roster[3:4]),
   public.save_grant_reviewer_group(p,'Odd group 3',roster[5:6])];
 select to_jsonb(a) into original_assignment from public.reviewer_assignments a where application_id='ee000000-0000-4000-9000-000000000007';
 select jsonb_agg(to_jsonb(e) order by e.id) into original_eligibility from public.application_eligibility_reviews e where program_id=p;
 select eligible_applications,total_applications into ready,total from public.grant_distribution_pool_summary(p);
 if ready<>5 or total<>7 then raise exception 'Available/excluded pool counts incorrect';end if;
 begin perform public.preview_grant_group_allocation(p,array[g[1],g[1],g[3]],'balanced'); raise exception 'Duplicate group accepted';
 exception when others then if sqlerrm not like 'Select three distinct%' then raise;end if;end;
 preview:=public.preview_grant_group_allocation(p,g,'balanced');
 select a.allocation into allocation from public.grant_allocation_previews a where id=preview;
 select array_agg(n order by pair) into counts from (
   select pair,count(*)::integer n from jsonb_array_elements(allocation) entry
   cross join lateral (select (entry->>'pair')::integer pair) v group by pair
 ) c;
 if counts<>array[2,2,1] then raise exception 'Odd count is not balanced: %',counts;end if;
 if exists(select 1 from jsonb_array_elements(allocation) e where e->>'applicationId' in ('ee000000-0000-4000-9000-000000000006','ee000000-0000-4000-9000-000000000007')) then raise exception 'Unscreened or historical assignment distributed';end if;
 if (select count(*) from public.reviewer_assignments where program_id=p)<>1 then raise exception 'Preview created assignments';end if;
 result:=public.apply_grant_pair_allocation(preview);
 if (result->>'assignments')::integer<>10 then raise exception 'Odd count individual assignments incorrect';end if;
 select to_jsonb(a) into finalized from public.grant_allocation_previews a where id=preview;
 followup:=public.preview_grant_group_allocation(p,g,'balanced');
 if (select to_jsonb(a) from public.grant_allocation_previews a where id=preview)<>finalized then raise exception 'New preview overwrote finalized allocation';end if;
 perform public.apply_grant_pair_allocation(preview);
 if (select count(*) from public.reviewer_assignments where program_id=p)<>11 then raise exception 'Finalize retry changed assignments';end if;
 if (select to_jsonb(a) from public.reviewer_assignments a where application_id='ee000000-0000-4000-9000-000000000007')<>original_assignment then raise exception 'Existing assignment changed';end if;
 if (select jsonb_agg(to_jsonb(e) order by e.id) from public.application_eligibility_reviews e where program_id=p)<>original_eligibility then raise exception 'Distribution changed eligibility';end if;
end $$;
reset role;
rollback;
