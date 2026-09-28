begin;

-- Phase D rubric lifecycle. Status is represented by the existing columns:
-- active=true => active; active=false and retired_at is null => draft;
-- active=false and retired_at is set => retired.

-- Submission and reopen functions are the only supported review writers.
-- In particular, an owner must not be able to DELETE an individual score and
-- leave the canonical review transaction in a partially edited state.
revoke insert, update, delete on public.program_reviews, public.review_scores
  from authenticated;

-- Qualify program ids consistently in these RPCs. The prior implementations
-- used a PL/pgSQL variable named program_id beside columns of the same name.
create or replace function public.submit_scholarship_review(
  p_applicant_id uuid, p_assignment_id uuid, p_review_id uuid default null,
  p_current_version integer default null, p_writing_score integer default null,
  p_rhetoric_score integer default null, p_comments text default null,
  p_recommendation public.recommendation default null,
  p_intent text default 'save_draft', p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); app public.applicants%rowtype; assignment public.reviewer_assignments%rowtype;
  existing public.reviews%rowtype; v_program_id uuid; replay jsonb; result jsonb; previous text;
  canonical boolean; event public.review_lifecycle_event;
begin
  if actor is null then perform private.phase_d_error('authorization','Authentication required'); end if;
  if p_intent not in ('save_draft','submit') then perform private.phase_d_error('validation','Unknown intent'); end if;
  if p_writing_score not between 0 and 9 or p_rhetoric_score not between 0 and 9 then
    perform private.phase_d_error('validation','Writing and Rhetoric must be integers from 0 through 9');
  end if;
  select a.* into app from public.applicants a where a.id=p_applicant_id;
  if not found or app.application_id is null then perform private.phase_d_error('unavailable','Scholarship application is unavailable'); end if;
  select pa.program_id into v_program_id from public.portal_applications pa join public.programs p on p.id=pa.program_id
    where pa.id=app.application_id and p.slug='scholarship';
  select * into assignment from public.reviewer_assignments ra where ra.id=p_assignment_id and ra.application_id=app.application_id
    and ra.program_id=v_program_id and ra.reviewer_id=actor and ra.lifecycle='active';
  if not found or app.preliminary_screening_status <> 'eligible_for_review' then
    perform private.phase_d_error('authorization','An active eligible assignment is required');
  end if;
  canonical := extract(year from coalesce(app.submission_date, app.created_at)) >= 2027;
  if not canonical then perform private.phase_d_error('already_submitted','The completed 2026 cycle is historical and locked'); end if;
  replay := private.claim_review_idempotency(actor,v_program_id,app.application_id,p_intent,p_idempotency_key,
    jsonb_build_object('applicant',p_applicant_id,'assignment',p_assignment_id,'review',p_review_id,'version',p_current_version,
      'writing',p_writing_score,'rhetoric',p_rhetoric_score,'comments',coalesce(p_comments,''),'recommendation',p_recommendation,'intent',p_intent));
  if replay is not null then return replay; end if;
  select * into existing from public.reviews r where r.applicant_id=p_applicant_id and r.reviewer_id=actor and r.canonical_identity for update;
  if found then
    if p_review_id is not null and p_review_id <> existing.id then perform private.phase_d_error('conflict','Review identity mismatch'); end if;
    if p_current_version is null or p_current_version <> existing.version then perform private.phase_d_error('stale_version','Review has changed'); end if;
    if existing.is_complete then perform private.phase_d_error('already_submitted','Administrator reopen is required'); end if;
    previous := 'in_progress';
    event := case when p_intent='submit' and existing.reopened_at is not null then 'resubmitted'::public.review_lifecycle_event
                  when p_intent='submit' then 'submitted'::public.review_lifecycle_event else 'draft_saved'::public.review_lifecycle_event end;
    update public.reviews set writing_score=p_writing_score, rhetoric_score=p_rhetoric_score,
      reviewer_notes=p_comments, recommendation=p_recommendation, is_complete=(p_intent='submit'), submitted_at=case when p_intent='submit' then now() else submitted_at end,
      version=version+1, updated_at=now() where id=existing.id returning * into existing;
  else
    if p_review_id is not null or coalesce(p_current_version,0) <> 0 then perform private.phase_d_error('stale_version','Review does not exist'); end if;
    insert into public.reviews(applicant_id,reviewer_id,reviewer_name,writing_score,rhetoric_score,reviewer_notes,recommendation,is_complete,submitted_at,canonical_identity)
    values (p_applicant_id,actor,coalesce((select full_name from public.profiles where id=actor),'Reviewer'),p_writing_score,p_rhetoric_score,p_comments,p_recommendation,
      p_intent='submit',case when p_intent='submit' then now() end,true) returning * into existing;
    previous := null; event := case when p_intent='submit' then 'submitted'::public.review_lifecycle_event else 'review_created'::public.review_lifecycle_event end;
  end if;
  insert into public.review_lifecycle_events(program_id,scholarship_review_id,actor_id,event_type,previous_status,new_status,request_key)
    values(v_program_id,existing.id,actor,event,previous,case when existing.is_complete then 'submitted' else 'in_progress' end,p_idempotency_key);
  result := jsonb_build_object('reviewId',existing.id,'status',case when existing.is_complete then 'submitted' else 'in_progress' end,
    'savedAt',existing.updated_at,'submittedAt',existing.submitted_at,'version',existing.version,'replayed',false);
  update public.review_idempotency_keys k set response=result
    where k.actor_id=actor and k.program_id=v_program_id and k.idempotency_key=p_idempotency_key;
  return result;
