-- Run only with explicit authorization on a database where these fixture IDs
-- do not exist. All fixture writes and role simulations roll back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('d1000000-0000-4000-8000-000000000001','authenticated','authenticated','phase-d-scholarship-a@example.invalid','',now()),
  ('d1000000-0000-4000-8000-000000000002','authenticated','authenticated','phase-d-scholarship-b@example.invalid','',now()),
  ('d1000000-0000-4000-8000-000000000003','authenticated','authenticated','phase-d-scholarship-admin@example.invalid','',now()),
  ('d1000000-0000-4000-8000-000000000004','authenticated','authenticated','phase-d-scholarship-viewer@example.invalid','',now()),
  ('d1000000-0000-4000-8000-000000000005','authenticated','authenticated','phase-d-scholarship-global-admin@example.invalid','',now());

insert into public.user_roles(user_id,role) values
  ('d1000000-0000-4000-8000-000000000001','reviewer'),
  ('d1000000-0000-4000-8000-000000000002','reviewer'),
  ('d1000000-0000-4000-8000-000000000005','admin');

insert into public.user_program_access(user_id,program_id,access_role)
select v.user_id,p.id,v.access_role::public.program_access_role
from (values
  ('d1000000-0000-4000-8000-000000000001'::uuid,'reviewer'),
  ('d1000000-0000-4000-8000-000000000002'::uuid,'reviewer'),
  ('d1000000-0000-4000-8000-000000000003'::uuid,'admin'),
  ('d1000000-0000-4000-8000-000000000004'::uuid,'viewer')
) v(user_id,access_role)
join public.programs p on p.slug='scholarship';

insert into public.portal_applications(id,program_id,external_submission_id,applicant_name,submitted_at)
select 'd1000000-0000-4000-8000-000000000011',p.id,'phase-d-rollback-scholarship','Phase D Rollback Applicant','2027-01-15'
from public.programs p where p.slug='scholarship';
insert into public.applicants(id,application_id,first_name,last_name,submission_date,preliminary_screening_status)
values ('d1000000-0000-4000-8000-000000000012','d1000000-0000-4000-8000-000000000011',
        'Phase D','Rollback','2027-01-15','eligible_for_review');
insert into public.applicant_notes(applicant_id,note,created_by)
values ('d1000000-0000-4000-8000-000000000012','Rollback-only note','d1000000-0000-4000-8000-000000000001');
insert into public.reviewer_discussion_documents(applicant_id,reviewer_id,file_name,file_path,file_type,file_size)
values ('d1000000-0000-4000-8000-000000000012','d1000000-0000-4000-8000-000000000001',
        'rollback-only.pdf','phase-d-rollback/metadata-only.pdf','application/pdf',1);

set local role authenticated;
do $$
declare
  applicant constant uuid := 'd1000000-0000-4000-8000-000000000012';
  application constant uuid := 'd1000000-0000-4000-8000-000000000011';
  reviewer_a constant uuid := 'd1000000-0000-4000-8000-000000000001';
  reviewer_b constant uuid := 'd1000000-0000-4000-8000-000000000002';
  admin_actor constant uuid := 'd1000000-0000-4000-8000-000000000003';
  viewer_actor constant uuid := 'd1000000-0000-4000-8000-000000000004';
  global_admin constant uuid := 'd1000000-0000-4000-8000-000000000005';
  assignment_a uuid;
  assignment_b uuid;
  review_a uuid;
  review_b uuid;
  version_a integer;
  result jsonb;
  replay jsonb;
  n integer;
