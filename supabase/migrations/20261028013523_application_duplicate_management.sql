begin;

alter table public.portal_applications
 add column duplicate_of uuid references public.portal_applications(id) on delete restrict,
 add constraint duplicate_not_self check (duplicate_of is null or duplicate_of<>id);
create index portal_duplicate_target on public.portal_applications(duplicate_of) where duplicate_of is not null;

create table public.application_duplicate_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null unique references public.portal_applications(id) on delete restrict,
 retained_application_id uuid not null references public.portal_applications(id) on delete restrict,
 program_id uuid not null references public.programs(id),
 administrator_id uuid not null references auth.users(id) on delete restrict,
 occurred_at timestamptz not null default now(), reason text not null check(length(btrim(reason)) between 10 and 4000)
);
alter table public.application_duplicate_events enable row level security;
revoke all on public.application_duplicate_events from public,anon,authenticated;
grant select on public.application_duplicate_events to authenticated;
create policy duplicate_event_admin_read on public.application_duplicate_events for select to authenticated
 using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));

create function private.guard_duplicate_identity() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and old.duplicate_of is not null and
 (new.duplicate_of is distinct from old.duplicate_of or new.program_id<>old.program_id or new.practice_session_id is distinct from old.practice_session_id
 or new.practice_round is distinct from old.practice_round or new.external_submission_id is distinct from old.external_submission_id
 or new.data_source_id is distinct from old.data_source_id or new.source_record_key is distinct from old.source_record_key) then
 raise exception 'Duplicate designation and source identity are immutable; use the retained application'; end if;
 if tg_op='UPDATE' and (new.program_id<>old.program_id or new.practice_session_id is distinct from old.practice_session_id
 or new.practice_round is distinct from old.practice_round) and exists(select 1 from public.portal_applications where duplicate_of=old.id) then
 raise exception 'A retained application with duplicate history cannot change scope'; end if;
 return new;
end $$;
create trigger duplicate_identity before update on public.portal_applications
 for each row execute function private.guard_duplicate_identity();

-- These columns are server-owned even for program administrators. A SECURITY INVOKER
-- guard distinguishes direct API writes from the authorized SECURITY DEFINER action.
create function private.guard_duplicate_api_write() returns trigger
language plpgsql set search_path='' as $$
begin
 if current_user in ('authenticated','anon') and
 ((tg_op='INSERT' and new.duplicate_of is not null) or (tg_op='UPDATE' and
 (new.duplicate_of is distinct from old.duplicate_of))) then
 raise exception 'Use the administrator Mark as duplicate action' using errcode='42501'; end if;
 return new;
end $$;
create trigger duplicate_api_write before insert or update on public.portal_applications
 for each row execute function private.guard_duplicate_api_write();

create view public.active_portal_applications with(security_invoker=true) as
 select * from public.portal_applications where duplicate_of is null;
create view public.active_reviewer_assignments with(security_invoker=true) as
 select r.* from public.reviewer_assignments r join public.portal_applications a on a.id=r.application_id where a.duplicate_of is null;
create view public.active_program_reviews with(security_invoker=true) as
 select r.* from public.program_reviews r join public.portal_applications a on a.id=r.application_id where a.duplicate_of is null;
revoke all on public.active_portal_applications,public.active_reviewer_assignments,public.active_program_reviews from public,anon,authenticated;
grant select on public.active_portal_applications,public.active_reviewer_assignments,public.active_program_reviews to authenticated;

-- Add the designation to the existing RLS-preserving production projection.
create or replace view public.production_applications with(security_invoker=true) as
 select * from public.portal_applications where not is_test and duplicate_of is null;

