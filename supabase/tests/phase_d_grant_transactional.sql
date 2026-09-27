-- Run only with explicit authorization. All fixture writes and role
-- simulations roll back, including temporary rubric activation.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at)
values
 ('d2000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-d-grant-a@example.invalid','',now()),
 ('d2000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-d-grant-b@example.invalid','',now()),
 ('d2000000-0000-4000-8000-000000000003','authenticated','authenticated','phase-d-grant-admin@example.invalid','',now()),
 ('d2000000-0000-4000-8000-000000000004','authenticated','authenticated','phase-d-grant-viewer@example.invalid','',now()),
 ('d2000000-0000-4000-8000-000000000005','authenticated','authenticated','phase-d-cross-reviewer@example.invalid','',now());
insert into public.user_roles(user_id,role) values
 ('d2000000-0000-4000-8000-000000000001','reviewer'),
 ('d2000000-0000-4000-8000-000000000002','reviewer'),
 ('d2000000-0000-4000-8000-000000000005','reviewer');
insert into public.user_program_access(user_id,program_id,access_role)
select v.user_id,p.id,v.access_role::public.program_access_role
from (values
 ('d2000000-0000-4000-8000-000000000001'::uuid,'business_growth_grant','reviewer'),
 ('d2000000-0000-4000-8000-000000000002'::uuid,'business_growth_grant','reviewer'),
 ('d2000000-0000-4000-8000-000000000003'::uuid,'business_growth_grant','admin'),
 ('d2000000-0000-4000-8000-000000000004'::uuid,'business_growth_grant','viewer'),
 ('d2000000-0000-4000-8000-000000000005'::uuid,'scholarship','reviewer')
) v(user_id,slug,access_role) join public.programs p on p.slug=v.slug;
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,submitted_at)
select 'd2000000-0000-4000-8000-000000000011',p.id,'phase-d-rollback-grant','Phase D Grant Rollback','2027-01-15'
from public.programs p where p.slug='business_growth_grant';
insert into public.business_grant_application_details(application_id,business_name)
values ('d2000000-0000-4000-8000-000000000011','Phase D Rollback Business');
insert into public.reviewer_assignments(application_id,program_id,reviewer_id)
select 'd2000000-0000-4000-8000-000000000011',p.id,v.reviewer_id
from public.programs p cross join (values
 ('d2000000-0000-4000-8000-000000000001'::uuid),
 ('d2000000-0000-4000-8000-000000000002'::uuid)
) v(reviewer_id) where p.slug='business_growth_grant';

set local role authenticated;
do $$
declare
  application constant uuid := 'd2000000-0000-4000-8000-000000000011';
  reviewer_a constant uuid := 'd2000000-0000-4000-8000-000000000001';
  reviewer_b constant uuid := 'd2000000-0000-4000-8000-000000000002';
  admin_actor constant uuid := 'd2000000-0000-4000-8000-000000000003';
  viewer_actor constant uuid := 'd2000000-0000-4000-8000-000000000004';
  cross_actor constant uuid := 'd2000000-0000-4000-8000-000000000005';
  grant_program uuid;
  original_version uuid;
  draft_version uuid;
  clone_version uuid;
  blank_version uuid;
  criterion_id uuid;
  assignment_a uuid;
  assignment_b uuid;
  review_a uuid;
  review_b uuid;
  version_a integer;
  result jsonb;
  replay jsonb;
  scores jsonb;