begin
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  select id into strict assignment_a from public.reviewer_assignments
    where application_id=application and reviewer_id=reviewer_a and lifecycle='active';
  if (select count(*) from public.portal_applications where id=application) <> 1 then
    raise exception 'Reviewer A cannot access eligible assigned application';
  end if;
  begin
    perform public.submit_scholarship_review(applicant,assignment_a,null,0,10,0,'Invalid score',null,'save_draft','sch-invalid-a-1');
    raise exception 'Out-of-range Scholarship score accepted';
  exception when others then
    if sqlerrm not like 'review_submission:validation:%' then raise; end if;
  end;
  if (select count(*) from public.reviews where applicant_id=applicant) <> 0 then
    raise exception 'Invalid Scholarship score created a review';
  end if;
  result := public.submit_scholarship_review(applicant,assignment_a,null,0,5,7,'Draft A',null,'save_draft','sch-draft-a-1');
  review_a := (result->>'reviewId')::uuid;
  version_a := (result->>'version')::integer;
  if result->>'status' <> 'in_progress' then raise exception 'Scholarship draft status failed'; end if;
  replay := public.submit_scholarship_review(applicant,assignment_a,null,0,5,7,'Draft A',null,'save_draft','sch-draft-a-1');
  if replay->>'replayed' <> 'true' or replay->>'reviewId' <> review_a::text then
    raise exception 'Scholarship idempotency replay failed';
  end if;
  begin
    perform public.submit_scholarship_review(applicant,assignment_a,null,0,6,7,'Draft A',null,'save_draft','sch-draft-a-1');
    raise exception 'Scholarship idempotency conflict was accepted';
  exception when others then
    if sqlerrm not like 'review_submission:conflict:%' then raise; end if;
  end;
  result := public.submit_scholarship_review(applicant,assignment_a,review_a,version_a,6,8,'Submitted A',null,'submit','sch-submit-a-1');
  version_a := (result->>'version')::integer;
  if result->>'status' <> 'submitted' then raise exception 'Scholarship submit failed'; end if;
  begin
    perform public.submit_scholarship_review(applicant,assignment_a,review_a,version_a,6,8,'Locked',null,'save_draft','sch-locked-a-1');
    raise exception 'Submitted Scholarship review accepted reviewer save';
  exception when others then
    if sqlerrm not like 'review_submission:already_submitted:%' then raise; end if;
  end;
  begin
    perform public.reopen_review('scholarship',review_a);
    raise exception 'Reviewer reopened Scholarship review';
  exception when others then
    if sqlerrm not like 'review_submission:authorization:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',reviewer_b::text,true);
  select id into strict assignment_b from public.reviewer_assignments
    where application_id=application and reviewer_id=reviewer_b and lifecycle='active';
  if (select count(*) from public.reviews where applicant_id=applicant) <> 0 then
    raise exception 'Reviewer B can read Reviewer A review';
  end if;
  result := public.submit_scholarship_review(applicant,assignment_b,null,0,4,4,'Draft B',null,'save_draft','sch-draft-b-1');
  review_b := (result->>'reviewId')::uuid;
  if (select count(*) from public.reviews where applicant_id=applicant) <> 1 then
    raise exception 'Reviewer B sees peer review';
  end if;

  perform set_config('request.jwt.claim.sub',viewer_actor::text,true);
  if (select count(*) from public.reviews where applicant_id=applicant) <> 0 then
    raise exception 'Viewer sees individual Scholarship reviews';
  end if;
  perform set_config('request.jwt.claim.sub',admin_actor::text,true);
  if (select count(*) from public.reviews where applicant_id=applicant) <> 2 then
    raise exception 'Program admin cannot inspect both Scholarship reviews';
  end if;
  result := public.reopen_review('scholarship',review_a);
  version_a := (result->>'version')::integer;
  if result->>'status' <> 'in_progress' then raise exception 'Scholarship admin reopen failed'; end if;
  perform set_config('request.jwt.claim.sub',global_admin::text,true);
  if (select count(*) from public.portal_applications where id=application) <> 1 then
    raise exception 'Global admin without membership cannot access Scholarship application';
  end if;
  update public.applicants set preliminary_screening_status='did_not_meet_minimum_requirements' where id=applicant;
  select count(*) into n from public.reviewer_assignments
    where application_id=application and lifecycle='suspended';
  if n <> 2 then raise exception 'Scholarship assignments did not suspend'; end if;

  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  if (select count(*) from public.portal_applications where id=application) <> 0
     or (select count(*) from public.reviews where id=review_a) <> 0 then
    raise exception 'Ineligible Scholarship data remained visible to reviewer';
  end if;
  begin
    perform public.submit_scholarship_review(applicant,assignment_a,review_a,version_a,7,8,'Denied',null,'save_draft','sch-ineligible-a-1');
    raise exception 'Ineligible Scholarship review save succeeded';
  exception when others then
    if sqlerrm not like 'review_submission:authorization:%' then raise; end if;
  end;

  perform set_config('request.jwt.claim.sub',global_admin::text,true);
  update public.applicants set preliminary_screening_status='eligible_for_review' where id=applicant;
  if (select count(*) from public.reviewer_assignments where application_id=application) <> 2
     or (select count(*) from public.reviewer_assignments where application_id=application and lifecycle='active') <> 2 then
    raise exception 'Scholarship assignment restoration duplicated or missed rows';
  end if;
  perform set_config('request.jwt.claim.sub',reviewer_a::text,true);
  if (select count(*) from public.portal_applications where id=application) <> 1
     or (select count(*) from public.reviews where id=review_a) <> 1 then
    raise exception 'Scholarship access was not restored';
  end if;
  begin
    perform public.submit_scholarship_review(applicant,assignment_a,review_a,version_a-1,7,8,'Stale',null,'save_draft','sch-stale-a-1');
    raise exception 'Stale Scholarship review version accepted';
  exception when others then
    if sqlerrm not like 'review_submission:stale_version:%' then raise; end if;
  end;
  result := public.submit_scholarship_review(applicant,assignment_a,review_a,version_a,7,8,'Edited A',null,'save_draft','sch-edit-a-1');
  version_a := (result->>'version')::integer;
  result := public.submit_scholarship_review(applicant,assignment_a,review_a,version_a,9,9,'Resubmitted A',null,'submit','sch-resubmit-a-1');
  if result->>'status' <> 'submitted' then raise exception 'Scholarship resubmit failed'; end if;
