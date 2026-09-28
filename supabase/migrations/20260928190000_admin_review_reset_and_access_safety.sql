begin;

-- The reset is deliberately the only authenticated deletion path for review activity.
create table public.admin_review_reset_events (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  application_id uuid not null references public.portal_applications(id) on delete restrict,
  assignment_id uuid not null references public.reviewer_assignments(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  review_id uuid not null,
  review_type text not null check (review_type in ('scholarship', 'business_growth_grant')),
  reset_by uuid not null references auth.users(id) on delete restrict,
  reset_at timestamptz not null default now(),
  reason text not null check (reason in ('test_data', 'entered_in_error', 'administrative_reset'))
);
create index admin_review_reset_events_program_time_idx on public.admin_review_reset_events(program_id, reset_at desc);
alter table public.admin_review_reset_events enable row level security;
revoke all on public.admin_review_reset_events from public, anon, authenticated;
grant select on public.admin_review_reset_events to authenticated;
create policy admin_review_reset_events_select on public.admin_review_reset_events for select to authenticated
  using ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));

-- Keep existing table reads but prevent direct review deletion by authenticated clients.
revoke delete on public.reviews, public.program_reviews, public.review_scores from authenticated;

create function public.admin_reset_review(p_review_id uuid, p_reason text default 'test_data')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  grant_review public.program_reviews%rowtype;
  scholarship_review public.reviews%rowtype;
  assignment public.reviewer_assignments%rowtype;
  scholarship_app uuid;
  scholarship_program uuid;
  kind text;
  target_application uuid;
  target_program uuid;
  reset_keys text[];
  other_reviews integer;
begin
  if actor is null then raise exception 'admin_reset_review: authentication required' using errcode = '42501'; end if;
  if p_reason not in ('test_data', 'entered_in_error', 'administrative_reset') or p_reason is null then
    raise exception 'admin_reset_review: invalid reason' using errcode = '22023';
  end if;

  select * into grant_review from public.program_reviews where id = p_review_id for update;
  if found then
    if not exists (select 1 from public.programs where id = grant_review.program_id and slug = 'business_growth_grant') then
      raise exception 'admin_reset_review: unsupported review program' using errcode = '22023';
    end if;
    select * into assignment from public.reviewer_assignments where id = grant_review.assignment_id for update;
    if not found or assignment.application_id <> grant_review.application_id
      or assignment.reviewer_id <> grant_review.reviewer_id then
      raise exception 'admin_reset_review: assignment mismatch' using errcode = '23514';
    end if;
    kind := 'business_growth_grant';
    target_application := grant_review.application_id;
    target_program := grant_review.program_id;
  else
    select * into scholarship_review from public.reviews where id = p_review_id for update;
    if not found or scholarship_review.reviewer_id is null then
      raise exception 'admin_reset_review: review not found or not assigned' using errcode = 'P0002';
    end if;
    select a.application_id, pa.program_id into scholarship_app, scholarship_program
      from public.applicants a join public.portal_applications pa on pa.id = a.application_id
      join public.programs p on p.id = pa.program_id and p.slug = 'scholarship'
      where a.id = scholarship_review.applicant_id;
    select * into assignment from public.reviewer_assignments
      where application_id = scholarship_app and reviewer_id = scholarship_review.reviewer_id for update;
    if not found then raise exception 'admin_reset_review: assignment not found' using errcode = 'P0002'; end if;
    kind := 'scholarship';
    target_application := scholarship_app;
    target_program := scholarship_program;
  end if;

  if target_program is null or not private.current_user_has_program_role(
    target_program, array['admin']::public.program_access_role[]) then
    raise exception 'admin_reset_review: program administrator access required' using errcode = '42501';
  end if;
  if assignment.lifecycle <> 'active' then
    raise exception 'admin_reset_review: assignment is not active' using errcode = '23514';
  end if;

  -- Audit stores identity and reason only. No scores, comments, or deleted content.
  insert into public.admin_review_reset_events
    (program_id, application_id, assignment_id, reviewer_id, review_id, review_type, reset_by, reason)
  values (target_program, target_application, assignment.id, assignment.reviewer_id,
    p_review_id, kind, actor, p_reason);

  if kind = 'business_growth_grant' then
    -- review_scores has CASCADE, but remove explicitly before the review. Lifecycle has RESTRICT.
    delete from public.grant_review_certifications where program_review_id = p_review_id;
    delete from public.review_lifecycle_events where program_review_id = p_review_id;
    delete from public.review_idempotency_keys
      where actor_id = assignment.reviewer_id and program_id = target_program
        and application_id = target_application;
    delete from public.review_scores where review_id = p_review_id;
    delete from public.program_reviews where id = p_review_id;
  else
    select array_agg(distinct request_key) into reset_keys
      from public.review_lifecycle_events
      where scholarship_review_id = p_review_id and request_key is not null;
    select count(*) into other_reviews from public.reviews
      where applicant_id = scholarship_review.applicant_id
        and reviewer_id = scholarship_review.reviewer_id and id <> p_review_id;
    delete from public.review_idempotency_keys
      where actor_id = assignment.reviewer_id and program_id = target_program
        and application_id = target_application
        and (other_reviews = 0 or idempotency_key = any(coalesce(reset_keys, array[]::text[]))
          or response->>'reviewId' = p_review_id::text);
    delete from public.review_lifecycle_events where scholarship_review_id = p_review_id;
    delete from public.reviews where id = p_review_id;
  end if;

  return jsonb_build_object('reviewId', p_review_id, 'applicationId', target_application,
    'assignmentId', assignment.id, 'reviewType', kind, 'status', 'not_started');
