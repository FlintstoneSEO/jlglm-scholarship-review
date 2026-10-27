begin;

-- Limited cross-reviewer projection. Never return peer review rows, scores or comments.
create function private.grant_application_assignment_summary(p_application uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  target_program uuid;
  administrator boolean;
  roster jsonb;
  events jsonb;
begin
  if auth.uid() is null then
    raise exception 'Application access required' using errcode = '42501';
  end if;
  select a.program_id into target_program
  from public.portal_applications a join public.programs p on p.id = a.program_id
  where a.id = p_application and p.slug = 'business_growth_grant';
  if target_program is null or not private.current_user_can_access_application(p_application) then
    raise exception 'Application access required' using errcode = '42501';
  end if;
  administrator := private.current_user_has_program_role(target_program, array['admin']::public.program_access_role[]);

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignment_id', a.id, 'reviewer_id', a.reviewer_id,
    'reviewer_name', coalesce(nullif(btrim(p.full_name), ''), 'Former or unavailable account'),
    'assigned_at', a.assigned_at,
    'status', case
      when exists(select 1 from public.grant_conflict_reports c where c.assignment_id = a.id and c.resolved_at is null) then 'on_hold'
      when r.status = 'completed' then 'submitted'
      when r.status = 'in_progress' then 'draft'
      else 'not_started' end,
    'replaces', (select coalesce(nullif(btrim(op.full_name), ''), 'Former or unavailable account')
      from public.grant_conflict_resolutions z
      join public.grant_conflict_reports c on c.id = z.report_id
      left join public.profiles op on op.id = c.reviewer_id
      where z.replacement_assignment_id = a.id and z.decision = 'replaced'
      order by z.resolved_at desc, z.report_id limit 1)
  ) order by a.assigned_at, a.id), '[]'::jsonb) into roster
  from public.reviewer_assignments a
  left join public.profiles p on p.id = a.reviewer_id
  left join public.program_reviews r on r.assignment_id = a.id
  where a.application_id = p_application and a.lifecycle = 'active';

  select coalesce(jsonb_agg(e.payload order by e.occurred_at, e.event_order, e.event_id), '[]'::jsonb) into events
  from (
    select a.assigned_at as occurred_at, 0 as event_order, 'assignment:' || a.id as event_id,
      jsonb_build_object('id', 'assignment:' || a.id, 'kind', 'assigned', 'occurred_at', a.assigned_at,
        'reviewer_name', coalesce(nullif(btrim(p.full_name), ''), 'Former or unavailable account')) as payload
    from public.reviewer_assignments a left join public.profiles p on p.id = a.reviewer_id
    where a.application_id = p_application
    union all
    select c.reported_at, 1, 'report:' || c.id,
      jsonb_build_object('id', 'report:' || c.id, 'kind', 'conflict_reported', 'occurred_at', c.reported_at,
        'reviewer_name', coalesce(nullif(btrim(p.full_name), ''), 'Former or unavailable account'))
      || case when administrator then jsonb_build_object('reason', c.reason) else '{}'::jsonb end
    from public.grant_conflict_reports c left join public.profiles p on p.id = c.reviewer_id
    where c.application_id = p_application
    union all
    select z.resolved_at, 2, 'resolution:' || z.report_id,
      jsonb_build_object('id', 'resolution:' || z.report_id, 'kind', z.decision, 'occurred_at', z.resolved_at,
        'reviewer_name', coalesce(nullif(btrim(p.full_name), ''), 'Former or unavailable account'),
        'replacement_name', case when z.decision = 'replaced' then coalesce(nullif(btrim(rp.full_name), ''), 'Former or unavailable account') else null end)
      || case when administrator then jsonb_build_object('reason', z.reason,
        'actor_name', coalesce(nullif(btrim(actor.full_name), ''), 'Former or unavailable account')) else '{}'::jsonb end
    from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id = c.id
    left join public.profiles p on p.id = c.reviewer_id
    left join public.reviewer_assignments replacement on replacement.id = z.replacement_assignment_id and replacement.application_id = c.application_id
    left join public.profiles rp on rp.id = replacement.reviewer_id
    left join public.profiles actor on actor.id = z.resolved_by
    where c.application_id = p_application
    union all
    select a.deactivated_at, 3, 'deactivation:' || a.id,
      jsonb_build_object('id', 'deactivation:' || a.id, 'kind', 'deactivated', 'occurred_at', a.deactivated_at,
        'reviewer_name', coalesce(nullif(btrim(p.full_name), ''), 'Former or unavailable account'))
      || case when administrator then jsonb_build_object('actor_name', coalesce(nullif(btrim(actor.full_name), ''), 'Former or unavailable account')) else '{}'::jsonb end
    from public.reviewer_assignments a left join public.profiles p on p.id = a.reviewer_id
    left join public.profiles actor on actor.id = a.deactivated_by
    where a.application_id = p_application and a.deactivated_at is not null
  ) e;
  return jsonb_build_object('application_id', p_application, 'assignments', roster, 'history', events);
end;
$$;
revoke all on function private.grant_application_assignment_summary(uuid) from public, anon, authenticated;
grant execute on function private.grant_application_assignment_summary(uuid) to authenticated;

create function public.grant_application_assignment_summary(p_application uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.grant_application_assignment_summary(p_application);
$$;
revoke all on function public.grant_application_assignment_summary(uuid) from public, anon, authenticated;
grant execute on function public.grant_application_assignment_summary(uuid) to authenticated;
comment on function public.grant_application_assignment_summary(uuid) is
  'Authorized Grant application roster and redacted history; no peer scores, comments or private reasons.';
commit;