end $$;
reset role;

do $$
declare
  applicant constant uuid := 'd1000000-0000-4000-8000-000000000012';
  review_a public.reviews%rowtype;
  event_count integer;
begin
  select * into strict review_a from public.reviews where applicant_id=applicant
    and reviewer_id='d1000000-0000-4000-8000-000000000001';
  if not review_a.is_complete or review_a.writing_score <> 9 or review_a.rhetoric_score <> 9
     or review_a.writing_score + review_a.rhetoric_score <> 18
     or review_a.submitted_at is null then
    raise exception 'Scholarship scoring or final state failed';
  end if;
  if (select total_score from public.applicants where id=applicant) <> 18 then
    raise exception 'Scholarship completed-score aggregate failed';
  end if;
  if (select count(*) from public.applicant_notes where applicant_id=applicant) <> 1
    or (select count(*) from public.reviewer_discussion_documents where applicant_id=applicant) <> 1 then
    raise exception 'Scholarship note or discussion-document metadata was not preserved';
  end if;
  select count(distinct event_type) into event_count
  from public.review_lifecycle_events where scholarship_review_id=review_a.id
    and event_type in ('review_created','submitted','reopened','draft_saved','resubmitted');
  if event_count <> 5 or (select count(*) from public.review_lifecycle_events
      where scholarship_review_id=review_a.id) <> 5 then
    raise exception 'Scholarship lifecycle events failed';
  end if;
  if (select count(*) from public.reviews where applicant_id=applicant
      and reviewer_id='d1000000-0000-4000-8000-000000000001' and canonical_identity) <> 1 then
    raise exception 'Scholarship canonical identity duplicated';
  end if;
  begin
    insert into public.reviews(applicant_id,reviewer_id,reviewer_name,canonical_identity)
    values(applicant,'d1000000-0000-4000-8000-000000000001','Duplicate',true);
    raise exception 'Canonical duplicate accepted';
  exception when unique_violation then null;
  end;
end $$;

rollback;