end $$;

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
    if (select count(*) from public.rubric_criteria rc where rc.rubric_version_id=active_version and rc.active) <> cardinality(supplied_ids)
       or exists(select 1 from public.rubric_criteria rc where rc.rubric_version_id=active_version and rc.active and not(rc.id=any(supplied_ids))) then
      perform private.phase_d_error('validation','Final submission requires every active criterion exactly once');
    end if;
  end if;
  event := case when p_intent='submit' and review.reopened_at is not null then 'resubmitted'::public.review_lifecycle_event
                when p_intent='submit' then 'submitted'::public.review_lifecycle_event
                when previous is null then 'review_created'::public.review_lifecycle_event else 'draft_saved'::public.review_lifecycle_event end;
  update public.program_reviews set reviewer_comments=p_comments,status=case when p_intent='submit' then 'completed' else 'in_progress' end,
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

create or replace function public.reopen_review(p_program_slug text, p_review_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); v_program_id uuid; scholarship public.reviews%rowtype; grant_review public.program_reviews%rowtype;
begin
  select p.id into v_program_id from public.programs p where p.slug=p_program_slug;
  if actor is null or v_program_id is null or not private.current_user_has_program_role(v_program_id,array['admin']::public.program_access_role[]) then
    perform private.phase_d_error('authorization','Program administrator access is required');
  end if;
  if p_program_slug='scholarship' then
    select * into scholarship from public.reviews r where r.id=p_review_id for update;
    if not found or not scholarship.is_complete then perform private.phase_d_error('conflict','Review is not submitted'); end if;
    update public.reviews set is_complete=false,reopened_at=now(),reopened_by=actor,version=version+1,updated_at=now()
      where id=p_review_id returning * into scholarship;
    insert into public.review_lifecycle_events(program_id,scholarship_review_id,actor_id,event_type,previous_status,new_status)
      values(v_program_id,p_review_id,actor,'reopened','submitted','in_progress');
    return jsonb_build_object('reviewId',p_review_id,'status','in_progress','version',scholarship.version,'reopenedAt',scholarship.reopened_at);
  elsif p_program_slug='business_growth_grant' then
    select * into grant_review from public.program_reviews pr where pr.id=p_review_id and pr.program_id=v_program_id for update;
    if not found or grant_review.status<>'completed' then perform private.phase_d_error('conflict','Review is not submitted'); end if;
    update public.program_reviews set status='in_progress',reopened_at=now(),reopened_by=actor,version=version+1,updated_at=now()
      where id=p_review_id returning * into grant_review;
    insert into public.review_lifecycle_events(program_id,program_review_id,actor_id,event_type,previous_status,new_status)
      values(v_program_id,p_review_id,actor,'reopened','submitted','in_progress');
    return jsonb_build_object('reviewId',p_review_id,'status','in_progress','version',grant_review.version,'reopenedAt',grant_review.reopened_at);
  end if;
  perform private.phase_d_error('validation','Unsupported program'); return null;
end $$;

-- Serialize draft edits with activation so an in-flight edit cannot modify the
-- rubric after it has become active or retired.
create or replace function private.protect_used_rubric_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  old_version uuid;
  new_version uuid;
  target_version uuid;
begin
  if tg_op <> 'INSERT' then old_version := old.rubric_version_id; end if;
  if tg_op <> 'DELETE' then new_version := new.rubric_version_id; end if;
  target_version := coalesce(new_version, old_version);

  perform 1 from public.rubric_versions rv
  where rv.id = any(array_remove(array[old_version, new_version], null))
  for share;
  if exists (
    select 1 from public.rubric_versions rv
    where rv.id = any(array_remove(array[old_version, new_version], null))
      and (rv.active or rv.retired_at is not null)
  ) then
    raise exception 'Only unused draft rubric versions are editable' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.program_reviews where rubric_version_id = target_version) then
    raise exception 'A rubric version used by a review is immutable' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Rubric criteria may only be changed while their version is an unused draft.