create function private.assert_application_not_duplicate(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
declare excluded uuid;
begin
 select duplicate_of into excluded from public.portal_applications where id=p_application for update;
 if excluded is not null then
 perform private.phase_d_error('duplicate_application','This application is excluded as a duplicate. Its reviews are preserved history; draft saves and submissions are disabled.'); end if;
end $$;

create function private.guard_duplicate_review_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare parent uuid; old_parent uuid;
begin
 if tg_table_name in ('program_reviews','reviewer_assignments') then
 if tg_op<>'INSERT' then old_parent:=old.application_id; end if;
 if tg_op<>'DELETE' then parent:=new.application_id; end if;
 else
 if tg_op<>'INSERT' then select application_id into old_parent from public.program_reviews
 where id=coalesce((to_jsonb(old)->>'review_id')::uuid,(to_jsonb(old)->>'program_review_id')::uuid); end if;
 if tg_op<>'DELETE' then select application_id into parent from public.program_reviews
 where id=coalesce((to_jsonb(new)->>'review_id')::uuid,(to_jsonb(new)->>'program_review_id')::uuid); end if;
 end if;
 -- Order both parents consistently for attempts to move rows between applications.
 for parent in select distinct x from unnest(array[parent,old_parent]) x where x is not null order by x loop
 perform private.assert_application_not_duplicate(parent);
 end loop;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger aa_duplicate_review_write before insert or update or delete on public.program_reviews
 for each row execute function private.guard_duplicate_review_write();
create trigger aa_duplicate_score_write before insert or update or delete on public.review_scores
 for each row execute function private.guard_duplicate_review_write();
create trigger aa_duplicate_certification_write before insert or update or delete on public.grant_review_certifications
 for each row execute function private.guard_duplicate_review_write();
create trigger aa_duplicate_assignment_write before insert or update or delete on public.reviewer_assignments
 for each row execute function private.guard_duplicate_review_write();

create function private.grant_duplicate_impact(p_application uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; result jsonb;
begin
 select a.program_id into pid from public.portal_applications a join public.programs p on p.id=a.program_id
 where a.id=p_application and p.slug='business_growth_grant';
 if pid is null or auth.uid() is null or not private.current_user_has_program_role(pid,array['admin']::public.program_access_role[]) then
 raise exception 'Grant administrator access required' using errcode='42501'; end if;
 select jsonb_build_object('application_id',p_application,'assignments',coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'reviewer_name',coalesce(p.full_name,'Former or unavailable account'),'lifecycle',a.lifecycle,
 'review_status',coalesce(r.status::text,'not_started'),'review_version',r.version) order by a.id),'[]'::jsonb)) into result
 from public.reviewer_assignments a left join public.profiles p on p.id=a.reviewer_id
 left join public.program_reviews r on r.assignment_id=a.id where a.application_id=p_application;
 return result;
