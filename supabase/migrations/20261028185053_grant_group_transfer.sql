begin;

-- Match ECMAScript trim() so whitespace-only reasons cannot bypass the UI rule.
create function private.trim_transfer_reason(value text) returns text
language sql immutable strict set search_path='' as $$
 select btrim(value, E' \t\n\r\f' || chr(11) || chr(160) || chr(5760) || chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) || chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) || chr(65279));
$$;
revoke all on function private.trim_transfer_reason(text) from public,anon,authenticated;

alter table public.reviewer_assignments add column transferred_at timestamptz;
create table public.grant_group_transfer_events (
 id uuid primary key, application_id uuid not null references public.portal_applications(id) on delete restrict,
 program_id uuid not null references public.programs(id), administrator_id uuid not null references auth.users(id) on delete restrict,
 occurred_at timestamptz not null default clock_timestamp(), reason text not null check(length(reason) between 10 and 4000 and reason=private.trim_transfer_reason(reason)),
 destination_group_id uuid not null references public.grant_reviewer_groups(id) on delete restrict,
 group_snapshot jsonb not null, original_assignment_ids uuid[] not null check(cardinality(original_assignment_ids)=2),
 resulting_assignment_ids uuid[] not null check(cardinality(resulting_assignment_ids)=2),
 expected_impact jsonb not null
);
create index grant_transfers_application_time on public.grant_group_transfer_events(application_id,occurred_at desc,id);
create index grant_transfers_program on public.grant_group_transfer_events(program_id);
create index grant_transfers_actor on public.grant_group_transfer_events(administrator_id);
create index grant_transfers_group on public.grant_group_transfer_events(destination_group_id);
alter table public.grant_group_transfer_events enable row level security;
revoke all on public.grant_group_transfer_events from public,anon,authenticated;
grant select on public.grant_group_transfer_events to authenticated;
create policy grant_transfer_admin_read on public.grant_group_transfer_events for select to authenticated
 using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));

-- A transfer is separate from conflict suspension and administrative deactivation.
create function private.guard_transferred_assignment() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then
 if old.transferred_at is not null then raise exception 'Transferred assignment history must be retained'; end if;
 return old; end if;
 if tg_op='UPDATE' and old.transferred_at is not null and new is distinct from old then
 raise exception 'Transferred assignments are immutable and cannot be reactivated'; end if;
 if current_user in ('authenticated','anon') and
 ((tg_op='INSERT' and new.transferred_at is not null) or
 (tg_op='UPDATE' and new.transferred_at is distinct from old.transferred_at)) then
 raise exception 'Use the administrator Transfer to another group action' using errcode='42501'; end if;
 if new.transferred_at is not null and new.lifecycle<>'suspended' then raise exception 'Transferred assignments must remain suspended'; end if;
 return new;
end $$;
create trigger guard_transferred_assignment before insert or update or delete on public.reviewer_assignments
 for each row execute function private.guard_transferred_assignment();

create function private.guard_transfer_pair() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'INSERT' and exists(select 1 from public.grant_group_transfer_events where application_id=old.application_id and old.id=any(resulting_assignment_ids)) then
 if tg_op='DELETE' then raise exception 'Transfer assignment history must be retained'; end if;
 if new.application_id<>old.application_id or new.program_id<>old.program_id or new.reviewer_id<>old.reviewer_id then raise exception 'Transfer assignment identity must be retained'; end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 if new.lifecycle='active' and exists(select 1 from public.grant_group_transfer_events where application_id=new.application_id)
 and (select count(*) from public.reviewer_assignments where application_id=new.application_id and lifecycle='active' and id<>new.id)>=2 then
 raise exception 'This transferred application already has its two active reviewers; use group transfer or conflict resolution'; end if;
 return new;
end $$;
create trigger zz_guard_transfer_pair before insert or update or delete on public.reviewer_assignments
 for each row execute function private.guard_transfer_pair();

-- Existing app lock also protects declarations, review/score/certification writes and
-- idempotency replay. Do not change the Scholarship branch of this shared helper.
create or replace function private.assert_grant_clearance(p_application uuid,p_reviewer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.portal_applications a join public.programs p on p.id=a.program_id where a.id=p_application and p.slug='business_growth_grant') then return; end if;
 perform 1 from public.portal_applications where id=p_application for update;
 if exists(select 1 from public.reviewer_assignments where application_id=p_application and reviewer_id=p_reviewer and transferred_at is not null) then
 perform private.phase_d_error('assignment_transferred','This assignment was transferred. Its review is excluded history and cannot be changed.'); end if;
 if not private.grant_practice_current(p_application) then perform private.phase_d_error('practice_ended','Practice round has ended'); end if;
 if not exists(select 1 from public.reviewer_assignments a join public.grant_conflict_declarations d on d.assignment_id=a.id and d.reviewer_id=a.reviewer_id
 where a.application_id=p_application and a.reviewer_id=p_reviewer and a.lifecycle='active') then
 perform private.phase_d_error('conflict_declaration_required','Record no known conflict before competitive scoring'); end if;
