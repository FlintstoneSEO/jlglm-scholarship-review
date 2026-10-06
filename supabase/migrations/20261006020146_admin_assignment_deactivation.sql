begin;

alter table public.reviewer_assignments
  add column deactivated_at timestamptz,
  add column deactivated_by uuid references auth.users(id) on delete restrict,
  add constraint assignment_deactivation_identity check (
    (deactivated_at is null and deactivated_by is null)
    or (deactivated_at is not null and deactivated_by is not null and lifecycle = 'suspended')
  );

-- Administrative deactivation survives automatic eligibility reactivation.
create or replace function private.assign_scholarship_reviewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.application_id is null then return null; end if;
  if new.preliminary_screening_status = 'eligible_for_review' then
    update public.reviewer_assignments set lifecycle = 'active', reactivated_at = now(), suspended_at = null
      where application_id = new.application_id and lifecycle = 'suspended' and deactivated_at is null;
    insert into public.reviewer_assignments(application_id, program_id, reviewer_id)
    select new.application_id, pa.program_id, upa.user_id
    from public.portal_applications pa
    join public.user_program_access upa on upa.program_id = pa.program_id and upa.access_role = 'reviewer'
    where pa.id = new.application_id
    on conflict (application_id, reviewer_id) do update
      set lifecycle = 'active', reactivated_at = now(), suspended_at = null
      where reviewer_assignments.deactivated_at is null;
  else
    update public.reviewer_assignments set lifecycle = 'suspended', suspended_at = now()
      where application_id = new.application_id and lifecycle = 'active';
  end if;
  return null;
end $$;

create function private.guard_assignment_deactivation()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    if old.deactivated_at is not null then raise exception 'Deactivated assignment history must be retained'; end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.deactivated_at is not null and (
    new.deactivated_at is distinct from old.deactivated_at
    or new.deactivated_by is distinct from old.deactivated_by
    or new.lifecycle <> 'suspended'
    or new.application_id is distinct from old.application_id
    or new.program_id is distinct from old.program_id
    or new.reviewer_id is distinct from old.reviewer_id
  ) then
    raise exception 'An administratively deactivated assignment cannot be reactivated or have its history changed';
  end if;
  -- Browser updates cannot fabricate the audit identity. The RPC runs as its owner.
  if tg_op = 'INSERT' then
    if current_user in ('authenticated', 'anon') and new.deactivated_at is not null then
      raise exception 'Use the administrator deactivation action' using errcode = '42501';
    end if;
    return new;
  end if;
  if current_user in ('authenticated', 'anon') and (
    new.deactivated_at is distinct from old.deactivated_at
    or new.deactivated_by is distinct from old.deactivated_by
  ) then raise exception 'Use the administrator deactivation action' using errcode = '42501'; end if;
  return new;
end $$;
create trigger guard_assignment_deactivation before insert or update or delete on public.reviewer_assignments
for each row execute function private.guard_assignment_deactivation();
revoke all on function private.guard_assignment_deactivation() from public, anon, authenticated;

create function public.admin_deactivate_assignment(p_assignment_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  assignment public.reviewer_assignments%rowtype;
  target_application uuid;
begin
  if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into assignment from public.reviewer_assignments where id = p_assignment_id;
  if not found or not private.current_user_has_program_role(
    assignment.program_id, array['admin']::public.program_access_role[]
  ) then raise exception 'Program administrator access is required' using errcode = '42501'; end if;
  target_application := assignment.application_id;
  -- Serialize with competitive review insertion and conflict operations before the row lock.
  perform 1 from public.portal_applications where id = target_application for update;
  select * into assignment from public.reviewer_assignments where id = p_assignment_id for update;
  if not found or assignment.application_id <> target_application or not private.current_user_has_program_role(
    assignment.program_id, array['admin']::public.program_access_role[]
  ) then raise exception 'Assignment changed; reload and try again' using errcode = '42501'; end if;
  if assignment.deactivated_at is not null then
    return jsonb_build_object('id', assignment.id, 'replayed', true);
  end if;
  if assignment.lifecycle <> 'active' then
    raise exception 'Only active assignments can be deactivated' using errcode = '23514';
  end if;
  if exists(select 1 from public.program_reviews where assignment_id = assignment.id)
    or exists(select 1 from public.reviews r join public.applicants a on a.id = r.applicant_id
      where a.application_id = assignment.application_id and r.reviewer_id = assignment.reviewer_id) then
    raise exception 'This assignment has a current review. Use Reset Review before deactivating it.' using errcode = '23514';
  end if;
  if exists(select 1 from public.grant_conflict_reports where assignment_id = assignment.id and resolved_at is null) then
    raise exception 'Resolve the reported conflict before changing this assignment.' using errcode = '23514';
  end if;
  update public.reviewer_assignments set lifecycle = 'suspended', suspended_at = now(),
    deactivated_at = now(), deactivated_by = actor where id = assignment.id;
  if exists(select 1 from public.programs where id = assignment.program_id and slug = 'business_growth_grant') then
    perform private.refresh_grant_totals(assignment.application_id);
  end if;
  return jsonb_build_object('id', assignment.id, 'replayed', false);
end $$;
revoke all on function public.admin_deactivate_assignment(uuid) from public, anon;
grant execute on function public.admin_deactivate_assignment(uuid) to authenticated;

-- A review request can have checked active status before waiting on deactivation.
-- Recheck the explicit marker at insertion while holding the same application lock.
create function private.guard_deactivated_assignment_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_application uuid;
begin
  if tg_table_name = 'program_reviews' then
    target_application := new.application_id;
  else
    select application_id into target_application from public.applicants where id = new.applicant_id;
  end if;
  perform 1 from public.portal_applications where id = target_application for update;
  if exists(select 1 from public.reviewer_assignments
    where application_id = target_application and reviewer_id = new.reviewer_id and deactivated_at is not null) then
    raise exception 'This assignment has been deactivated. Reload your review queue.' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger guard_deactivated_assignment_review before insert on public.program_reviews
for each row execute function private.guard_deactivated_assignment_review();
create trigger guard_deactivated_scholarship_assignment_review before insert on public.reviews
for each row execute function private.guard_deactivated_assignment_review();
revoke all on function private.guard_deactivated_assignment_review() from public, anon, authenticated;

commit;
