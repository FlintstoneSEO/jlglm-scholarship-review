-- All fixture rows roll back. Run against a database with the active 100-point Grant rubric.
begin;

insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at)
values
 ('e8000000-0000-4000-8000-000000000001','authenticated','authenticated','phase8-reviewer@example.invalid','',now()),
 ('e8000000-0000-4000-8000-000000000002','authenticated','authenticated','phase8-admin@example.invalid','',now()),
 ('e8000000-0000-4000-8000-000000000003','authenticated','authenticated','phase8-viewer@example.invalid','',now()),
 ('e8000000-0000-4000-8000-000000000004','authenticated','authenticated','phase8-cross@example.invalid','',now());
insert into public.user_roles(user_id,role)
values ('e8000000-0000-4000-8000-000000000002','admin');
insert into public.user_program_access(user_id,program_id,access_role)
select v.user_id,p.id,v.access_role::public.program_access_role
from (values
 ('e8000000-0000-4000-8000-000000000001'::uuid,'business_growth_grant','reviewer'),
 ('e8000000-0000-4000-8000-000000000002'::uuid,'business_growth_grant','admin'),
 ('e8000000-0000-4000-8000-000000000003'::uuid,'business_growth_grant','viewer'),
 ('e8000000-0000-4000-8000-000000000004'::uuid,'scholarship','reviewer')
) v(user_id,slug,access_role) join public.programs p on p.slug=v.slug;
insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,submitted_at)
select 'e8000000-0000-4000-8000-000000000011',p.id,'phase8-rollback','Phase 8 Rollback','2027-01-15'
from public.programs p where p.slug='business_growth_grant';
insert into public.business_grant_application_details(application_id,business_name)
values ('e8000000-0000-4000-8000-000000000011','Phase 8 Rollback Business');
insert into public.reviewer_assignments(application_id,program_id,reviewer_id)
select 'e8000000-0000-4000-8000-000000000011',p.id,v.reviewer_id
from public.programs p cross join (values
 ('e8000000-0000-4000-8000-000000000001'::uuid),
 ('e8000000-0000-4000-8000-000000000002'::uuid),
 -- Models an assignment retained after a user was changed from reviewer to viewer.
 ('e8000000-0000-4000-8000-000000000003'::uuid)
) v(reviewer_id) where p.slug='business_growth_grant';

set local role authenticated;
do $$
declare
  application constant uuid := 'e8000000-0000-4000-8000-000000000011';
  reviewer constant uuid := 'e8000000-0000-4000-8000-000000000001';
  admin_actor constant uuid := 'e8000000-0000-4000-8000-000000000002';
  viewer constant uuid := 'e8000000-0000-4000-8000-000000000003';
  cross_actor constant uuid := 'e8000000-0000-4000-8000-000000000004';
  rubric uuid; assignment uuid; admin_assignment uuid; viewer_assignment uuid; review_id uuid; version_no integer; result jsonb; scores jsonb; partial_scores jsonb; test_actor uuid;