end $$;

-- Defense against historical delete/reopen/reset paths, including privileged RPCs.
create function private.guard_transferred_review_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb; assignment uuid; app uuid;
begin
 for row_data in select x from unnest(array[case when tg_op<>'INSERT' then to_jsonb(old) end,case when tg_op<>'DELETE' then to_jsonb(new) end]) x where x is not null loop
 if tg_table_name='program_reviews' then
 assignment:=(row_data->>'assignment_id')::uuid; app:=(row_data->>'application_id')::uuid;
 else
 select assignment_id,application_id into assignment,app from public.program_reviews
 where id=coalesce((row_data->>'review_id')::uuid,(row_data->>'program_review_id')::uuid);
 end if;
 perform 1 from public.portal_applications where id=app for update;
 if exists(select 1 from public.reviewer_assignments where id=assignment and transferred_at is not null) then
 raise exception 'Transferred review is excluded history and cannot be changed'; end if;
 end loop;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger ab_transfer_review_write before insert or update or delete on public.program_reviews for each row execute function private.guard_transferred_review_write();
create trigger ab_transfer_score_write before insert or update or delete on public.review_scores for each row execute function private.guard_transferred_review_write();
create trigger ab_transfer_certification_write before insert or update or delete on public.grant_review_certifications for each row execute function private.guard_transferred_review_write();

create or replace view public.active_reviewer_assignments with(security_invoker=true) as
 select r.* from public.reviewer_assignments r join public.portal_applications a on a.id=r.application_id where a.duplicate_of is null and r.transferred_at is null;
create or replace view public.active_program_reviews with(security_invoker=true) as
 select r.* from public.program_reviews r join public.portal_applications a on a.id=r.application_id
 join public.reviewer_assignments x on x.id=r.assignment_id where a.duplicate_of is null and x.transferred_at is null;

create or replace function private.refresh_grant_totals(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.portal_applications a set
 completed_review_count=(select count(*) from public.program_reviews r join public.reviewer_assignments x on x.id=r.assignment_id where r.application_id=a.id and x.transferred_at is null and r.status='completed' and not exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=r.assignment_id and z.decision='replaced')),
 average_score=coalesce((select avg(r.total_score) from public.program_reviews r join public.reviewer_assignments x on x.id=r.assignment_id where r.application_id=a.id and x.transferred_at is null and r.status='completed' and not exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=r.assignment_id and z.decision='replaced')),0),
 review_status=case
 when exists(select 1 from public.reviewer_assignments x join public.program_reviews r on r.assignment_id=x.id where x.application_id=a.id and x.lifecycle='active' and r.status='completed') and not exists(select 1 from public.reviewer_assignments x left join public.program_reviews r on r.assignment_id=x.id where x.application_id=a.id and x.lifecycle='active' and coalesce(r.status::text,'not_started')<>'completed') then 'completed'::public.portal_review_status
 when exists(select 1 from public.program_reviews r join public.reviewer_assignments x on x.id=r.assignment_id where r.application_id=a.id and x.transferred_at is null and r.status<>'not_started' and not exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=r.assignment_id and z.decision='replaced')) then 'in_progress'::public.portal_review_status
 else 'not_started'::public.portal_review_status end,updated_at=now() where a.id=p_application;
end $$;