drop policy if exists rubric_insert on public.rubric_criteria;
drop policy if exists rubric_update on public.rubric_criteria;
drop policy if exists rubric_delete on public.rubric_criteria;
create policy rubric_insert_draft on public.rubric_criteria
  for insert to authenticated
  with check (
    (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
    and exists (
      select 1 from public.rubric_versions rv
      where rv.id = rubric_version_id and rv.program_id = rubric_criteria.program_id
        and not rv.active and rv.retired_at is null
        and not exists (select 1 from public.program_reviews pr where pr.rubric_version_id = rv.id)
    )
  );
create policy rubric_update_draft on public.rubric_criteria
  for update to authenticated
  using (
    (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
    and exists (
      select 1 from public.rubric_versions rv
      where rv.id = rubric_version_id and rv.program_id = rubric_criteria.program_id
        and not rv.active and rv.retired_at is null
        and not exists (select 1 from public.program_reviews pr where pr.rubric_version_id = rv.id)
    )
  )
  with check (
    (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
    and exists (
      select 1 from public.rubric_versions rv
      where rv.id = rubric_version_id and rv.program_id = rubric_criteria.program_id
        and not rv.active and rv.retired_at is null
        and not exists (select 1 from public.program_reviews pr where pr.rubric_version_id = rv.id)
    )
  );
create policy rubric_delete_draft on public.rubric_criteria
  for delete to authenticated
  using (
    (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
    and exists (
      select 1 from public.rubric_versions rv
      where rv.id = rubric_version_id and rv.program_id = rubric_criteria.program_id
        and not rv.active and rv.retired_at is null
        and not exists (select 1 from public.program_reviews pr where pr.rubric_version_id = rv.id)
    )
  );

create or replace function public.create_rubric_version(
  p_program_id uuid,
  p_source_version_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  next_version integer;
  new_version_id uuid;
begin
  if actor is null or not private.current_user_has_program_role(p_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Rubric administrator access is required' using errcode = '42501';
  end if;

  -- Serializes version numbering and activation against changes for this program.
  perform 1 from public.programs p where p.id = p_program_id for update;
  if not found then raise exception 'Program does not exist' using errcode = '22023'; end if;

  if p_source_version_id is not null and not exists (
    select 1 from public.rubric_versions rv
    where rv.id = p_source_version_id and rv.program_id = p_program_id
  ) then
    raise exception 'Source rubric version does not belong to this program' using errcode = '22023';
  end if;

  select coalesce(max(rv.version), 0) + 1 into next_version
  from public.rubric_versions rv where rv.program_id = p_program_id;

  insert into public.rubric_versions(program_id, version, name, active, created_by)
  values (p_program_id, next_version, 'Version ' || next_version, false, actor)
  returning id into new_version_id;

  if p_source_version_id is not null then
    insert into public.rubric_criteria(
      program_id, rubric_version_id, name, description, maximum_points, display_order, active
    )
    select p_program_id, new_version_id, rc.name, rc.description, rc.maximum_points, rc.display_order, rc.active
    from public.rubric_criteria rc
    where rc.rubric_version_id = p_source_version_id;
  end if;

  return new_version_id;
end;
$$;

create or replace function public.activate_rubric_version(
  p_program_id uuid,
  p_rubric_version_id uuid
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null or not private.current_user_has_program_role(p_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Rubric administrator access is required' using errcode = '42501';
  end if;

  -- A per-program lock makes replacement of the active version atomic and serial.
  perform 1 from public.programs p where p.id = p_program_id for update;
  if not found then raise exception 'Program does not exist' using errcode = '22023'; end if;

  perform 1 from public.rubric_versions rv
  where rv.id = p_rubric_version_id and rv.program_id = p_program_id
    and not rv.active and rv.retired_at is null
  for update;
  if not found then raise exception 'Only a draft version for this program can be activated' using errcode = '22023'; end if;

  if not exists (
    select 1 from public.rubric_criteria rc
    where rc.rubric_version_id = p_rubric_version_id and rc.active
  ) then raise exception 'A rubric must contain an active criterion before activation' using errcode = '22023'; end if;

  update public.rubric_versions
  set active = false, retired_at = now()
  where program_id = p_program_id and active;

  update public.rubric_versions
  set active = true, retired_at = null
  where id = p_rubric_version_id and program_id = p_program_id;
end;
$$;

revoke all on function public.create_rubric_version(uuid, uuid) from public, anon, authenticated;
revoke all on function public.activate_rubric_version(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_rubric_version(uuid, uuid) to authenticated;
grant execute on function public.activate_rubric_version(uuid, uuid) to authenticated;

-- These functions are called by triggers/event triggers. They are not RPC endpoints.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.compute_review_subtotal() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.recompute_applicant_score() from public, anon, authenticated;
revoke all on function public.get_user_role(uuid) from public, anon, authenticated;
revoke execute on function public.has_role(uuid, public.app_role) from anon;

commit;