end $$;
create function public.grant_duplicate_impact(p_application uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.grant_duplicate_impact(p_application); $$;

create function private.mark_grant_application_duplicate(p_application uuid,p_retained uuid,p_reason text,p_expected_impact jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.portal_applications%rowtype; retained public.portal_applications%rowtype; event_id uuid;
begin
 -- Authorize before locking or exposing any target data.
 perform private.grant_duplicate_impact(p_application);
 if p_application=p_retained then raise exception 'Choose a different retained application'; end if;
 if p_retained is null or length(btrim(coalesce(p_reason,''))) not between 10 and 4000 then
 raise exception 'Choose a retained application and provide a reason (10–4000 characters)'; end if;
 perform 1 from public.portal_applications where id in (p_application,p_retained) order by id for update;
 select * into a from public.portal_applications where id=p_application;
 select * into retained from public.portal_applications where id=p_retained;
 if retained.id is null or retained.program_id<>a.program_id or retained.is_test<>a.is_test
 or retained.practice_session_id is distinct from a.practice_session_id or retained.practice_round is distinct from a.practice_round then
 raise exception 'Retained application must be in the same program and test/practice scope'; end if;
 if retained.duplicate_of is not null then raise exception 'Retained application is already excluded as a duplicate'; end if;
 if a.duplicate_of is not null then
 if a.duplicate_of=p_retained and exists(select 1 from public.application_duplicate_events where application_id=a.id and reason=btrim(p_reason)) then
 select id into event_id from public.application_duplicate_events where application_id=a.id; return event_id; end if;
 raise exception 'Application is already marked as a duplicate with a different request'; end if;
 if exists(select 1 from public.portal_applications where duplicate_of=a.id) then
 raise exception 'This application is retained by existing duplicates and cannot itself be excluded'; end if;
 if not private.grant_practice_current(a.id) or not private.grant_practice_current(retained.id) then raise exception 'Practice round has ended'; end if;
 -- Recheck authorization and impact after acquiring the same lock used by review writes.
 if private.grant_duplicate_impact(a.id) is distinct from p_expected_impact then
 raise exception 'Assignments or reviews changed. Refresh and review the confirmation again.'; end if;
 update public.portal_applications set duplicate_of=p_retained where id=a.id;
 insert into public.application_duplicate_events(application_id,retained_application_id,program_id,administrator_id,reason)
 values(a.id,p_retained,a.program_id,auth.uid(),btrim(p_reason)) returning id into event_id;
 return event_id;
end $$;
create function public.mark_grant_application_duplicate(p_application uuid,p_retained uuid,p_reason text,p_expected_impact jsonb)
returns uuid language sql security invoker set search_path='' as $$
 select private.mark_grant_application_duplicate(p_application,p_retained,p_reason,p_expected_impact);
$$;

revoke all on function private.guard_duplicate_identity(),private.guard_duplicate_api_write(),private.guard_duplicate_review_write(),private.assert_application_not_duplicate(uuid) from public,anon,authenticated;
revoke all on function private.grant_duplicate_impact(uuid),public.grant_duplicate_impact(uuid),
 private.mark_grant_application_duplicate(uuid,uuid,text,jsonb),public.mark_grant_application_duplicate(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.grant_duplicate_impact(uuid),public.grant_duplicate_impact(uuid),
 private.mark_grant_application_duplicate(uuid,uuid,text,jsonb),public.mark_grant_application_duplicate(uuid,uuid,text,jsonb) to authenticated;

-- Existing domain rules retained; only additive duplicate exclusions below.
create or replace function private.assert_no_grant_conflict(p_application uuid,p_reviewer uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize report and every competitive write on the same application.
 perform 1 from public.portal_applications a join public.programs p on p.id=a.program_id
 where a.id=p_application and p.slug='business_growth_grant' for update of a;
 if not found then return; end if;
 perform private.assert_application_not_duplicate(p_application);
 if exists(select 1 from public.grant_conflict_reports where application_id=p_application and reviewer_id=p_reviewer and (resolved_at is null or exists(select 1 from public.grant_conflict_resolutions z where z.report_id=grant_conflict_reports.id and z.decision='replaced'))) then
 perform private.phase_d_error('conflict_hold','Competitive review is on hold due to a reported or confirmed conflict'); end if;
end $$;
create or replace function private.grant_committee_snapshot(p_program uuid,p_session uuid)
returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object(
 'id',a.id,'name',a.applicant_name,'eligibility',coalesce(e.status::text,'not_reviewed'),'eligibilityUpdated',e.updated_at,
 'exclusion',case
 when exists(select 1 from public.reviewer_assignments r where r.application_id=a.id) then 'Existing assignment (active or suspended)'
 when exists(select 1 from public.program_reviews r where r.application_id=a.id)
 or exists(select 1 from public.admin_review_reset_events r where r.application_id=a.id)
 or exists(select 1 from public.review_idempotency_keys r where r.application_id=a.id) then 'Existing review activity or history'
 when coalesce(e.status::text,'not_reviewed')<>'eligible' then 'Eligibility not confirmed Eligible'
 else null end) order by a.id),'[]'::jsonb)
 from public.portal_applications a left join public.application_eligibility_reviews e on e.application_id=a.id
 where a.duplicate_of is null and a.program_id=p_program and a.practice_session_id is not distinct from p_session
 and (p_session is not null or not a.is_test)
 and (p_session is null or private.grant_practice_current(a.id));
$$;
create or replace function private.grant_replacement_eligible(p_report uuid, p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
 select 1 from public.grant_conflict_reports r
 join public.portal_applications a on a.id=r.application_id
 join auth.users u on u.id=p_user
 join public.profiles profile on profile.id=u.id
 where a.duplicate_of is null and r.id=p_report and r.resolved_at is null and r.reviewer_id<>p_user
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and exists(select 1 from public.user_program_access x where x.program_id=r.program_id and x.user_id=p_user and x.access_role in ('reviewer','admin'))
 and not exists(select 1 from public.reviewer_assignments x where x.application_id=r.application_id and x.reviewer_id=p_user)
 and private.grant_practice_current(a.id)
 and (a.practice_session_id is null or exists(select 1 from public.grant_practice_sessions s where s.id=a.practice_session_id and p_user=any(s.participants)))
 );
$$;
create or replace function public.grant_conflict_replacement_candidates(p_report uuid)
returns table(id uuid,full_name text,active_applications bigint)
language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
 select program_id into p from public.grant_conflict_reports where grant_conflict_reports.id=p_report;
 if p is null then raise exception 'Conflict unavailable' using errcode='42501'; end if;
 perform private.assert_grant_committee_admin(p);
 return query select x.id,coalesce(nullif(x.full_name,''),'Unnamed reviewer'),
 (select count(*) from public.reviewer_assignments ra join public.portal_applications a on a.id=ra.application_id
 where ra.program_id=p and ra.reviewer_id=x.id and ra.lifecycle='active' and a.duplicate_of is null and a.is_test=false and a.practice_session_id is null)
 from public.profiles x where private.grant_replacement_eligible(p_report,x.id) order by x.full_name,x.id;
end $$;
create or replace function private.assert_test_admin(p_application uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.portal_applications%rowtype;
begin
 select * into a from public.portal_applications where id=p_application for update;
 if not found or not a.is_test or auth.uid() is null
 or not private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]) then
 raise exception 'An authorized test application is required' using errcode='42501'; end if;
 perform private.assert_application_not_duplicate(p_application);
 if exists(select 1 from public.portal_applications where duplicate_of=p_application) then raise exception 'Retained duplicate history prevents reset or deletion'; end if;
 return a.program_id;
end $$;
create or replace view public.program_rankings with (security_invoker=true) as
select dense_rank() over(partition by a.program_id order by a.average_score desc,a.submitted_at asc nulls last,a.id) as rank,
 a.id as application_id,a.program_id,coalesce(d.business_name,a.applicant_name) as display_name,
 a.applicant_name,a.completed_review_count,a.average_score,a.review_status
from public.portal_applications a left join public.business_grant_application_details d on d.application_id=a.id
where a.duplicate_of is null and not a.is_test and private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]);
create or replace function public.resolve_grant_conflict(p_report uuid,p_decision text,p_reason text,p_replacement uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.grant_conflict_reports%rowtype; replacement uuid;
begin
 select * into r from public.grant_conflict_reports where id=p_report;
 if not found then raise exception 'Conflict unavailable'; end if;
 perform private.assert_grant_committee_admin(r.program_id);
 perform 1 from public.portal_applications where id=r.application_id for update;
 perform private.assert_application_not_duplicate(r.application_id);
 select * into r from public.grant_conflict_reports where id=p_report for update;
 if exists(select 1 from public.grant_conflict_resolutions where report_id=p_report) then raise exception 'Conflict already resolved'; end if;
 if not private.grant_practice_current(r.application_id) then raise exception 'Practice round has ended'; end if;
 if p_decision is null or p_decision not in ('cleared','replaced') or length(btrim(coalesce(p_reason,''))) not between 10 and 4000 then raise exception 'Choose a decision and provide a reason (10-4000 characters)'; end if;
 lock table public.user_program_access in share row exclusive mode;
 perform private.assert_grant_committee_admin(r.program_id);
 if p_decision='replaced' then
 if p_replacement is null or not private.grant_replacement_eligible(r.id,p_replacement) or p_replacement=r.reviewer_id or
 not exists(select 1 from public.user_program_access where program_id=r.program_id and user_id=p_replacement and access_role in ('reviewer','admin')) or
 exists(select 1 from public.reviewer_assignments where application_id=r.application_id and reviewer_id=p_replacement) or
 exists(select 1 from public.portal_applications a join public.grant_practice_sessions s on s.id=a.practice_session_id where a.id=r.application_id and not p_replacement=any(s.participants)) then
 raise exception 'Choose a different authorized reviewer without an existing assignment; practice replacements must be participants'; end if;
 update public.reviewer_assignments set lifecycle='suspended',suspended_at=now() where id=r.assignment_id;
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values(r.application_id,r.program_id,p_replacement,auth.uid()) returning id into replacement;
 else
 if p_replacement is not null then raise exception 'A cleared report has no replacement'; end if;
 end if;
 insert into public.grant_conflict_resolutions(report_id,decision,reason,resolved_by,replacement_assignment_id)
 values(r.id,p_decision,btrim(p_reason),auth.uid(),replacement);
 update public.grant_conflict_reports set resolved_at=now() where id=r.id;
 perform private.refresh_grant_totals(r.application_id);
 return replacement;
end $$;

create function private.grant_duplicate_candidates(p_application uuid,p_search text default '') returns jsonb
language plpgsql security definer set search_path='' as $$
declare source public.portal_applications%rowtype; result jsonb;
begin
 perform private.grant_duplicate_impact(p_application);
 select * into source from public.portal_applications where id=p_application;
 select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) into result from (
 select a.id,a.applicant_name,coalesce(d.business_name,a.applicant_name) as business_name
 from public.portal_applications a left join public.business_grant_application_details d on d.application_id=a.id
 where a.id<>source.id and a.program_id=source.program_id and a.is_test=source.is_test
 and a.practice_session_id is not distinct from source.practice_session_id
 and a.practice_round is not distinct from source.practice_round and a.duplicate_of is null
 and private.grant_practice_current(a.id)
 and (position(lower(left(coalesce(p_search,''),200)) in lower(a.applicant_name))>0
 or position(lower(left(coalesce(p_search,''),200)) in lower(coalesce(d.business_name,'')))>0)
 order by coalesce(d.business_name,a.applicant_name),a.id limit 50) c;
 return result;
end $$;
create function public.grant_duplicate_candidates(p_application uuid,p_search text default '') returns jsonb
language sql security invoker set search_path='' as $$ select private.grant_duplicate_candidates(p_application,p_search); $$;
revoke all on function private.grant_duplicate_candidates(uuid,text),public.grant_duplicate_candidates(uuid,text) from public,anon,authenticated;
grant execute on function private.grant_duplicate_candidates(uuid,text),public.grant_duplicate_candidates(uuid,text) to authenticated;

create or replace function private.grant_application_assignment_summary(p_application uuid)
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
    union all
    select e.occurred_at, 4, 'duplicate:' || e.id,
      jsonb_build_object('id','duplicate:' || e.id,'kind','marked_duplicate','occurred_at',e.occurred_at,
        'reviewer_name','All reviewers')
      || case when administrator then jsonb_build_object('reason',e.reason,'actor_name',coalesce(actor.full_name,'Former or unavailable account')) else '{}'::jsonb end
    from public.application_duplicate_events e left join public.profiles actor on actor.id=e.administrator_id
    where e.application_id=p_application
  ) e;
  return jsonb_build_object('application_id', p_application, 'assignments', roster, 'history', events);
end;
$$;
commit;