create function private.grant_original_group(p_application uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select p.group_snapshot->((e.value->>'pair')::integer-1) from public.grant_allocation_previews p
 cross join lateral jsonb_array_elements(p.allocation) e(value)
 where p.applied_at is not null and e.value->>'applicationId'=p_application::text and e.value->>'pair' is not null
 order by p.applied_at desc,p.id limit 1;
$$;
create function private.grant_transfer_ownership(p_application uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(
 (select group_snapshot from public.grant_group_transfer_events where application_id=p_application order by occurred_at desc,id desc limit 1),
 (select p.group_snapshot->((e.value->>'pair')::integer-1) from public.grant_allocation_previews p
 cross join lateral jsonb_array_elements(p.allocation) e(value)
 where p.applied_at is not null and e.value->>'applicationId'=p_application::text and e.value->>'pair' is not null
 order by p.applied_at desc,p.id limit 1));
$$;

create function private.grant_transfer_impact(p_application uuid,p_group uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.portal_applications%rowtype; g public.grant_reviewer_groups%rowtype;
 members jsonb; assignments jsonb; conflicts jsonb; ownership jsonb;
begin
 select pa.* into a from public.portal_applications pa join public.programs p on p.id=pa.program_id where pa.id=p_application and p.slug='business_growth_grant';
 if a.id is null or auth.uid() is null or not private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]) then
 raise exception 'Grant administrator access required' using errcode='42501'; end if;
 if a.duplicate_of is not null or a.status not in ('submitted','complete') then raise exception 'Transfer requires an active, nonduplicate application'; end if;
 if not exists(select 1 from public.application_eligibility_reviews where application_id=a.id and status='eligible') then raise exception 'Confirm this application Eligible before transferring'; end if;
 if not private.grant_practice_current(a.id) then raise exception 'Practice round has ended'; end if;
 if (select count(*) from public.reviewer_assignments where application_id=a.id and lifecycle='active')<>2 then raise exception 'Transfer requires exactly two active reviewers; resolve assignment administration first'; end if;
 if exists(select 1 from public.grant_conflict_reports where application_id=a.id and resolved_at is null) then raise exception 'Resolve outstanding conflicts before transferring'; end if;
 select * into g from public.grant_reviewer_groups where id=p_group and program_id=a.program_id;
 if g.id is null then raise exception 'Choose a saved group in this program'; end if;
 ownership:=private.grant_transfer_ownership(a.id);
 if ownership->>'id'=g.id::text then raise exception 'Choose a different saved group from the current group'; end if;
 if (select count(distinct user_id) from public.grant_reviewer_group_members where group_id=g.id)<>2 then raise exception 'Destination group must contain exactly two distinct reviewers'; end if;
 if exists(select 1 from public.grant_reviewer_group_members m left join auth.users u on u.id=m.user_id left join public.profiles p on p.id=m.user_id where m.group_id=g.id and
 (u.id is null or p.id is null or u.deleted_at is not null or (u.banned_until is not null and u.banned_until>now()) or not p.account_setup_completed
 or not exists(select 1 from public.user_program_access x where x.user_id=m.user_id and x.program_id=a.program_id and x.access_role in ('reviewer','admin'))
 or (a.practice_session_id is not null and not exists(select 1 from public.grant_practice_sessions s where s.id=a.practice_session_id and m.user_id=any(s.participants))))) then
 raise exception 'Destination reviewers must have available, setup-complete authorized accounts and be participants in this practice session'; end if;
 if exists(select 1 from public.grant_reviewer_group_members m join public.reviewer_assignments x on x.reviewer_id=m.user_id and x.application_id=a.id where m.group_id=g.id) then
 raise exception 'A destination reviewer already has an active or historical assignment. Choose a group with two reviewers who have never been assigned this application; history cannot be reused'; end if;
 if exists(select 1 from public.grant_reviewer_group_members m join public.grant_conflict_reports c on c.reviewer_id=m.user_id and c.application_id=a.id where m.group_id=g.id) then raise exception 'Destination reviewer has conflict history for this application; choose another group'; end if;
 select jsonb_agg(jsonb_build_object('id',m.user_id,'name',coalesce(nullif(p.full_name,''),'Unnamed reviewer'),'access',x.access_role,'setup',p.account_setup_completed,'banned_until',u.banned_until) order by m.user_id) into members
 from public.grant_reviewer_group_members m join public.profiles p on p.id=m.user_id join auth.users u on u.id=m.user_id join public.user_program_access x on x.user_id=m.user_id and x.program_id=a.program_id where m.group_id=g.id;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'reviewer_id',x.reviewer_id,'reviewer_name',coalesce(nullif(p.full_name,''),'Former or unavailable account'),'lifecycle',x.lifecycle,'transferred_at',x.transferred_at,
 'assignment',to_jsonb(x),'review_status',coalesce(r.status::text,'not_started'),'review',to_jsonb(r),
 'scores',(select coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]') from public.review_scores s where s.review_id=r.id),
 'certifications',(select coalesce(jsonb_agg(to_jsonb(c) order by c.id),'[]') from public.grant_review_certifications c where c.program_review_id=r.id)) order by x.id),'[]') into assignments
 from public.reviewer_assignments x left join public.profiles p on p.id=x.reviewer_id left join public.program_reviews r on r.assignment_id=x.id where x.application_id=a.id;
 select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('resolution',to_jsonb(z)) order by c.id),'[]') into conflicts
 from public.grant_conflict_reports c left join public.grant_conflict_resolutions z on z.report_id=c.id where c.application_id=a.id;
 return jsonb_build_object('application_id',a.id,'scope',jsonb_build_object('program_id',a.program_id,'is_test',a.is_test,'session',a.practice_session_id,'round',a.practice_round,'status',a.status),
 'eligibility',(select to_jsonb(e) from public.application_eligibility_reviews e where e.application_id=a.id),
 'current_group',ownership,'original_group',private.grant_original_group(a.id),'group',jsonb_build_object('id',g.id,'name',g.name,'revision',g.revision,'members',members),
 'assignments',assignments,'conflicts',conflicts,'completed_review_count',a.completed_review_count,'average_score',a.average_score);
