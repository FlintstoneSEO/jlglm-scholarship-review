-- Transactional role and scoring-gate regression. Run against a migrated test database.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at) values
 ('e1000000-0000-4000-8000-000000000001','authenticated','authenticated','eligibility-admin@example.invalid','',now()),
 ('e1000000-0000-4000-8000-000000000002','authenticated','authenticated','eligibility-reviewer@example.invalid','',now()),
 ('e1000000-0000-4000-8000-000000000003','authenticated','authenticated','eligibility-viewer@example.invalid','',now()),
 ('e1000000-0000-4000-8000-000000000004','authenticated','authenticated','eligibility-cross@example.invalid','',now());
insert into public.user_program_access(user_id,program_id,access_role)
select v.actor,p.id,v.access_role::public.program_access_role from (values
 ('e1000000-0000-4000-8000-000000000001'::uuid,'business_growth_grant','admin'),
 ('e1000000-0000-4000-8000-000000000002'::uuid,'business_growth_grant','reviewer'),
 ('e1000000-0000-4000-8000-000000000003'::uuid,'business_growth_grant','viewer'),
 ('e1000000-0000-4000-8000-000000000004'::uuid,'scholarship','reviewer')
) v(actor,slug,access_role) join public.programs p on p.slug=v.slug;
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,submitted_at)
select 'e1000000-0000-4000-8000-000000000011',id,'eligibility-test','Eligibility Test',now()
from public.programs where slug='business_growth_grant';
insert into public.business_grant_application_details(application_id,business_name)
values ('e1000000-0000-4000-8000-000000000011','Eligibility Test Business');
insert into public.reviewer_assignments(application_id,program_id,reviewer_id)
select 'e1000000-0000-4000-8000-000000000011',id,'e1000000-0000-4000-8000-000000000002'
from public.programs where slug='business_growth_grant';

set local role authenticated;
do $$
declare
  app constant uuid := 'e1000000-0000-4000-8000-000000000011';
  admin_actor constant uuid := 'e1000000-0000-4000-8000-000000000001';
  reviewer constant uuid := 'e1000000-0000-4000-8000-000000000002';
  viewer constant uuid := 'e1000000-0000-4000-8000-000000000003';
  cross_actor constant uuid := 'e1000000-0000-4000-8000-000000000004';
  program_id uuid; assignment_id uuid; version_id uuid; criterion_id uuid; v_review_id uuid;
  score_input jsonb; result jsonb; current_version integer;
  requirement_key text;