end $$;
revoke all on function public.admin_reset_review(uuid,text) from public, anon;
grant execute on function public.admin_reset_review(uuid,text) to authenticated;

-- Expose only the users and programs that the caller may administer. Global admins
-- see every active program and profile; program admins see members of their programs.
create function public.admin_list_user_access()
returns table (
  user_id uuid, email text, full_name text, first_name text, last_name text,
  account_setup_completed boolean, global_role public.app_role,
  program_id uuid, program_name text, access_role public.program_access_role
) language sql stable security definer set search_path = '' as $$
  with managed_programs as (
    select p.id, p.name from public.programs p
    where p.active and private.current_user_has_program_role(p.id, array['admin']::public.program_access_role[])
  ), visible_users as (
    select pr.* from public.profiles pr
    where private.current_user_is_global_admin()
      or exists (select 1 from managed_programs mp
        join public.user_program_access upa on upa.program_id = mp.id
        where upa.user_id = pr.id)
  )
  select pr.id, pr.email, pr.full_name, pr.first_name, pr.last_name,
    pr.account_setup_completed,
    coalesce((select ur.role from public.user_roles ur where ur.user_id = pr.id
      order by case ur.role when 'admin' then 1 when 'reviewer' then 2 else 3 end limit 1), 'viewer'::public.app_role),
    mp.id, mp.name, upa.access_role
  from visible_users pr cross join managed_programs mp
  left join public.user_program_access upa on upa.user_id = pr.id and upa.program_id = mp.id
  order by pr.full_name nulls last, pr.email, mp.name
$$;
revoke all on function public.admin_list_user_access() from public, anon;
grant execute on function public.admin_list_user_access() to authenticated;

-- Serialize global role changes and reject removal of the final admin even for
-- privileged server-side writes. The existing invitation service can still add admins.
create function private.protect_last_global_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role <> 'admin' or (tg_op = 'UPDATE' and new.role = 'admin') then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(31819, 5101);
  if (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'The last global administrator cannot be removed' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger protect_last_global_admin before delete or update of role on public.user_roles
for each row execute function private.protect_last_global_admin();

-- A single RPC replaces the previous two-request upsert/delete sequence.
create function public.admin_set_global_role(p_user_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not private.current_user_is_global_admin() then
    raise exception 'Global administrator access required' using errcode = '42501';
  end if;
  if p_user_id is null or p_role is null or not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Invalid user or role' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(31819, 5101);
  if p_role <> 'admin' and exists (select 1 from public.user_roles where user_id = p_user_id and role = 'admin')
    and (select count(*) from public.user_roles where role = 'admin') <= 1 then
    raise exception 'The last global administrator cannot be removed' using errcode = '23514';
  end if;
  insert into public.user_roles(user_id, role) values (p_user_id, p_role)
    on conflict (user_id, role) do nothing;
  delete from public.user_roles where user_id = p_user_id and role <> p_role;
end $$;
revoke all on function public.admin_set_global_role(uuid,public.app_role) from public, anon;
grant execute on function public.admin_set_global_role(uuid,public.app_role) to authenticated;

commit;
