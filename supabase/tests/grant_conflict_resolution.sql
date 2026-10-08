-- Isolated rollback fixtures for replacement eligibility and retained peer/history.
-- Conflicts use in-app attention only.
begin;
insert into auth.users(id,email) select ('dd000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,'conflict-' ||i||'@example.invalid' from generate_series(1,8) i;
insert into public.user_program_access(user_id,program_id,access_role)
select ('dd000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid,p.id,case when i in (1,7) then 'admin' when i=8 then 'viewer' else 'reviewer' end::public.program_access_role
from generate_series(1,8) i cross join public.programs p where p.slug='business_growth_grant';
update auth.users set banned_until=now()+interval '1 day' where id='dd000000-0000-4000-8000-000000000007';
update auth.users set deleted_at=now() where id='dd000000-0000-4000-8000-000000000006';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select 'dd000000-0000-4000-9000-000000000099',id,'conflict-fixture','Synthetic conflict business' from public.programs where slug='business_growth_grant';
insert into public.business_grant_application_details(application_id,business_name)
values('dd000000-0000-4000-9000-000000000099','Synthetic conflict business');
insert into public.application_documents(application_id,label,external_url)
values('dd000000-0000-4000-9000-000000000099','Synthetic PDF','https://example.invalid/synthetic.pdf');
insert into storage.objects(bucket_id,name)
values('business-grant-documents','dd000000-0000-4000-9000-000000000099/synthetic.pdf');
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare p uuid;a uuid:='dd000000-0000-4000-9000-000000000099'; own uuid;other uuid;r uuid;replacement uuid;k text;begin
 select id into p from public.programs where slug='business_growth_grant';
 foreach k in array array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025'] loop perform public.set_grant_requirement(a,k,'verified');end loop;
 perform public.confirm_grant_eligibility(a,'eligible');
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a,p,'dd000000-0000-4000-8000-000000000002',auth.uid()) returning id into own;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a,p,'dd000000-0000-4000-8000-000000000003',auth.uid()) returning id into other;
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000002',true);
 perform public.declare_grant_no_conflict(own);
 if not exists(select 1 from public.portal_applications where id=a) then raise exception 'Assigned reviewer missing application before disclosure';end if;
 if not exists(select 1 from public.application_documents where application_id=a) then raise exception 'Assigned reviewer missing document before disclosure';end if;
 if not exists(select 1 from storage.objects where name=a::text||'/synthetic.pdf') then raise exception 'Assigned reviewer missing private storage before disclosure';end if;
 r:=public.report_grant_conflict(own,'Synthetic reported conflict requiring administrator attention');
 if not exists(select 1 from public.grant_conflict_declarations where assignment_id=own) then raise exception 'Earlier no-conflict audit record lost';end if;
 if exists(select 1 from public.portal_applications where id=a)
 or exists(select 1 from public.business_grant_application_details where application_id=a)
 or exists(select 1 from public.application_documents where application_id=a)
 or exists(select 1 from storage.objects where name=a::text||'/synthetic.pdf') then raise exception 'Held reviewer retained protected materials';end if;
 if exists(select 1 from public.program_rankings where application_id=a) then raise exception 'Reviewer accessed committee rankings';end if;
 if public.report_grant_conflict(own,'Same persisted report')<>r then raise exception 'Duplicate conflict report created';end if;
 begin perform public.grant_conflict_replacement_candidates(r); raise exception 'Reviewer accessed candidates';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
 if not exists(select 1 from public.portal_applications where id=a) then raise exception 'Admin lost conflict resolution visibility';end if;
 perform public.resolve_grant_conflict(r,'cleared','Synthetic documented clearance');
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000002',true);
 if not exists(select 1 from public.application_documents where application_id=a) then raise exception 'Cleared reviewer access not restored';end if;
 r:=public.report_grant_conflict(own,'A different newly discovered synthetic conflict');
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000003',true);
 if not exists(select 1 from public.application_documents where application_id=a) then raise exception 'Unaffected reviewer lost access';end if;
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
 if exists(select 1 from public.grant_conflict_replacement_candidates(r) where id in ('dd000000-0000-4000-8000-000000000002','dd000000-0000-4000-8000-000000000003','dd000000-0000-4000-8000-000000000006','dd000000-0000-4000-8000-000000000007','dd000000-0000-4000-8000-000000000008')) then raise exception 'Invalid replacement projected';end if;
 if not exists(select 1 from public.grant_conflict_replacement_candidates(r) where id='dd000000-0000-4000-8000-000000000004' and active_applications=0) then raise exception 'Eligible replacement missing';end if;
 begin perform public.resolve_grant_conflict(r,'replaced','Banned replacement fixture','dd000000-0000-4000-8000-000000000007');raise exception 'Banned replacement accepted';exception when others then if sqlerrm not like 'Choose a different authorized%' then raise;end if;end;
 begin perform public.resolve_grant_conflict(r,'replaced','Existing peer fixture','dd000000-0000-4000-8000-000000000003');raise exception 'Peer replacement accepted';exception when others then if sqlerrm not like 'Choose a different authorized%' then raise;end if;end;
 perform set_config('test.conflict.report',r::text,true);
 perform set_config('test.conflict.other',other::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r uuid:=current_setting('test.conflict.report')::uuid;replacement uuid;begin
 replacement:=public.resolve_grant_conflict(r,'replaced','Synthetic confirmed replacement','dd000000-0000-4000-8000-000000000004');
 if (select lifecycle from public.reviewer_assignments where id=current_setting('test.conflict.other')::uuid)<>'active' then raise exception 'Unaffected peer changed';end if;
 if not exists(select 1 from public.grant_conflict_resolutions where report_id=r and replacement_assignment_id=replacement) then raise exception 'Replacement relationship lost';end if;
 if (select count(*) from public.grant_conflict_reports)<>2 then raise exception 'Disclosure audit history changed';end if;
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000002',true);
 if exists(select 1 from public.application_documents where application_id='dd000000-0000-4000-9000-000000000099') then raise exception 'Replaced reviewer regained materials';end if;
 perform set_config('request.jwt.claim.sub','dd000000-0000-4000-8000-000000000004',true);
 if not exists(select 1 from public.application_documents where application_id='dd000000-0000-4000-9000-000000000099') then raise exception 'Replacement reviewer lacks materials';end if;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.grant_conflict_replacement_candidates('dd000000-0000-4000-9000-000000000099');raise exception 'Anonymous candidate access';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 if to_regclass('public.notification_events') is not null or to_regclass('public.notification_deliveries') is not null then raise exception 'Email outbox remains installed';end if;
end $$;
rollback;
