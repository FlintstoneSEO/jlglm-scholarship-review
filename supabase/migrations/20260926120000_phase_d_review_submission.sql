begin;

-- Phase D preservation rationale
-- * All changes are additive except replacing permissive write/read policies and grants.
-- * No Scholarship or Grant review/score row is deleted, merged, or reinterpreted.
-- * 2026 Scholarship rows remain non-canonical historical rows; uniqueness applies only to
--   rows explicitly created by the 2027+ canonical boundary.
-- Preflight assumption: docs/phase-d-read-only-inventory.sql has been reviewed on the target.
-- If live schema/policies differ, stop. Historical duplicates are reported and reconciled
-- manually only when material; this migration never selects a survivor.
-- Rollback: cut callers back first. Columns/tables may remain safely; do not drop audit,
-- idempotency, rubric-version, or historical rows during rollback.

create extension if not exists pgcrypto;

do $$ begin
  create type public.assignment_lifecycle as enum ('active', 'suspended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.review_lifecycle_event as enum
    ('review_created', 'draft_saved', 'submitted', 'reopened', 'resubmitted');
exception when duplicate_object then null; end $$;

alter table public.reviewer_assignments
  add column if not exists lifecycle public.assignment_lifecycle not null default 'active',
  add column if not exists suspended_at timestamptz,
  add column if not exists reactivated_at timestamptz;

alter table public.reviews
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists canonical_identity boolean not null default false,
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null;

-- This cannot conflict with unmodified 2026 rows because canonical_identity defaults false.
create unique index if not exists reviews_future_canonical_identity_key
  on public.reviews(applicant_id, reviewer_id) where canonical_identity and reviewer_id is not null;

alter table public.program_reviews
  add column if not exists version integer not null default 1 check (version > 0),
  add column if not exists reopened_at timestamptz,
  add column if not exists reopened_by uuid references auth.users(id) on delete set null;

create table if not exists public.rubric_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  version integer not null check (version > 0),
  name text not null,
  active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  retired_at timestamptz,
  unique (program_id, version)
);
create unique index if not exists rubric_versions_one_active_per_program
  on public.rubric_versions(program_id) where active;

insert into public.rubric_versions(program_id, version, name, active)
select p.id, 1, 'Initial version', true
from public.programs p
on conflict (program_id, version) do nothing;

alter table public.rubric_criteria add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict;
update public.rubric_criteria rc set rubric_version_id = rv.id
from public.rubric_versions rv
where rc.rubric_version_id is null and rv.program_id = rc.program_id and rv.version = 1;
alter table public.rubric_criteria alter column rubric_version_id set not null;
alter table public.rubric_criteria drop constraint if exists rubric_criteria_program_id_name_key;
alter table public.rubric_criteria add constraint rubric_criteria_version_name_key unique (rubric_version_id, name);

alter table public.program_reviews add column if not exists rubric_version_id uuid references public.rubric_versions(id) on delete restrict;
update public.program_reviews pr set rubric_version_id = rv.id
from public.rubric_versions rv
where pr.rubric_version_id is null and rv.program_id = pr.program_id and rv.version = 1;
-- A program without criteria may have no version yet. Such a review remains readable but cannot
-- be newly submitted until an active rubric exists; do not invent a rubric to satisfy NOT NULL.

create or replace function private.protect_used_rubric_version()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_version uuid := coalesce(new.rubric_version_id, old.rubric_version_id);
begin
  if exists(select 1 from public.program_reviews where rubric_version_id=target_version) then
    raise exception 'review_submission:conflict:A rubric version used by a review is immutable' using errcode='P0001';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists rubric_criteria_protect_used_version on public.rubric_criteria;
create trigger rubric_criteria_protect_used_version before insert or update or delete on public.rubric_criteria
for each row execute function private.protect_used_rubric_version();