begin
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  select id into strict program_id from public.programs where slug='business_growth_grant';
  select id into strict assignment_id from public.reviewer_assignments where application_id=app;
  version_id := public.create_rubric_version(program_id,null);
  insert into public.rubric_criteria(program_id,rubric_version_id,name,maximum_points,display_order)
    values(program_id,version_id,'Eligibility test criterion',100,1) returning id into criterion_id;
  perform public.activate_rubric_version(program_id,version_id);
  score_input := jsonb_build_array(jsonb_build_object('criterionId',criterion_id,'value',50));

  if (select count(*) from public.application_eligibility_reviews where application_id=app) <> 0 then
    raise exception 'Test application unexpectedly has eligibility decision';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  perform public.declare_grant_no_conflict(assignment_id);
  begin
    perform public.submit_business_grant_review(app,assignment_id,null,0,version_id,score_input,'Draft','save_draft','eligibility-locked-1');
    raise exception 'not_reviewed allowed score mutation';
  exception when others then
    if sqlerrm <> 'review_submission:eligibility_locked:Competitive scoring is locked until eligibility is confirmed' then raise; end if;
  end;
  begin
    perform public.set_grant_requirement(app,'owner_eligibility','verified','Yes is not proof');
    raise exception 'Reviewer changed screening';
  exception when others then
    if sqlerrm <> 'Program administrator access is required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  begin
    perform public.set_grant_requirement(app,'owner_eligibility','verified','Viewer denied');
    raise exception 'Viewer changed screening';
  exception when others then
    if sqlerrm <> 'Program administrator access is required' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',cross_actor::text,true);
  begin
    perform public.confirm_grant_eligibility(app,'eligible',null);
    raise exception 'Cross-program reviewer confirmed eligibility';
  exception when others then
    if sqlerrm <> 'Program administrator access is required' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  foreach requirement_key in array array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025'] loop
    perform public.set_grant_requirement(app,requirement_key,'verified','Human verification');
  end loop;
  if (select count(*) from public.eligibility_review_items i join public.application_eligibility_reviews r on r.id=i.eligibility_review_id where r.application_id=app) <> 6 then
    raise exception 'Six requirement records were not stored';
  end if;
  perform public.confirm_grant_eligibility(app,'eligible',null);
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  if (select count(*) from public.application_eligibility_reviews where application_id=app) <> 1 then
    raise exception 'Grant viewer could not read permitted screening';
  end if;
  perform set_config('request.jwt.claim.sub',cross_actor::text,true);
  if (select count(*) from public.application_eligibility_reviews where application_id=app) <> 0 then
    raise exception 'Cross-program actor could read screening';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  if (select count(*) from public.eligibility_review_items i join public.application_eligibility_reviews r on r.id=i.eligibility_review_id where r.application_id=app) <> 6 then
    raise exception 'Assigned Grant reviewer could not read screening';
  end if;
  result := public.submit_business_grant_review(app,assignment_id,null,0,version_id,score_input,'Draft','save_draft','eligibility-allowed-1');
  v_review_id := (result->>'reviewId')::uuid;
  if (select count(*) from public.review_scores rs where rs.review_id=v_review_id) <> 1 then raise exception 'Eligible scoring did not persist'; end if;
  current_version := (result->>'version')::integer;

  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  perform public.confirm_grant_eligibility(app,'needs_clarification','Additional verification is required');
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  begin
    perform public.submit_business_grant_review(app,assignment_id,v_review_id,current_version,version_id,score_input,'Changed','save_draft','eligibility-locked-2');
    raise exception 'needs_clarification allowed score mutation';
  exception when others then
    if sqlerrm <> 'review_submission:eligibility_locked:Competitive scoring is locked until eligibility is confirmed' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  perform public.confirm_grant_eligibility(app,'ineligible','Mandatory requirement was not met');
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  begin
    perform public.submit_business_grant_review(app,assignment_id,v_review_id,current_version,version_id,score_input,'Changed','save_draft','eligibility-locked-3');
    raise exception 'ineligible allowed score mutation';
  exception when others then
    if sqlerrm <> 'review_submission:eligibility_locked:Competitive scoring is locked until eligibility is confirmed' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  begin
    perform public.set_grant_scoring_override(app,true,'short');
    raise exception 'Override accepted short reason';
  exception when others then
    if sqlerrm <> 'An override action and meaningful reason are required' then raise; end if;
  end;
  perform public.set_grant_scoring_override(app,true,'Documented program exception');
  if (select count(*) from public.eligibility_scoring_overrides o join public.application_eligibility_reviews r on r.id=o.eligibility_review_id where r.application_id=app and o.admin_user_id=admin_actor and o.original_status='ineligible' and o.scoring_allowed) <> 1 then
    raise exception 'Override audit record missing';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  result := public.submit_business_grant_review(app,assignment_id,v_review_id,current_version,version_id,score_input,'Override draft','save_draft','eligibility-allowed-2');
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  perform public.set_grant_scoring_override(app,false,'Exception period concluded');
  if (select count(*) from public.review_scores rs where rs.review_id=v_review_id) <> 1 then raise exception 'Historical score was deleted'; end if;
  if (select count(*) from public.eligibility_scoring_overrides o join public.application_eligibility_reviews r on r.id=o.eligibility_review_id where r.application_id=app) <> 2 then
    raise exception 'Override audit history was overwritten';
  end if;
end $$;

reset role;
do $$ begin
  if has_table_privilege('anon','public.application_eligibility_reviews','SELECT')
    or has_table_privilege('anon','public.application_eligibility_reviews','INSERT')
    or has_table_privilege('anon','public.eligibility_review_items','UPDATE')
    or has_table_privilege('anon','public.eligibility_review_items','SELECT')
    or has_table_privilege('anon','public.eligibility_scoring_overrides','SELECT')
    or has_table_privilege('authenticated','public.application_eligibility_reviews','UPDATE') then
    raise exception 'Eligibility table privileges are too broad';
  end if;
end $$;
rollback;