begin
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  select id into strict rubric from public.rubric_versions where active and program_id=(select id from public.programs where slug='business_growth_grant');
  select jsonb_agg(jsonb_build_object('criterionId',id,'value',0) order by display_order) into scores
    from public.rubric_criteria where rubric_version_id=rubric and active;
  if (select sum(maximum_points) from public.rubric_criteria where rubric_version_id=rubric and active) <> 100 then
    raise exception 'Expected approved 100-point Grant rubric';
  end if;
  partial_scores := scores - (jsonb_array_length(scores)-1);
  select id into strict assignment from public.reviewer_assignments where application_id=application and reviewer_id=reviewer;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  perform public.set_grant_requirement(application, key, 'verified', 'Rollback fixture') from
    unnest(array['owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025']) as key;
  perform public.confirm_grant_eligibility(application,'eligible','Rollback fixture');
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  result := public.submit_business_grant_review(application,assignment,null,0,rubric,partial_scores,null,'save_draft','phase8-draft-1');
  review_id := (result->>'reviewId')::uuid; version_no := (result->>'version')::integer;
  if exists(select 1 from public.grant_review_certifications where program_review_id=review_id) then raise exception 'Draft certified'; end if;
  begin
    perform public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,scores,null,'submit','phase8-no-cert',null,false);
    raise exception 'Uncertified submit succeeded';
  exception when others then
    if sqlerrm not like 'review_submission:certification_required:%' then raise; end if;
  end;
  begin
    perform public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,partial_scores,null,'submit','phase8-partial','grant_reviewer_certification_v1',true);
    raise exception 'Partial certified submit succeeded';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  for test_actor in select v.id from (values(viewer),(cross_actor),(admin_actor)) v(id) loop
    perform set_config('request.jwt.claim.sub',test_actor::text,true);
    begin
      perform public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,scores,null,'submit','phase8-unauthorized-'||test_actor::text,'grant_reviewer_certification_v1',true);
      raise exception 'Unassigned actor certified';
    exception when others then
      if sqlerrm not like 'review_submission:authorization:%' then raise; end if;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  select id into strict viewer_assignment from public.reviewer_assignments where application_id=application and reviewer_id=viewer;
  begin
    perform public.submit_business_grant_review(application,viewer_assignment,null,0,rubric,scores,null,'submit',
      'phase8-viewer-retained-assignment','grant_reviewer_certification_v1',true);
    raise exception 'Viewer with retained assignment certified';
  exception when others then
    if sqlerrm not like 'review_submission:authorization:%' then raise; end if;
  end;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  result := public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,scores,'Final','submit','phase8-submit-1','grant_reviewer_certification_v1',true);
  version_no := (result->>'version')::integer;
  if (select count(*) from public.grant_review_certifications where program_review_id=review_id and reviewer_id=reviewer
      and review_version=version_no and certification_version='grant_reviewer_certification_v1' and certified_at is not null) <> 1 then
    raise exception 'Certification audit record missing';
  end if;
  perform set_config('request.jwt.claim.sub',viewer::text,true);
  if exists(select 1 from public.grant_review_certifications where program_review_id=review_id) then
    raise exception 'Viewer can read individual certification';
  end if;
  perform set_config('request.jwt.claim.sub',cross_actor::text,true);
  if exists(select 1 from public.grant_review_certifications where program_review_id=review_id) then
    raise exception 'Cross-program actor can read certification';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  if (public.submit_business_grant_review(application,assignment,review_id,version_no-1,rubric,scores,'Final','submit','phase8-submit-1','grant_reviewer_certification_v1',true)->>'reviewId')::uuid <> review_id then
    raise exception 'Idempotent replay changed review';
  end if;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  perform public.reopen_review('business_growth_grant',review_id);
  select version into strict version_no from public.program_reviews where id=review_id;
  if exists(select 1 from public.grant_review_certifications where program_review_id=review_id and review_version=version_no) then
    raise exception 'Old certification carried into reopened version';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer::text,true);
  begin
    perform public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,scores,'Revised','submit','phase8-reopen-no-cert',null,false);
    raise exception 'Reopened review submitted without new certification';
  exception when others then
    if sqlerrm not like 'review_submission:certification_required:%' then raise; end if;
  end;
  perform public.submit_business_grant_review(application,assignment,review_id,version_no,rubric,scores,'Revised','submit','phase8-resubmit','grant_reviewer_certification_v1',true);
  if (select count(*) from public.grant_review_certifications where program_review_id=review_id) <> 2 then
    raise exception 'Prior certification history was lost';
  end if;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  select id into strict admin_assignment from public.reviewer_assignments where application_id=application and reviewer_id=admin_actor;
  result := public.submit_business_grant_review(application,admin_assignment,null,0,rubric,scores,'Assigned admin review',
    'submit','phase8-admin-own-submit','grant_reviewer_certification_v1',true);
  if (select count(*) from public.grant_review_certifications where program_review_id=(result->>'reviewId')::uuid
      and reviewer_id=admin_actor and certified_at is not null) <> 1 then
    raise exception 'Assigned admin could not certify own review';
  end if;
end $$;
rollback;
