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
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,is_test)
select ('cc000000-0000-4000-9000-'||lpad(i::text,12,'0'))::uuid,p.id,'committee-fixture-'||i,'Synthetic application '||i,(i between 6 and 40)
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

-- Keep five eligible real fixtures. Other eligible records are test-only and excluded.
set local role authenticated;
do $$
declare p uuid; roster uuid[]; preview uuid; alloc jsonb; result jsonb; prior jsonb;
begin
 select id into p from public.programs where slug='business_growth_grant';
 select array_agg(('cc000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid order by i) into roster from generate_series(2,7) i;
 select jsonb_agg(to_jsonb(a)) into prior from public.reviewer_assignments a where program_id=p;
 preview:=public.preview_grant_pair_allocation(p,roster,'balanced');
 select allocation into alloc from public.grant_allocation_previews where id=preview;
 if jsonb_array_length(alloc)<>5 then raise exception 'Odd eligible pool must contain five'; end if;
 if (select array_agg(n order by pair) from (select e->>'pair' pair,count(*) n from jsonb_array_elements(alloc) e group by 1) q)<>array[2::bigint,2,1] then raise exception 'Expected 2/2/1'; end if;
 if exists(select 1 from jsonb_array_elements(alloc) e join public.portal_applications a on a.id=(e->>'applicationId')::uuid where a.is_test or a.external_submission_id in ('committee-fixture-41','committee-fixture-42','committee-fixture-43')) then raise exception 'Excluded or unscreened application allocated'; end if;
 preview:=public.preview_grant_pair_allocation(p,roster,'fixed',1);
 select allocation into alloc from public.grant_allocation_previews where id=preview;
 if (select count(*) from jsonb_array_elements(alloc) e where e->>'pair' is null)<>2 then raise exception 'Expected two fixed-capacity leftovers'; end if;
 preview:=public.preview_grant_pair_allocation(p,roster,'balanced');
 result:=public.apply_grant_pair_allocation(preview);
 if (result->>'assignments')::integer<>10 then raise exception 'Expected ten new assignments'; end if;
 if not (select jsonb_agg(to_jsonb(a)) from public.reviewer_assignments a where program_id=p) @> prior then raise exception 'Existing assignment changed'; end if;
 result:=public.apply_grant_pair_allocation(preview);
 if result->>'replayed'<>'true' or (select count(*) from public.reviewer_assignments where program_id=p)<>11 then raise exception 'Finalized replay changed assignments'; end if;
end $$;
rollback;