begin
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  select id into strict grant_program from public.programs where slug='business_growth_grant';
  -- This older transactional test exercises scoring, so formally clear the new eligibility gate.
  perform public.set_grant_requirement(application, key, 'verified', 'Rollback fixture verification')
    from unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) as key;
  perform public.confirm_grant_eligibility(application, 'eligible', 'Rollback fixture approval');
  select id into strict original_version from public.rubric_versions where program_id=grant_program and active;
  if (select count(*) from public.rubric_criteria where rubric_version_id=original_version and active) <> 0 then
    raise exception 'Expected empty live Grant v1 rubric';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  select id into strict assignment_a from public.reviewer_assignments where application_id=application and reviewer_id=reviewer_a;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,original_version,'[]'::jsonb,
      'Empty rubric','submit','grant-empty-rubric-1');
    raise exception 'Empty Grant rubric allowed final submission';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  if (select count(*) from public.program_reviews where application_id=application) <> 0 then
    raise exception 'Empty-rubric rejection left a review';
  end if;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  draft_version := public.create_rubric_version(grant_program,original_version);
  insert into public.rubric_criteria(program_id,rubric_version_id,name,description,maximum_points,display_order)
  values(grant_program,draft_version,'Phase D temporary criterion','Rollback-only criterion',7.5,1);
  clone_version := public.create_rubric_version(grant_program,draft_version);
  select id into strict criterion_id from public.rubric_criteria where rubric_version_id=clone_version;
  if criterion_id=(select id from public.rubric_criteria where rubric_version_id=draft_version) then
    raise exception 'Grant rubric clone reused criterion identity';
  end if;
  update public.rubric_criteria set description='Independent clone edit' where id=criterion_id;
  if (select description from public.rubric_criteria where rubric_version_id=draft_version) <> 'Rollback-only criterion' then
    raise exception 'Grant clone edited its source criterion';
  end if;
  perform public.activate_rubric_version(grant_program,clone_version);
  if (select count(*) from public.rubric_versions where program_id=grant_program and active) <> 1
    or not (select retired_at is not null from public.rubric_versions where id=original_version)
    or (select count(*) from public.rubric_criteria where rubric_version_id=original_version) <> 0 then
    raise exception 'Grant version activation/history failed';
  end if;
  blank_version := public.create_rubric_version(grant_program,null);
  begin
    perform public.activate_rubric_version(grant_program,blank_version);
    raise exception 'Empty Grant draft activated';
  exception when others then
    if sqlerrm <> 'A rubric must contain an active criterion before activation' then raise; end if;
  end;
  update public.rubric_criteria set name='Should not edit active' where id=criterion_id;
  if (select name from public.rubric_criteria where id=criterion_id) <> 'Phase D temporary criterion' then
    raise exception 'Active Grant criterion changed';
  end if;

  perform set_config('request.jwt.claim.sub',cross_actor::text,true);
  if (select count(*) from public.portal_applications where id=application) <> 0 then
    raise exception 'Cross-program reviewer can read Grant application';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  select id into strict assignment_a from public.reviewer_assignments where application_id=application and reviewer_id=reviewer_a;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,original_version,'[]'::jsonb,
      'Stale rubric','submit','grant-stale-rubric-1');
    raise exception 'Stale Grant rubric accepted';
  exception when others then
    if sqlerrm not like 'review_submission:stale_rubric:%' then raise; end if;
  end;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,clone_version,
      jsonb_build_array(jsonb_build_object('criterionId',criterion_id,'value',8)),
      'Invalid score','save_draft','grant-invalid-1');
    raise exception 'Out-of-range Grant score accepted';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,clone_version,
      jsonb_build_array(jsonb_build_object('criterionId','d2000000-0000-4000-8000-000000000099','value',1)),
      'Unknown criterion','save_draft','grant-invalid-criterion-1');
    raise exception 'Unknown Grant criterion accepted';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  if (select count(*) from public.program_reviews where application_id=application) <> 0 then
    raise exception 'Invalid Grant score left a partial review';
  end if;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,clone_version,'[]'::jsonb,
      'Missing score','submit','grant-empty-score-1');
    raise exception 'Grant final submit accepted missing criterion';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  if (select count(*) from public.program_reviews where application_id=application) <> 0 then
    raise exception 'Rejected Grant submit left a partial review';
  end if;
  scores := jsonb_build_array(jsonb_build_object('criterionId',criterion_id,'value',6));
  result := public.submit_business_grant_review(application,assignment_a,null,0,clone_version,scores,
    'Draft A','save_draft','grant-draft-a-1');
  review_a := (result->>'reviewId')::uuid;
  version_a := (result->>'version')::integer;
  replay := public.submit_business_grant_review(application,assignment_a,null,0,clone_version,scores,
    'Draft A','save_draft','grant-draft-a-1');
  if replay->>'replayed' <> 'true' or replay->>'reviewId' <> review_a::text then
    raise exception 'Grant idempotency replay failed';
  end if;
  begin
    perform public.submit_business_grant_review(application,assignment_a,null,0,clone_version,scores,
      'Changed payload','save_draft','grant-draft-a-1');
    raise exception 'Grant idempotency conflict accepted';
  exception when others then
    if sqlerrm not like 'review_submission:conflict:%' then raise; end if;
  end;
  if (select count(*) from public.review_scores where review_id=review_a) <> 1 then
    raise exception 'Grant draft score did not persist atomically';
  end if;
  result := public.submit_business_grant_review(application,assignment_a,review_a,version_a,clone_version,scores,
    'Updated A','save_draft','grant-update-a-1');
  version_a := (result->>'version')::integer;
  begin
    perform public.submit_business_grant_review(application,assignment_a,review_a,version_a-1,clone_version,scores,
      'Stale version','save_draft','grant-stale-version-2');
    raise exception 'Grant stale version accepted';
  exception when others then
    if sqlerrm not like 'review_submission:stale_version:%' then raise; end if;
  end;
  result := public.submit_business_grant_review(application,assignment_a,review_a,version_a,clone_version,scores,
    'Submitted A','submit','grant-submit-a-1');
  version_a := (result->>'version')::integer;
  if result->>'status' <> 'submitted' then raise exception 'Grant final submit failed'; end if;
  begin
    perform public.submit_business_grant_review(application,assignment_a,review_a,version_a,clone_version,scores,
      'Locked','save_draft','grant-locked-a-1');
    raise exception 'Submitted Grant review accepted reviewer save';
  exception when others then
    if sqlerrm not like 'review_submission:already_submitted:%' then raise; end if;
  end;
  begin
    perform public.reopen_review('business_growth_grant',review_a);
    raise exception 'Reviewer reopened Grant review';
  exception when others then
    if sqlerrm not like 'review_submission:authorization:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',reviewer_b::text,true);
  select id into strict assignment_b from public.reviewer_assignments where application_id=application and reviewer_id=reviewer_b;
  if (select count(*) from public.program_reviews where application_id=application) <> 0 then
    raise exception 'Reviewer B sees Reviewer A Grant review';
  end if;
  result := public.submit_business_grant_review(application,assignment_b,null,0,clone_version,scores,
    'Draft B','save_draft','grant-draft-b-1');
  review_b := (result->>'reviewId')::uuid;
  if (select count(*) from public.program_reviews where application_id=application) <> 1
    or (select count(*) from public.review_scores where review_id=review_a) <> 0 then
    raise exception 'Reviewer B sees peer Grant review or scores';
  end if;
  perform set_config('request.jwt.claim.sub',viewer_actor::text,true);
  if (select count(*) from public.program_reviews where application_id=application) <> 0
    or (select count(*) from public.review_scores where review_id in (review_a,review_b)) <> 0 then
    raise exception 'Viewer sees individual Grant reviews or scores';
  end if;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  if (select count(*) from public.program_reviews where application_id=application) <> 2
    or (select count(*) from public.review_scores where review_id in (review_a,review_b)) <> 2 then
    raise exception 'Program admin cannot inspect Grant reviews and scores';
  end if;
  result := public.reopen_review('business_growth_grant',review_a);
  version_a := (result->>'version')::integer;
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  result := public.submit_business_grant_review(application,assignment_a,review_a,version_a,clone_version,scores,
    'Resubmitted A','submit','grant-resubmit-a-1');
  if result->>'status' <> 'submitted' then raise exception 'Grant resubmit failed'; end if;