create table if not exists public.review_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  scholarship_review_id uuid references public.reviews(id) on delete restrict,
  program_review_id uuid references public.program_reviews(id) on delete restrict,
  actor_id uuid not null references auth.users(id) on delete restrict,
  event_type public.review_lifecycle_event not null,
  occurred_at timestamptz not null default now(),
  previous_status text,
  new_status text not null,
  request_key text,
  check (num_nonnulls(scholarship_review_id, program_review_id) = 1)
);

create table if not exists public.review_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  application_id uuid not null,
  intent text not null check (intent in ('save_draft','submit')),
  idempotency_key text not null check (length(idempotency_key) between 8 and 200),
  request_hash text not null,
  response jsonb,
  created_at timestamptz not null default now(),
  unique (actor_id, program_id, idempotency_key)
);

alter table public.rubric_versions enable row level security;
alter table public.review_lifecycle_events enable row level security;
alter table public.review_idempotency_keys enable row level security;
revoke all on public.rubric_versions, public.review_lifecycle_events, public.review_idempotency_keys from anon, authenticated;
grant select on public.rubric_versions to authenticated;

create policy rubric_versions_select on public.rubric_versions for select to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin','reviewer','viewer']::public.program_access_role[]))
);

-- Active assignments and Scholarship eligibility are authorization requirements.
create or replace function private.current_user_can_access_application(_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portal_applications pa
    where pa.id = _application_id and (
      (select private.current_user_has_program_role(pa.program_id, array['admin','viewer']::public.program_access_role[]))
      or (
        (select private.current_user_has_program_role(pa.program_id, array['reviewer']::public.program_access_role[]))
        and exists (
          select 1 from public.reviewer_assignments ra
          where ra.application_id = pa.id and ra.reviewer_id = (select auth.uid()) and ra.lifecycle = 'active'
        )
        and (
          not exists (select 1 from public.programs p where p.id = pa.program_id and p.slug = 'scholarship')
          or exists (select 1 from public.applicants a where a.application_id = pa.id and a.preliminary_screening_status = 'eligible_for_review')
        )
      )
    )
  )
$$;

-- Eligibility transitions suspend/reactivate existing assignments; no assignment is deleted.
create or replace function private.assign_scholarship_reviewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.application_id is null then return null; end if;
  if new.preliminary_screening_status = 'eligible_for_review' then
    update public.reviewer_assignments set lifecycle = 'active', reactivated_at = now(), suspended_at = null
      where application_id = new.application_id and lifecycle = 'suspended';
    insert into public.reviewer_assignments(application_id, program_id, reviewer_id)
    select new.application_id, pa.program_id, upa.user_id
    from public.portal_applications pa
    join public.user_program_access upa on upa.program_id = pa.program_id and upa.access_role = 'reviewer'
    where pa.id = new.application_id
    on conflict (application_id, reviewer_id) do update
      set lifecycle = 'active', reactivated_at = now(), suspended_at = null;
  else
    update public.reviewer_assignments set lifecycle = 'suspended', suspended_at = now()
      where application_id = new.application_id and lifecycle = 'active';
  end if;
  return null;
end $$;

-- Prevent bypassing lifecycle/atomicity with direct table writes. Reads remain protected by RLS.
revoke insert, update on public.reviews, public.program_reviews, public.review_scores from authenticated;

do $$ declare pol record; begin
  for pol in select policyname from pg_policies where schemaname='public' and tablename='reviews'
  loop execute format('drop policy if exists %I on public.reviews', pol.policyname); end loop;
end $$;
create policy reviews_select_phase_d on public.reviews for select to authenticated using (
  (reviewer_id = (select auth.uid()) and exists (
    select 1 from public.applicants a
    join public.reviewer_assignments ra on ra.application_id=a.application_id
    where a.id=reviews.applicant_id and a.preliminary_screening_status='eligible_for_review'
      and ra.reviewer_id=(select auth.uid()) and ra.lifecycle='active'
  ))
  or exists (
    select 1 from public.applicants a join public.portal_applications pa on pa.id = a.application_id
    where a.id = reviews.applicant_id
      and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[]))
  )
);

