begin;
insert into auth.users(id,email) values
 ('eb000000-0000-4000-8000-000000000001','batch-admin@example.invalid'),
 ('eb000000-0000-4000-8000-000000000002','batch-reviewer@example.invalid');
insert into public.user_program_access(user_id,program_id,access_role)
select actor,id,role::public.program_access_role from public.programs cross join (values
 ('eb000000-0000-4000-8000-000000000001'::uuid,'admin'),
 ('eb000000-0000-4000-8000-000000000002'::uuid,'reviewer')) v(actor,role) where slug='business_growth_grant';
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name)
select 'eb000000-0000-4000-8000-000000000011',id,'batch-test','Batch Test' from public.programs where slug='business_growth_grant';
set local role authenticated;
do $$
declare
 app constant uuid := 'eb000000-0000-4000-8000-000000000011';
 stamp timestamptz;
 payload jsonb;
begin
 perform set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000002',true);
 begin
  perform public.save_grant_eligibility_checklist(app,'[]');
  raise exception 'Reviewer wrote screening';
 exception when others then
  if sqlerrm <> 'Program administrator access is required' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000001',true);
 begin
  perform public.save_grant_eligibility_checklist(app,'[{"key":"owner_eligibility","status":"verified"}]',null,'eligible');
  raise exception 'Incomplete checklist confirmed';
 exception when others then
  if sqlerrm <> 'All six requirements must be verified before confirming Eligible' then raise; end if;
 end;
 if exists(select 1 from public.application_eligibility_reviews where application_id=app) then raise exception 'Failed confirmation left partial writes'; end if;
 select jsonb_agg(jsonb_build_object('key',k,'status','verified','notes','Inspected evidence')) into payload
 from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) k;
 perform public.save_grant_eligibility_checklist(app,payload,null,'eligible');
 if (select status from public.application_eligibility_reviews where application_id=app) <> 'eligible' then raise exception 'Atomic confirmation failed'; end if;
 select updated_at into stamp from public.application_eligibility_reviews where application_id=app;
 begin
  perform public.save_grant_eligibility_checklist(app,'[{"key":"profit_loss_2025","status":"missing"}]',stamp - interval '1 second');
  raise exception 'Stale update succeeded';
 exception when others then
  if sqlerrm <> 'Eligibility changed since you opened it. Reload the application before saving.' then raise; end if;
 end;
 begin
  perform public.save_grant_eligibility_checklist(app,'[{"key":"profit_loss_2025","status":"missing"},{"key":"bad","status":"verified"}]',stamp);
  raise exception 'Invalid key succeeded';
 exception when others then
  if sqlerrm <> 'Invalid eligibility requirement' then raise; end if;
 end;
 if (select status from public.application_eligibility_reviews where application_id=app) <> 'eligible' then raise exception 'Failed batch reset eligibility'; end if;
 perform public.save_grant_eligibility_checklist(app,'[{"key":"profit_loss_2025","status":"needs_clarification","notes":"Wrong year supplied"}]',stamp);
 if (select status from public.application_eligibility_reviews where application_id=app) <> 'not_reviewed' then raise exception 'Progress did not reset confirmation'; end if;
 select updated_at into stamp from public.application_eligibility_reviews where application_id=app;
 begin
  perform public.save_grant_eligibility_checklist(app,'[]',stamp,'ineligible','short');
  raise exception 'Short reason accepted';
 exception when others then
  if sqlerrm <> 'A meaningful reason of at least 10 characters is required' then raise; end if;
 end;
 perform public.save_grant_eligibility_checklist(app,'[]',stamp,'needs_clarification','Wrong year supplied; request replacement');
end $$;
reset role;
rollback;