end $$;
reset role;

do $$
declare
  review_a public.program_reviews%rowtype;
  event_count integer;
begin
  select * into strict review_a from public.program_reviews
    where application_id='d2000000-0000-4000-8000-000000000011'
      and reviewer_id='d2000000-0000-4000-8000-000000000001';
  if review_a.status <> 'completed' or review_a.submitted_at is null
    or review_a.reviewer_comments <> 'Resubmitted A' or review_a.rubric_version_id is null
    or review_a.total_score <> 6 then raise exception 'Grant final atomic state failed'; end if;
  if (select count(*) from public.review_scores where review_id=review_a.id and points=6) <> 1
    or (select count(*) from public.review_idempotency_keys where application_id=review_a.application_id) <> 5 then
    raise exception 'Grant score or idempotency records failed';
  end if;
  select count(distinct event_type) into event_count from public.review_lifecycle_events
  where program_review_id=review_a.id and event_type in ('review_created','draft_saved','submitted','reopened','resubmitted');
  if event_count <> 5 then raise exception 'Grant lifecycle events failed'; end if;
end $$;

set local role authenticated;
do $$
declare
  application constant uuid := 'd2000000-0000-4000-8000-000000000011';
  admin_actor constant uuid := 'd2000000-0000-4000-8000-000000000003';
  reviewer_a constant uuid := 'd2000000-0000-4000-8000-000000000001';
  grant_program uuid;
  old_version uuid;
  new_version uuid;
  assignment_a uuid;
  review_a uuid;
  current_version integer;
begin
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  select id into strict grant_program from public.programs where slug='business_growth_grant';
  select id into strict old_version from public.rubric_versions where program_id=grant_program and active;
  select id,assignment_id,version into strict review_a,assignment_a,current_version
    from public.program_reviews where application_id=application and reviewer_id=reviewer_a;
  new_version := public.create_rubric_version(grant_program,old_version);
  perform public.activate_rubric_version(grant_program,new_version);
  if (select rubric_version_id from public.program_reviews where id=review_a) <> old_version then
    raise exception 'Grant review was silently remapped to new rubric';
  end if;
  current_version := (public.reopen_review('business_growth_grant',review_a)->>'version')::integer;
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  begin
    perform public.submit_business_grant_review(application,assignment_a,review_a,current_version,new_version,
      '[]'::jsonb,'Stale bound review','save_draft','grant-stale-bound-1');
    raise exception 'Retired-rubric review silently remapped';
  exception when others then
    if sqlerrm not like 'review_submission:stale_rubric:%' then raise; end if;
  end;
end $$;
reset role;
do $$
declare review_a public.program_reviews%rowtype;
begin
  select * into strict review_a from public.program_reviews where application_id='d2000000-0000-4000-8000-000000000011'
    and reviewer_id='d2000000-0000-4000-8000-000000000001';
  if review_a.status <> 'in_progress' or review_a.rubric_version_id =
    (select id from public.rubric_versions where program_id=review_a.program_id and active)
    or (select count(*) from public.review_scores where review_id=review_a.id) <> 1 then
    raise exception 'Retired Grant review history was changed';
  end if;
end $$;

rollback;