drop policy if exists program_reviews_select on public.program_reviews;
create policy program_reviews_select on public.program_reviews for select to authenticated using (
  reviewer_id = (select auth.uid())
  or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
-- Existing score policy already inherits the owner/admin boundary through program_reviews.

create or replace function private.phase_d_error(_code text, _message text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  raise exception 'review_submission:%:%', _code, _message using errcode = 'P0001';
end $$;

create or replace function private.claim_review_idempotency(
  _actor uuid, _program uuid, _application uuid, _intent text, _key text, _payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text; prior public.review_idempotency_keys%rowtype;
begin
  if _key is null or length(_key) < 8 then perform private.phase_d_error('validation','An idempotency key is required'); end if;
  h := encode(digest(convert_to(_payload::text, 'UTF8'), 'sha256'), 'hex');
  select * into prior from public.review_idempotency_keys
    where actor_id=_actor and program_id=_program and idempotency_key=_key for update;
  if found then
    if prior.request_hash <> h then perform private.phase_d_error('conflict','Idempotency key was reused with a different payload'); end if;
    if prior.response is not null then return prior.response || jsonb_build_object('replayed', true); end if;
    perform private.phase_d_error('conflict','An identical request is already in progress');
  end if;
  begin
    insert into public.review_idempotency_keys(actor_id,program_id,application_id,intent,idempotency_key,request_hash)
      values (_actor,_program,_application,_intent,_key,h);
  exception when unique_violation then
    select * into prior from public.review_idempotency_keys
      where actor_id=_actor and program_id=_program and idempotency_key=_key;
    if prior.request_hash <> h then perform private.phase_d_error('conflict','Idempotency key was reused with a different payload'); end if;
    if prior.response is not null then return prior.response || jsonb_build_object('replayed',true); end if;
    perform private.phase_d_error('conflict','An identical request is already in progress');
  end;
  return null;
end $$;

create or replace function public.submit_scholarship_review(
  p_applicant_id uuid, p_assignment_id uuid, p_review_id uuid default null,
  p_current_version integer default null, p_writing_score integer default null,
  p_rhetoric_score integer default null, p_comments text default null,
  p_recommendation public.recommendation default null,
  p_intent text default 'save_draft', p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); app public.applicants%rowtype; assignment public.reviewer_assignments%rowtype;
  existing public.reviews%rowtype; program_id uuid; replay jsonb; result jsonb; previous text;
  canonical boolean; event public.review_lifecycle_event;
begin
  if actor is null then perform private.phase_d_error('authorization','Authentication required'); end if;
  if p_intent not in ('save_draft','submit') then perform private.phase_d_error('validation','Unknown intent'); end if;
  if p_writing_score not between 0 and 9 or p_rhetoric_score not between 0 and 9 then
    perform private.phase_d_error('validation','Writing and Rhetoric must be integers from 0 through 9');
  end if;
  select a.* into app from public.applicants a where a.id=p_applicant_id;
  if not found or app.application_id is null then perform private.phase_d_error('unavailable','Scholarship application is unavailable'); end if;
  select pa.program_id into program_id from public.portal_applications pa join public.programs p on p.id=pa.program_id
    where pa.id=app.application_id and p.slug='scholarship';
  select * into assignment from public.reviewer_assignments ra where ra.id=p_assignment_id and ra.application_id=app.application_id
    and ra.program_id=program_id and ra.reviewer_id=actor and ra.lifecycle='active';
  if not found or app.preliminary_screening_status <> 'eligible_for_review' then
    perform private.phase_d_error('authorization','An active eligible assignment is required');
  end if;
  canonical := extract(year from coalesce(app.submission_date, app.created_at)) >= 2027;
  if not canonical then perform private.phase_d_error('already_submitted','The completed 2026 cycle is historical and locked'); end if;
  replay := private.claim_review_idempotency(actor,program_id,app.application_id,p_intent,p_idempotency_key,
    jsonb_build_object('applicant',p_applicant_id,'assignment',p_assignment_id,'review',p_review_id,'version',p_current_version,
      'writing',p_writing_score,'rhetoric',p_rhetoric_score,'comments',coalesce(p_comments,''),'recommendation',p_recommendation,'intent',p_intent));
  if replay is not null then return replay; end if;
  select * into existing from public.reviews where applicant_id=p_applicant_id and reviewer_id=actor and canonical_identity for update;
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
    values(program_id,existing.id,actor,event,previous,case when existing.is_complete then 'submitted' else 'in_progress' end,p_idempotency_key);
  result := jsonb_build_object('reviewId',existing.id,'status',case when existing.is_complete then 'submitted' else 'in_progress' end,
    'savedAt',existing.updated_at,'submittedAt',existing.submitted_at,'version',existing.version,'replayed',false);
  update public.review_idempotency_keys set response=result where actor_id=actor and program_id=program_id and idempotency_key=p_idempotency_key;
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
  program_id uuid; active_version uuid; replay jsonb; result jsonb; item jsonb; criterion public.rubric_criteria%rowtype;
  supplied_ids uuid[] := '{}'; previous text; event public.review_lifecycle_event;
begin
  if actor is null then perform private.phase_d_error('authorization','Authentication required'); end if;
  if p_intent not in ('save_draft','submit') or jsonb_typeof(p_criteria) <> 'array' then perform private.phase_d_error('validation','Invalid submission'); end if;
  select pa.program_id into program_id from public.portal_applications pa join public.programs p on p.id=pa.program_id
    where pa.id=p_application_id and p.slug='business_growth_grant';
  if not found then perform private.phase_d_error('unavailable','Grant application is unavailable'); end if;
  select * into assignment from public.reviewer_assignments ra where ra.id=p_assignment_id and ra.application_id=p_application_id
    and ra.program_id=program_id and ra.reviewer_id=actor and ra.lifecycle='active';
  if not found then perform private.phase_d_error('authorization','An active assignment is required'); end if;
  select id into active_version from public.rubric_versions where program_id=program_id and active for share;
  if active_version is null or p_rubric_version is distinct from active_version then perform private.phase_d_error('stale_rubric','Reload the active rubric'); end if;
  replay := private.claim_review_idempotency(actor,program_id,p_application_id,p_intent,p_idempotency_key,
    jsonb_build_object('application',p_application_id,'assignment',p_assignment_id,'review',p_review_id,'version',p_current_version,
      'rubric',p_rubric_version,'criteria',p_criteria,'comments',coalesce(p_comments,''),'intent',p_intent));
  if replay is not null then return replay; end if;
  select * into review from public.program_reviews where assignment_id=p_assignment_id for update;
  if found then
    if p_review_id is not null and p_review_id <> review.id then perform private.phase_d_error('conflict','Review identity mismatch'); end if;
    if p_current_version is null or p_current_version <> review.version then perform private.phase_d_error('stale_version','Review has changed'); end if;
    if review.status='completed' then perform private.phase_d_error('already_submitted','Administrator reopen is required'); end if;
    if review.rubric_version_id is distinct from active_version then perform private.phase_d_error('stale_rubric','Review belongs to another rubric version'); end if;
    previous := review.status::text;
  else
    if p_review_id is not null or coalesce(p_current_version,0) <> 0 then perform private.phase_d_error('stale_version','Review does not exist'); end if;
    insert into public.program_reviews(assignment_id,application_id,program_id,reviewer_id,status,reviewer_comments,started_at,rubric_version_id)
      values(p_assignment_id,p_application_id,program_id,actor,'in_progress',p_comments,now(),active_version) returning * into review;
    previous := null;
  end if;
  for item in select value from jsonb_array_elements(p_criteria) loop
    if not (item ? 'criterionId') or not (item ? 'value') then perform private.phase_d_error('validation','Each score needs criterionId and value'); end if;
    select * into criterion from public.rubric_criteria where id=(item->>'criterionId')::uuid and rubric_version_id=active_version and active;
    if not found or (item->>'value')::numeric < 0 or (item->>'value')::numeric > criterion.maximum_points then
      perform private.phase_d_error('validation','Criterion is invalid or outside its configured maximum');
    end if;
    if criterion.id = any(supplied_ids) then perform private.phase_d_error('validation','Criterion was supplied more than once'); end if;
    supplied_ids := array_append(supplied_ids,criterion.id);
    insert into public.review_scores(review_id,criterion_id,points) values(review.id,criterion.id,(item->>'value')::numeric)
      on conflict(review_id,criterion_id) do update set points=excluded.points,updated_at=now();
  end loop;
  if p_intent='submit' then
    -- Compare as sets to avoid client ordering.
    if (select count(*) from public.rubric_criteria where rubric_version_id=active_version and active) <> cardinality(supplied_ids)
       or exists(select 1 from public.rubric_criteria where rubric_version_id=active_version and active and not(id=any(supplied_ids))) then
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
    values(program_id,review.id,actor,event,previous,case when review.status='completed' then 'submitted' else 'in_progress' end,p_idempotency_key);
  result := jsonb_build_object('reviewId',review.id,'status',case when review.status='completed' then 'submitted' else 'in_progress' end,
    'savedAt',review.updated_at,'submittedAt',review.submitted_at,'version',review.version,'replayed',false);
  update public.review_idempotency_keys set response=result where actor_id=actor and program_id=program_id and idempotency_key=p_idempotency_key;
  return result;
end $$;

create or replace function public.reopen_review(p_program_slug text, p_review_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare actor uuid:=auth.uid(); program_id uuid; scholarship public.reviews%rowtype; grant_review public.program_reviews%rowtype;
begin
  select id into program_id from public.programs where slug=p_program_slug;
  if actor is null or program_id is null or not private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]) then
    perform private.phase_d_error('authorization','Program administrator access is required');
  end if;
  if p_program_slug='scholarship' then
    select * into scholarship from public.reviews where id=p_review_id for update;
    if not found or not scholarship.is_complete then perform private.phase_d_error('conflict','Review is not submitted'); end if;
    update public.reviews set is_complete=false,reopened_at=now(),reopened_by=actor,version=version+1,updated_at=now() where id=p_review_id returning * into scholarship;
    insert into public.review_lifecycle_events(program_id,scholarship_review_id,actor_id,event_type,previous_status,new_status)
      values(program_id,p_review_id,actor,'reopened','submitted','in_progress');
    return jsonb_build_object('reviewId',p_review_id,'status','in_progress','version',scholarship.version,'reopenedAt',scholarship.reopened_at);
  elsif p_program_slug='business_growth_grant' then
    select * into grant_review from public.program_reviews where id=p_review_id and program_id=program_id for update;
    if not found or grant_review.status<>'completed' then perform private.phase_d_error('conflict','Review is not submitted'); end if;
    update public.program_reviews set status='in_progress',reopened_at=now(),reopened_by=actor,version=version+1,updated_at=now() where id=p_review_id returning * into grant_review;
    insert into public.review_lifecycle_events(program_id,program_review_id,actor_id,event_type,previous_status,new_status)
      values(program_id,p_review_id,actor,'reopened','submitted','in_progress');
    return jsonb_build_object('reviewId',p_review_id,'status','in_progress','version',grant_review.version,'reopenedAt',grant_review.reopened_at);
  end if;
  perform private.phase_d_error('validation','Unsupported program'); return null;
end $$;

revoke all on function public.submit_scholarship_review(uuid,uuid,uuid,integer,integer,integer,text,public.recommendation,text,text) from public,anon;
revoke all on function public.submit_business_grant_review(uuid,uuid,uuid,integer,uuid,jsonb,text,text,text) from public,anon;
revoke all on function public.reopen_review(text,uuid) from public,anon;
grant execute on function public.submit_scholarship_review(uuid,uuid,uuid,integer,integer,integer,text,public.recommendation,text,text) to authenticated;
grant execute on function public.submit_business_grant_review(uuid,uuid,uuid,integer,uuid,jsonb,text,text,text) to authenticated;
grant execute on function public.reopen_review(text,uuid) to authenticated;

commit;
