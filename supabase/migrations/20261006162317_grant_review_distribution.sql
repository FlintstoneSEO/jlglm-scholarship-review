-- Review Distribution: replacement eligibility and read-only pool summary.
-- Conflict attention is in-app only; no email outbox or delivery functions.
-- Auth bans are account inactivity; assignment deactivation remains application-specific.
create function private.grant_replacement_eligible(p_report uuid, p_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists (
 select 1 from public.grant_conflict_reports r
 join public.portal_applications a on a.id=r.application_id
 join auth.users u on u.id=p_user
 join public.profiles profile on profile.id=u.id
 where r.id=p_report and r.resolved_at is null and r.reviewer_id<>p_user
 and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
 and exists(select 1 from public.user_program_access x where x.program_id=r.program_id and x.user_id=p_user and x.access_role in ('reviewer','admin'))
 and not exists(select 1 from public.reviewer_assignments x where x.application_id=r.application_id and x.reviewer_id=p_user)
 and private.grant_practice_current(a.id)
 and (a.practice_session_id is null or exists(select 1 from public.grant_practice_sessions s where s.id=a.practice_session_id and p_user=any(s.participants)))
 );
$$;
revoke all on function private.grant_replacement_eligible(uuid,uuid) from public,anon,authenticated;
create function public.grant_conflict_replacement_candidates(p_report uuid)
returns table(id uuid,full_name text,active_applications bigint)
language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
 select program_id into p from public.grant_conflict_reports where grant_conflict_reports.id=p_report;
 if p is null then raise exception 'Conflict unavailable' using errcode='42501'; end if;
 perform private.assert_grant_committee_admin(p);
 return query select x.id,coalesce(nullif(x.full_name,''),'Unnamed reviewer'),
 (select count(*) from public.reviewer_assignments ra join public.portal_applications a on a.id=ra.application_id
 where ra.program_id=p and ra.reviewer_id=x.id and ra.lifecycle='active' and a.is_test=false and a.practice_session_id is null)
 from public.profiles x where private.grant_replacement_eligible(p_report,x.id) order by x.full_name,x.id;
end $$;
revoke all on function public.grant_conflict_replacement_candidates(uuid) from public,anon;
grant execute on function public.grant_conflict_replacement_candidates(uuid) to authenticated;
create or replace function public.resolve_grant_conflict(p_report uuid,p_decision text,p_reason text,p_replacement uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.grant_conflict_reports%rowtype; replacement uuid;
begin
 select * into r from public.grant_conflict_reports where id=p_report;
 if not found then raise exception 'Conflict unavailable'; end if;
 perform private.assert_grant_committee_admin(r.program_id);
 perform 1 from public.portal_applications where id=r.application_id for update;
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


-- Read-only pre-preview pool projection delegates to the existing snapshot rules.
create function public.grant_distribution_pool_summary(p_program uuid,p_session uuid default null)
returns table(eligible_applications bigint,total_applications bigint)
language plpgsql security definer set search_path='' as $$
begin
 perform private.assert_grant_committee_admin(p_program);
 if p_session is not null and not exists(select 1 from public.grant_practice_sessions where id=p_session and program_id=p_program and ended_at is null) then raise exception 'Practice session unavailable'; end if;
 return query select count(*) filter(where entry->>'exclusion' is null),count(*)
 from jsonb_array_elements(private.grant_committee_snapshot(p_program,p_session)) entry;
end $$;
revoke all on function public.grant_distribution_pool_summary(uuid,uuid) from public,anon;
grant execute on function public.grant_distribution_pool_summary(uuid,uuid) to authenticated;