end $$;
create function private.grant_transfer_groups(p_application uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare pid uuid; g record; result jsonb:='[]'; failure text;
begin
 select a.program_id into pid from public.portal_applications a join public.programs p on p.id=a.program_id where a.id=p_application and p.slug='business_growth_grant';
 if pid is null or auth.uid() is null or not private.current_user_has_program_role(pid,array['admin']::public.program_access_role[]) then raise exception 'Grant administrator access required' using errcode='42501'; end if;
 for g in select * from public.grant_reviewer_groups where program_id=pid order by name,id loop
 failure:=null;
 begin perform private.grant_transfer_impact(p_application,g.id); exception when others then failure:=sqlerrm; end;
 result:=result||jsonb_build_array(jsonb_build_object('id',g.id,'name',g.name,'unavailable_reason',failure));
 end loop;
 return result;
end $$;
create function public.grant_transfer_groups(p_application uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.grant_transfer_groups(p_application); $$;
revoke all on function private.grant_transfer_groups(uuid),public.grant_transfer_groups(uuid) from public,anon,authenticated;
grant execute on function private.grant_transfer_groups(uuid),public.grant_transfer_groups(uuid) to authenticated;

create function public.grant_transfer_impact(p_application uuid,p_group uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.grant_transfer_impact(p_application,p_group); $$;

create function private.transfer_grant_application(p_application uuid,p_group uuid,p_reason text,p_expected_impact jsonb,p_request uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare a public.portal_applications%rowtype; prior public.grant_group_transfer_events%rowtype; impact jsonb;
 originals uuid[]; results uuid[]:='{}'; member uuid; assignment uuid; snap jsonb; clean_reason text:=private.trim_transfer_reason(p_reason);
begin
 -- Authorize without depending on the now potentially transferred preview state.
 select pa.* into a from public.portal_applications pa join public.programs p on p.id=pa.program_id where pa.id=p_application and p.slug='business_growth_grant';
 if a.id is null or auth.uid() is null or not private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]) then raise exception 'Grant administrator access required' using errcode='42501'; end if;
 if p_request is null or length(coalesce(clean_reason,'')) not between 10 and 4000 then raise exception 'Provide a reason (10–4000 trimmed characters) and request key'; end if;
 lock table public.grant_reviewer_groups,public.grant_reviewer_group_members in share row exclusive mode;
 lock table public.user_program_access in share row exclusive mode;
 perform private.assert_grant_committee_admin(a.program_id);
 perform 1 from auth.users u join public.grant_reviewer_group_members m on m.user_id=u.id where m.group_id=p_group order by u.id for share of u;
 perform 1 from public.profiles p join public.grant_reviewer_group_members m on m.user_id=p.id where m.group_id=p_group order by p.id for share of p;
 if a.practice_session_id is not null then perform 1 from public.grant_practice_sessions where id=a.practice_session_id for share; end if;
 -- Eligibility writers lock this parent before changing verification/confirmation.
 perform 1 from public.application_eligibility_reviews where application_id=a.id for update;
 perform 1 from public.portal_applications where id=a.id for update;
 select * into prior from public.grant_group_transfer_events where id=p_request;
 if found then
 if prior.administrator_id=auth.uid() and prior.application_id=p_application and prior.destination_group_id=p_group and prior.reason=clean_reason and prior.expected_impact=p_expected_impact then return prior.id; end if;
 raise exception 'Request key already used for a different transfer'; end if;
 perform 1 from public.reviewer_assignments where application_id=a.id order by id for update;
 perform 1 from public.program_reviews where application_id=a.id order by id for update;
 impact:=private.grant_transfer_impact(a.id,p_group);
 if impact is distinct from p_expected_impact then raise exception 'Transfer preview is stale. Refresh and review the impact again.'; end if;
 select array_agg(id order by id) into originals from public.reviewer_assignments where application_id=a.id and lifecycle='active';
 -- Exclude every earlier review, including a previously suspended assignment that
 -- was not a conflict replacement. Keep earlier suspension timestamps intact.
 update public.reviewer_assignments set lifecycle='suspended',suspended_at=coalesce(suspended_at,now()),transferred_at=now()
 where application_id=a.id and transferred_at is null;
 for member in select user_id from public.grant_reviewer_group_members where group_id=p_group order by user_id loop
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by) values(a.id,a.program_id,member,auth.uid()) returning id into assignment;
 results:=array_append(results,assignment);
 end loop;
 snap:=impact->'group';
 -- Match frozen allocation group snapshot shape; names/access remain in expected_impact.
 snap:=jsonb_set(snap,'{members}',(select jsonb_agg(m->'id' order by m->>'id') from jsonb_array_elements(snap->'members') m));
 insert into public.grant_group_transfer_events(id,application_id,program_id,administrator_id,reason,destination_group_id,group_snapshot,original_assignment_ids,resulting_assignment_ids,expected_impact)
 values(p_request,a.id,a.program_id,auth.uid(),clean_reason,p_group,snap,originals,results,impact);
 if (select count(*) from public.reviewer_assignments where application_id=a.id and lifecycle='active')<>2 then raise exception 'Transfer must result in exactly two active assignments'; end if;
 perform private.refresh_grant_totals(a.id);
 return p_request;
end $$;
create function public.transfer_grant_application(p_application uuid,p_group uuid,p_reason text,p_expected_impact jsonb,p_request uuid) returns uuid
language sql security invoker set search_path='' as $$ select private.transfer_grant_application(p_application,p_group,p_reason,p_expected_impact,p_request); $$;

-- Preserve original summary's redaction and append current ownership and transfer history.
alter function private.grant_application_assignment_summary(uuid) rename to grant_assignment_summary_before_transfer;
create function private.grant_application_assignment_summary(p_application uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare base jsonb; events jsonb; historical jsonb; admin boolean;
begin
 base:=private.grant_assignment_summary_before_transfer(p_application);
 select private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]) into admin from public.portal_applications where id=p_application;
 select coalesce(jsonb_agg(jsonb_build_object('id','transfer:'||e.id,'kind','transferred','occurred_at',e.occurred_at,'reviewer_name','Previous group','replacement_name',e.group_snapshot->>'name')
 ||case when admin then jsonb_build_object('reason',e.reason,'actor_name',coalesce(p.full_name,'Former or unavailable account')) else '{}'::jsonb end order by e.occurred_at,e.id),'[]') into events
 from public.grant_group_transfer_events e left join public.profiles p on p.id=e.administrator_id where e.application_id=p_application;
 select coalesce(jsonb_agg(jsonb_build_object('reviewer_name',coalesce(p.full_name,'Former or unavailable account'),'review_status',coalesce(r.status::text,'not_started'),'transferred_at',x.transferred_at) order by x.transferred_at,x.id),'[]') into historical
 from public.reviewer_assignments x left join public.profiles p on p.id=x.reviewer_id left join public.program_reviews r on r.assignment_id=x.id where x.application_id=p_application and x.transferred_at is not null;
 return base||jsonb_build_object('current_group',private.grant_transfer_ownership(p_application),'original_group',private.grant_original_group(p_application),
 'history',(select coalesce(jsonb_agg(e order by e->>'occurred_at',e->>'id'),'[]') from jsonb_array_elements((base->'history')||events) e),'excluded_transfer_reviews',historical);
end $$;

revoke all on function private.guard_transfer_pair(),private.guard_transferred_assignment(),private.guard_transferred_review_write(),private.grant_transfer_ownership(uuid),private.grant_original_group(uuid),private.grant_assignment_summary_before_transfer(uuid) from public,anon,authenticated;
revoke all on function private.grant_application_assignment_summary(uuid),private.grant_transfer_impact(uuid,uuid),public.grant_transfer_impact(uuid,uuid),private.transfer_grant_application(uuid,uuid,text,jsonb,uuid),public.transfer_grant_application(uuid,uuid,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function private.grant_application_assignment_summary(uuid),private.grant_transfer_impact(uuid,uuid),public.grant_transfer_impact(uuid,uuid),private.transfer_grant_application(uuid,uuid,text,jsonb,uuid),public.transfer_grant_application(uuid,uuid,text,jsonb,uuid) to authenticated;
commit;
