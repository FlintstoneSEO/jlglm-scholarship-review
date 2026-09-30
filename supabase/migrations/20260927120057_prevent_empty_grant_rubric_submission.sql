-- Preserve the Phase D atomic RPC and close the zero-criterion final-submit path.
-- The live Grant v1 intentionally has no approved criteria, so it must not accept
-- a completed review with an empty score array.
create or replace function public.submit_business_grant_review(
  p_application_id uuid, p_assignment_id uuid, p_review_id uuid default null,
  p_current_version integer default null, p_rubric_version uuid default null,
  p_criteria jsonb default '[]'::jsonb, p_comments text default null,
  p_intent text default 'save_draft', p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); assignment public.reviewer_assignments%rowtype; review public.program_reviews%rowtype;
  v_program_id uuid; active_version uuid; replay jsonb; result jsonb; item jsonb; criterion public.rubric_criteria%rowtype;
  supplied_ids uuid[] := '{}'; previous text; event public.review_lifecycle_event;
begin
  if actor is null then perform private.phase_d_error('authorization','Authentication required'); end if;
  if p_intent not in ('save_draft','submit') or jsonb_typeof(p_criteria) <> 'array' then perform private.phase_d_error('validation','Invalid submission'); end if;
  select pa.program_id into v_program_id from public.portal_applications pa join public.programs p on p.id=pa.program_id
    where pa.id=p_application_id and p.slug='business_growth_grant';
  if not found then perform private.phase_d_error('unavailable','Grant application is unavailable'); end if;
  select * into assignment from public.reviewer_assignments ra where ra.id=p_assignment_id and ra.application_id=p_application_id
    and ra.program_id=v_program_id and ra.reviewer_id=actor and ra.lifecycle='active';
  if not found then perform private.phase_d_error('authorization','An active assignment is required'); end if;
  select rv.id into active_version from public.rubric_versions rv where rv.program_id=v_program_id and rv.active for share;
  if active_version is null or p_rubric_version is distinct from active_version then perform private.phase_d_error('stale_rubric','Reload the active rubric'); end if;
  replay := private.claim_review_idempotency(actor,v_program_id,p_application_id,p_intent,p_idempotency_key,
    jsonb_build_object('application',p_application_id,'assignment',p_assignment_id,'review',p_review_id,'version',p_current_version,
      'rubric',p_rubric_version,'criteria',p_criteria,'comments',coalesce(p_comments,''),'intent',p_intent));
  if replay is not null then return replay; end if;
  select * into review from public.program_reviews pr where pr.assignment_id=p_assignment_id for update;
  if found then
    if p_review_id is not null and p_review_id <> review.id then perform private.phase_d_error('conflict','Review identity mismatch'); end if;
    if p_current_version is null or p_current_version <> review.version then perform private.phase_d_error('stale_version','Review has changed'); end if;
    if review.status='completed' then perform private.phase_d_error('already_submitted','Administrator reopen is required'); end if;
    if review.rubric_version_id is distinct from active_version then perform private.phase_d_error('stale_rubric','Review belongs to another rubric version'); end if;
    previous := review.status::text;
  else
    if p_review_id is not null or coalesce(p_current_version,0) <> 0 then perform private.phase_d_error('stale_version','Review does not exist'); end if;
    insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status,reviewer_comments,started_at,rubric_version_id)
      values(p_assignment_id,p_application_id,v_program_id,actor,'in_progress',p_comments,now(),active_version) returning * into review;
    previous := null;
  end if;
  for item in select value from jsonb_array_elements(p_criteria) loop
    if not (item ? 'criterionId') or not (item ? 'value') then perform private.phase_d_error('validation','Each score needs criterionId and value'); end if;
    select * into criterion from public.rubric_criteria rc
      where rc.id=(item->>'criterionId')::uuid and rc.rubric_version_id=active_version and rc.active;
    if not found or (item->>'value')::numeric < 0 or (item->>'value')::numeric > criterion.maximum_points then
      perform private.phase_d_error('validation','Criterion is invalid or outside its configured maximum');
    end if;
    if criterion.id = any(supplied_ids) then perform private.phase_d_error('validation','Criterion was supplied more than once'); end if;
    supplied_ids := array_append(supplied_ids,criterion.id);
    insert into public.review_scores(review_id,criterion_id,points) values(review.id,criterion.id,(item->>'value')::numeric)
      on conflict(review_id,criterion_id) do update set points=excluded.points,updated_at=now();
  end loop;
  if p_intent='submit' then
    if not exists (select 1 from public.rubric_criteria rc where rc.rubric_version_id=active_version and rc.active) then
      perform private.phase_d_error('validation','Final submission requires an active rubric criterion');
    end if;
    if (select count(*) from public.rubric_criteria rc where rc.rubric_version_id=active_version and rc.active) <> cardinality(supplied_ids)
       or exists(select 1 from public.rubric_criteria rc where rc.rubric_version_id=active_version and rc.active and not(rc.id=any(supplied_ids))) then
      perform private.phase_d_error('validation','Final submission requires every active criterion exactly once');
    end if;
  end if;
  event := case when p_intent='submit' and review.reopened_at is not null then 'resubmitted'::public.review_lifecycle_event
                when p_intent='submit' then 'submitted'::public.review_lifecycle_event
                when previous is null then 'review_created'::public.review_lifecycle_event else 'draft_saved'::public.review_lifecycle_event end;
  update public.program_reviews set reviewer_comments=p_comments,status=(case when p_intent='submit' then 'completed' else 'in_progress' end)::public.portal_review_status,
    submitted_at=case when p_intent='submit' then now() else submitted_at end,version=version+case when previous is null then 0 else 1 end,updated_at=now()
    where id=review.id returning * into review;
  insert into public.review_lifecycle_events(program_id,program_review_id,actor_id,event_type,previous_status,new_status,request_key)
    values(v_program_id,review.id,actor,event,previous,case when review.status='completed' then 'submitted' else 'in_progress' end,p_idempotency_key);
  result := jsonb_build_object('reviewId',review.id,'status',case when review.status='completed' then 'submitted' else 'in_progress' end,
    'savedAt',review.updated_at,'submittedAt',review.submitted_at,'version',review.version,'replayed',false);
  update public.review_idempotency_keys k set response=result
    where k.actor_id=actor and k.program_id=v_program_id and k.idempotency_key=p_idempotency_key;
  return result;
end $$;
