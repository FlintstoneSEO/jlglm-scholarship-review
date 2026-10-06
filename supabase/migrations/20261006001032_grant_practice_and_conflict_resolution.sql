begin;
create table public.grant_practice_sessions (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references public.programs(id),
 name text not null check(length(btrim(name)) between 1 and 80),
 participants uuid[] not null check(cardinality(participants) between 2 and 20),
 round integer not null default 1, ended_at timestamptz,
 created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.grant_practice_events (
 id uuid primary key default gen_random_uuid(), session_id uuid not null references public.grant_practice_sessions(id),
 actor_id uuid not null references auth.users(id), action text not null, round integer not null,
 occurred_at timestamptz not null default now()
);
alter table public.portal_applications add column practice_session_id uuid references public.grant_practice_sessions(id),
 add column practice_round integer;
alter table public.portal_applications add constraint practice_marker check ((practice_session_id is null)=(practice_round is null));
create index grant_practice_application_scope on public.portal_applications(practice_session_id,practice_round);
alter table public.grant_allocation_previews add column practice_session_id uuid references public.grant_practice_sessions(id);
create table public.grant_conflict_declarations (
 assignment_id uuid primary key references public.reviewer_assignments(id) on delete restrict,
 reviewer_id uuid not null references auth.users(id), declared_at timestamptz not null default now(),
 statement_version text not null default 'grant_no_conflict_v1'
);
create table public.grant_conflict_resolutions (
 report_id uuid primary key references public.grant_conflict_reports(id),
 decision text not null check(decision in ('cleared','replaced')),
 reason text not null check(length(btrim(reason)) between 10 and 4000),
 resolved_by uuid not null references auth.users(id), resolved_at timestamptz not null default now(),
 replacement_assignment_id uuid references public.reviewer_assignments(id),
 check ((decision='replaced')=(replacement_assignment_id is not null))
);
alter table public.grant_conflict_reports drop constraint grant_conflict_reports_assignment_id_key;
create unique index grant_one_open_conflict on public.grant_conflict_reports(assignment_id) where resolved_at is null;
-- New tables expose read-only, scoped data. Every mutation uses an authorized RPC.
alter table public.grant_practice_sessions enable row level security;
alter table public.grant_practice_events enable row level security;
alter table public.grant_conflict_declarations enable row level security;
alter table public.grant_conflict_resolutions enable row level security;
revoke all on public.grant_practice_sessions,public.grant_practice_events,public.grant_conflict_declarations,public.grant_conflict_resolutions from public,anon,authenticated;
grant select on public.grant_practice_sessions,public.grant_practice_events,public.grant_conflict_declarations,public.grant_conflict_resolutions to authenticated;
create policy practice_session_read on public.grant_practice_sessions for select to authenticated using
 (auth.uid()=any(participants) or private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));
create policy practice_event_read on public.grant_practice_events for select to authenticated using
 (exists(select 1 from public.grant_practice_sessions s where s.id=session_id and private.current_user_has_program_role(s.program_id,array['admin']::public.program_access_role[])));
create policy declaration_read on public.grant_conflict_declarations for select to authenticated using
 (reviewer_id=auth.uid() or exists(select 1 from public.reviewer_assignments a where a.id=assignment_id and private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[])));
create policy resolution_read on public.grant_conflict_resolutions for select to authenticated using
 (exists(select 1 from public.grant_conflict_reports r where r.id=report_id));

create function private.grant_practice_current(p_application uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portal_applications a left join public.grant_practice_sessions s on s.id=a.practice_session_id
 where a.id=p_application and (a.practice_session_id is null or (s.ended_at is null and s.round=a.practice_round)));
$$;
create function private.grant_practice_visible(p_application uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.portal_applications a left join public.grant_practice_sessions s on s.id=a.practice_session_id
 where a.id=p_application and (a.practice_session_id is null or
 private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]) or
 (auth.uid()=any(s.participants) and private.current_user_has_program_role(a.program_id,array['reviewer','admin']::public.program_access_role[]) and s.ended_at is null and s.round=a.practice_round)));
$$;
grant execute on function private.grant_practice_visible(uuid) to authenticated;
-- Restrictive policies supplement existing owner/program policies rather than replacing them.
create policy practice_application_scope on public.portal_applications as restrictive for select to authenticated using(private.grant_practice_visible(id));
create policy practice_detail_scope on public.business_grant_application_details as restrictive for select to authenticated using(private.grant_practice_visible(application_id));
create policy practice_document_scope on public.application_documents as restrictive for select to authenticated using(private.grant_practice_visible(application_id));
create policy practice_assignment_scope on public.reviewer_assignments as restrictive for select to authenticated using(private.grant_practice_visible(application_id));
create policy practice_review_scope on public.program_reviews as restrictive for select to authenticated using(private.grant_practice_visible(application_id));

create function public.declare_grant_no_conflict(p_assignment uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.reviewer_assignments%rowtype;
begin
 select * into a from public.reviewer_assignments where id=p_assignment and reviewer_id=auth.uid() and lifecycle='active';
 if not found or not exists(select 1 from public.programs where id=a.program_id and slug='business_growth_grant')
 or not private.current_user_has_program_role(a.program_id,array['reviewer','admin']::public.program_access_role[]) then
 raise exception 'Your active Grant assignment is required' using errcode='42501'; end if;
 perform 1 from public.portal_applications where id=a.application_id for update;
 select * into a from public.reviewer_assignments where id=p_assignment and reviewer_id=auth.uid() and lifecycle='active' for share;
 if not found then raise exception 'Assignment changed; reload'; end if;
 if not private.grant_practice_current(a.application_id) then raise exception 'Practice round has ended'; end if;
 if exists(select 1 from public.grant_conflict_reports r where r.assignment_id=a.id and r.resolved_at is null)
 or exists(select 1 from public.grant_conflict_reports r join public.grant_conflict_resolutions z on z.report_id=r.id where r.assignment_id=a.id and z.decision='replaced') then
 raise exception 'Conflict must be resolved by an administrator'; end if;
 insert into public.grant_conflict_declarations(assignment_id,reviewer_id) values(a.id,auth.uid()) on conflict do nothing;
end $$;
create function private.assert_grant_clearance(p_application uuid,p_reviewer uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.portal_applications a join public.programs p on p.id=a.program_id where a.id=p_application and p.slug='business_growth_grant') then return; end if;
 perform 1 from public.portal_applications where id=p_application for update;
 if not private.grant_practice_current(p_application) then perform private.phase_d_error('practice_ended','Practice round has ended'); end if;
 if not exists(select 1 from public.reviewer_assignments a join public.grant_conflict_declarations d on d.assignment_id=a.id and d.reviewer_id=a.reviewer_id
 where a.application_id=p_application and a.reviewer_id=p_reviewer and a.lifecycle='active') then
 perform private.phase_d_error('conflict_declaration_required','Record no known conflict before competitive scoring'); end if;
end $$;

create function public.resolve_grant_conflict(p_report uuid,p_decision text,p_reason text,p_replacement uuid default null)
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
 if p_replacement is null or p_replacement=r.reviewer_id or
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

-- Retain reviews and scores, but exclude approved recusals from stored totals.
create function private.refresh_grant_totals(p_application uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.portal_applications a set
 completed_review_count=(select count(*) from public.program_reviews r where r.application_id=a.id and r.status='completed' and not exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=r.assignment_id and z.decision='replaced')),
 average_score=coalesce((select avg(r.total_score) from public.program_reviews r where r.application_id=a.id and r.status='completed' and not exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=r.assignment_id and z.decision='replaced')),0),
 review_status=case
 when exists(select 1 from public.reviewer_assignments x join public.program_reviews r on r.assignment_id=x.id where x.application_id=a.id and x.lifecycle='active' and r.status='completed') and not exists(select 1 from public.reviewer_assignments x left join public.program_reviews r on r.assignment_id=x.id where x.application_id=a.id and x.lifecycle='active' and coalesce(r.status::text,'not_started')<>'completed') then 'completed'::public.portal_review_status
 when exists(select 1 from public.program_reviews r where r.application_id=a.id and r.status<>'not_started') then 'in_progress'::public.portal_review_status
 else 'not_started'::public.portal_review_status end, updated_at=now() where a.id=p_application;
end $$;
create or replace function private.recompute_portal_application() returns trigger
language plpgsql security definer set search_path='' as $$
begin perform private.refresh_grant_totals(coalesce(new.application_id,old.application_id)); return null; end $$;

create function private.seed_grant_practice(p_session uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.grant_practice_sessions%rowtype; aid uuid; i integer;
begin
 select * into s from public.grant_practice_sessions where id=p_session;
 for i in 1..40 loop
 insert into public.portal_applications(program_id,external_submission_id,applicant_name,applicant_email,submitted_at,practice_session_id,practice_round)
 values(s.program_id,'practice:'||s.id||':'||s.round||':'||i,'PRACTICE Applicant '||i,'practice-'||i||'@example.invalid',now(),s.id,s.round) returning id into aid;
 insert into public.business_grant_application_details(application_id,business_name,business_description,business_need,proposed_use_of_funds,community_impact,amount_requested,descendant_eligibility,eligibility_answers,lara_status)
 values(aid,'PRACTICE Business '||i,'Fictional neighborhood service business. All facts and documents are examples for training.','Replace aging equipment to serve more customers.','Purchase equipment and train staff.','Example goal: serve 20 additional local customers monthly.',5000,'Fictional self-identification supplied for human screening','{"practice": "Fictional business eligibility answers; check the training evidence"}','Fictional good-standing response; review the sample record');
 insert into public.application_documents(application_id,label,document_type,external_url)
 select aid,'PRACTICE '||kind,kind,'/practice-document?kind='||kind from unnest(array['lara_documentation','profit_loss_2024','profit_loss_2025']) kind;
 end loop;
end $$;
create function public.start_grant_practice(p_program uuid,p_name text,p_participants uuid[]) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform private.assert_grant_committee_admin(p_program);
 lock table public.user_program_access in share row exclusive mode;
 perform private.assert_grant_committee_admin(p_program);
 if length(btrim(coalesce(p_name,''))) not between 1 and 80 or p_participants is null or cardinality(p_participants) not between 2 and 20
 or (select count(distinct x) from unnest(p_participants) x)<>cardinality(p_participants)
 or exists(select 1 from unnest(p_participants) x where not exists(select 1 from public.user_program_access where user_id=x and program_id=p_program and access_role in ('reviewer','admin'))) then
 raise exception 'Enter a name and select 2-20 distinct existing Grant reviewer/admin accounts'; end if;
 insert into public.grant_practice_sessions(program_id,name,participants,created_by) values(p_program,btrim(p_name),p_participants,auth.uid()) returning id into result;
 perform private.seed_grant_practice(result);
 insert into public.grant_practice_events(session_id,actor_id,action,round) values(result,auth.uid(),'started',1);
 return result;
end $$;
create function public.reset_grant_practice(p_session uuid,p_round integer,p_end boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare s public.grant_practice_sessions%rowtype;
begin
 select * into s from public.grant_practice_sessions where id=p_session;
 if not found then raise exception 'Practice session unavailable'; end if;
 perform private.assert_grant_committee_admin(s.program_id);
 select * into s from public.grant_practice_sessions where id=p_session for update;
 perform 1 from public.portal_applications where practice_session_id=s.id and practice_round=s.round order by id for update;
 if s.ended_at is not null or s.round is distinct from p_round then raise exception 'Practice session changed; reload before resetting'; end if;
 update public.reviewer_assignments x set lifecycle='suspended',suspended_at=now()
 from public.portal_applications a where x.application_id=a.id and a.practice_session_id=s.id and a.practice_round=s.round;
 update public.grant_allocation_previews set superseded_at=now() where practice_session_id=s.id and applied_at is null;
 insert into public.grant_practice_events(session_id,actor_id,action,round) values(s.id,auth.uid(),case when p_end then 'ended' else 'reset' end,s.round);
 update public.grant_practice_sessions set round=round+case when p_end then 0 else 1 end,ended_at=case when p_end then now() else null end where id=s.id;
 if not p_end then perform private.seed_grant_practice(s.id); end if;
end $$;
-- Block relabeling real records as practice and prevent old-round competitive writes.
create function private.guard_practice_identity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (old.practice_session_id is distinct from new.practice_session_id or old.practice_round is distinct from new.practice_round) then raise exception 'Practice identity cannot be changed'; end if;
 if new.practice_session_id is not null and not exists(select 1 from public.grant_practice_sessions s where s.id=new.practice_session_id and s.program_id=new.program_id and s.round=new.practice_round and s.ended_at is null) then raise exception 'Invalid practice session identity'; end if;
 return new;
end $$;
create trigger practice_identity before insert or update of practice_session_id,practice_round on public.portal_applications for each row execute function private.guard_practice_identity();
create or replace view public.program_rankings with (security_invoker=true) as
select dense_rank() over(partition by a.program_id order by a.average_score desc,a.submitted_at asc nulls last,a.id) as rank,
 a.id as application_id,a.program_id,coalesce(b.business_name,a.applicant_name) as display_name,a.applicant_name,a.completed_review_count,a.average_score,a.review_status
from public.portal_applications a left join public.business_grant_application_details b on b.application_id=a.id
where a.practice_session_id is null and private.current_user_has_program_role(a.program_id,array['admin']::public.program_access_role[]);

-- Additional function definitions generated from current committee functions follow.

create function private.grant_committee_snapshot(p_program uuid,p_session uuid)
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
 where a.program_id=p_program and a.practice_session_id is not distinct from p_session
 and (p_session is null or private.grant_practice_current(a.id));
$$;
create or replace function private.grant_committee_snapshot(p_program uuid) returns jsonb language sql security definer set search_path='' as $$ select private.grant_committee_snapshot(p_program,null); $$;

create function private.preview_grant_scope(p_program uuid,p_roster uuid[],p_mode text,p_capacity integer,p_session uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare snap jsonb; result jsonb:='[]'; pool uuid[]; n integer; i integer; pair integer; preview_id uuid;
begin
 perform private.assert_grant_committee_admin(p_program);
 -- Short locks cover direct administrative assignment/screening writers too.
 lock table public.portal_applications,public.user_program_access,public.application_eligibility_reviews,
 public.reviewer_assignments,public.program_reviews,public.admin_review_reset_events,
 public.review_idempotency_keys,public.grant_allocation_previews in share row exclusive mode;
 perform private.assert_grant_committee_admin(p_program);
 perform private.validate_grant_pair_roster(p_program,p_roster);
 if p_mode is null or p_mode not in ('balanced','fixed') or
 (p_mode='fixed' and (p_capacity is null or p_capacity<1)) or (p_mode='balanced' and p_capacity is not null) then
 raise exception 'Choose balanced coverage or an explicit positive fixed capacity'; end if;
 if p_session is not null then
 perform 1 from public.grant_practice_sessions where id=p_session and program_id=p_program and ended_at is null for share;
 if not found then raise exception 'Practice session unavailable'; end if;
 if exists(select 1 from unnest(p_roster) r where not exists(select 1 from public.grant_practice_sessions s where s.id=p_session and r=any(s.participants))) then raise exception 'Every selected practice reviewer must be a participant'; end if;
 end if;
 snap:=private.grant_committee_snapshot(p_program,p_session);
 select array_agg((x->>'id')::uuid order by random()) into pool from jsonb_array_elements(snap) x where x->>'exclusion' is null;
 n:=coalesce(cardinality(pool),0);
 for i in 1..n loop
 pair:=(i-1)%3;
 result:=result||jsonb_build_array(jsonb_build_object('applicationId',pool[i],
 'pair',case when p_mode='fixed' and i>p_capacity::bigint*3 then null else pair+1 end,
 'reviewers',case when p_mode='fixed' and i>p_capacity::bigint*3 then '[]'::jsonb else to_jsonb(p_roster[pair*2+1:pair*2+2]) end));
 end loop;
 update public.grant_allocation_previews set superseded_at=now() where program_id=p_program and practice_session_id is not distinct from p_session and applied_at is null and superseded_at is null;
 insert into public.grant_allocation_previews(program_id,actor_id,roster,capacity_mode,capacity,snapshot,allocation,practice_session_id)
 values(p_program,auth.uid(),p_roster,p_mode,p_capacity,snap,result,p_session) returning id into preview_id;
 return preview_id;
end $$;
create function public.preview_grant_practice_allocation(p_session uuid,p_groups uuid[],p_mode text,p_capacity integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare s public.grant_practice_sessions%rowtype; snap jsonb; roster uuid[]; result uuid;
begin
 select * into s from public.grant_practice_sessions where id=p_session;
 if not found or s.ended_at is not null then raise exception 'Practice session unavailable'; end if;
 perform private.assert_grant_committee_admin(s.program_id);
 lock table public.grant_reviewer_groups,public.grant_reviewer_group_members in share row exclusive mode;
 snap:=private.grant_group_snapshot(s.program_id,p_groups);
 select array_agg(m.value::uuid order by g.ordinality,m.ordinality) into roster
 from jsonb_array_elements(snap) with ordinality g(value,ordinality)
 cross join lateral jsonb_array_elements_text(g.value->'members') with ordinality m(value,ordinality);
 result:=private.preview_grant_scope(s.program_id,roster,p_mode,p_capacity,s.id);
 update public.grant_allocation_previews set group_snapshot=snap where id=result;
 return result;
end $$;

create or replace function public.apply_grant_pair_allocation(p_preview uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview public.grant_allocation_previews%rowtype; item jsonb; reviewer uuid; assigned integer:=0; group_ids uuid[];
begin
 select * into preview from public.grant_allocation_previews where id=p_preview;
 if not found then raise exception 'Preview unavailable'; end if;
 perform private.assert_grant_committee_admin(preview.program_id);
 lock table public.grant_reviewer_groups,public.grant_reviewer_group_members in share row exclusive mode;
 lock table public.portal_applications,public.user_program_access,public.application_eligibility_reviews,
 public.reviewer_assignments,public.program_reviews,public.admin_review_reset_events,
 public.review_idempotency_keys,public.grant_allocation_previews in share row exclusive mode;
 select * into preview from public.grant_allocation_previews where id=p_preview for update;
 perform private.assert_grant_committee_admin(preview.program_id);
 if preview.practice_session_id is not null then
 perform 1 from public.grant_practice_sessions where id=preview.practice_session_id and ended_at is null for share;
 if not found then raise exception 'Practice session has ended'; end if;
 end if;
 if preview.applied_at is not null then return jsonb_build_object('id',preview.id,'replayed',true,'allocation',preview.allocation); end if;
 if preview.superseded_at is not null then raise exception 'Stale preview: explicitly create a new preview'; end if;
 perform private.validate_grant_pair_roster(preview.program_id,preview.roster);
 if preview.snapshot is distinct from private.grant_committee_snapshot(preview.program_id,preview.practice_session_id) then
 raise exception 'Stale preview: pool, eligibility or activity changed. Refresh and explicitly reshuffle'; end if;
 if preview.group_snapshot is not null then
 select array_agg((g.value->>'id')::uuid order by g.ordinality) into group_ids from jsonb_array_elements(preview.group_snapshot) with ordinality g(value,ordinality);
 begin
 if preview.group_snapshot is distinct from private.grant_group_snapshot(preview.program_id,group_ids) then
 raise exception 'Stale preview: group configuration changed. Explicitly create a new preview'; end if;
 exception when others then raise exception 'Stale preview: group configuration changed. Explicitly create a new preview'; end;
 end if;
 for item in select value from jsonb_array_elements(preview.allocation) loop
 if item->>'pair' is null then continue; end if;
 for reviewer in select value::uuid from jsonb_array_elements_text(item->'reviewers') loop
 insert into public.reviewer_assignments(application_id,program_id,reviewer_id,assigned_by)
 values((item->>'applicationId')::uuid,preview.program_id,reviewer,auth.uid());
 assigned:=assigned+1;
 end loop;
 end loop;
 update public.grant_allocation_previews set applied_at=now(),applied_by=auth.uid() where id=p_preview;
 return jsonb_build_object('id',p_preview,'replayed',false,'assignments',assigned,'allocation',preview.allocation);
end $$;

create or replace function private.claim_review_idempotency(
  _actor uuid, _program uuid, _application uuid, _intent text, _key text, _payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text; prior public.review_idempotency_keys%rowtype;
begin
  perform private.assert_no_grant_conflict(_application,_actor);
  perform private.assert_grant_clearance(_application,_actor);
  if exists (select 1 from public.programs where id = _program and slug = 'business_growth_grant')
    and not private.grant_scoring_allowed(_application) then
    perform private.phase_d_error('eligibility_locked','Competitive scoring is locked until eligibility is confirmed');
  end if;
  if _key is null or length(_key) < 8 then perform private.phase_d_error('validation','An idempotency key is required'); end if;
  h := encode(extensions.digest(convert_to(_payload::text, 'UTF8'), 'sha256'), 'hex');
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

create or replace function private.enforce_grant_conflict_hold()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.program_reviews%rowtype;
begin
 if tg_table_name='program_reviews' then
 if tg_op<>'INSERT' then perform private.assert_no_grant_conflict(old.application_id,old.reviewer_id); end if;
 if tg_op<>'DELETE' then perform private.assert_no_grant_conflict(new.application_id,new.reviewer_id); perform private.assert_grant_clearance(new.application_id,new.reviewer_id); end if;
 else
 if tg_op<>'INSERT' then
 select * into r from public.program_reviews where id=case when tg_table_name='review_scores' then (to_jsonb(old)->>'review_id')::uuid else (to_jsonb(old)->>'program_review_id')::uuid end;
 perform private.assert_no_grant_conflict(r.application_id,r.reviewer_id);
 if tg_op<>'DELETE' then perform private.assert_grant_clearance(r.application_id,r.reviewer_id); end if;
 end if;
 if tg_op<>'DELETE' then
 select * into r from public.program_reviews where id=case when tg_table_name='review_scores' then (to_jsonb(new)->>'review_id')::uuid else (to_jsonb(new)->>'program_review_id')::uuid end;
 perform private.assert_no_grant_conflict(r.application_id,r.reviewer_id);
 if tg_op<>'DELETE' then perform private.assert_grant_clearance(r.application_id,r.reviewer_id); end if;
 end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;

create or replace function private.assert_no_grant_conflict(p_application uuid,p_reviewer uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize report and every competitive write on the same application.
 perform 1 from public.portal_applications a join public.programs p on p.id=a.program_id
 where a.id=p_application and p.slug='business_growth_grant' for update of a;
 if not found then return; end if;
 if exists(select 1 from public.grant_conflict_reports where application_id=p_application and reviewer_id=p_reviewer and (resolved_at is null or exists(select 1 from public.grant_conflict_resolutions z where z.report_id=grant_conflict_reports.id and z.decision='replaced'))) then
 perform private.phase_d_error('conflict_hold','Competitive review is on hold due to a reported or confirmed conflict'); end if;
end $$;

create or replace function public.report_grant_conflict(p_assignment uuid,p_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.reviewer_assignments%rowtype; report_id uuid;
begin
 if auth.uid() is null or length(btrim(coalesce(p_reason,''))) not between 10 and 4000 then
 raise exception 'A conflict reason of 10 to 4000 characters is required'; end if;
 select * into a from public.reviewer_assignments where id=p_assignment and reviewer_id=auth.uid() and lifecycle='active';
 if not found or not exists(select 1 from public.programs where id=a.program_id and slug='business_growth_grant')
 or not private.current_user_has_program_role(a.program_id,array['reviewer','admin']::public.program_access_role[]) then
 raise exception 'Your active Grant assignment is required' using errcode='42501'; end if;
 perform 1 from public.portal_applications where id=a.application_id for update;
  if not private.grant_practice_current(a.application_id) then raise exception 'Practice round has ended'; end if;
 select * into a from public.reviewer_assignments where id=p_assignment and reviewer_id=auth.uid() and lifecycle='active' for share;
 if not found then raise exception 'Assignment changed; reload'; end if;
 insert into public.grant_conflict_reports(assignment_id,application_id,program_id,reviewer_id,reason)
 values(a.id,a.application_id,a.program_id,auth.uid(),btrim(p_reason)) on conflict(assignment_id) where resolved_at is null do nothing;
 select id into report_id from public.grant_conflict_reports where assignment_id=a.id and resolved_at is null;
 return report_id;
end $$;
revoke all on function private.grant_practice_current(uuid),private.assert_grant_clearance(uuid,uuid),private.refresh_grant_totals(uuid),private.seed_grant_practice(uuid),private.guard_practice_identity(),private.grant_committee_snapshot(uuid,uuid),private.preview_grant_scope(uuid,uuid[],text,integer,uuid) from public,anon,authenticated;
revoke all on function private.grant_practice_visible(uuid) from public,anon;
revoke all on function public.declare_grant_no_conflict(uuid),public.resolve_grant_conflict(uuid,text,text,uuid),public.start_grant_practice(uuid,text,uuid[]),public.reset_grant_practice(uuid,integer,boolean),public.preview_grant_practice_allocation(uuid,uuid[],text,integer) from public,anon;
grant execute on function public.declare_grant_no_conflict(uuid),public.resolve_grant_conflict(uuid,text,text,uuid),public.start_grant_practice(uuid,text,uuid[]),public.reset_grant_practice(uuid,integer,boolean),public.preview_grant_practice_allocation(uuid,uuid[],text,integer) to authenticated;

create or replace function public.preview_grant_pair_allocation(p_program uuid,p_roster uuid[],p_mode text,p_capacity integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin return private.preview_grant_scope(p_program,p_roster,p_mode,p_capacity,null); end $$;
create function private.guard_replaced_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.lifecycle='active' and exists(select 1 from public.grant_conflict_reports c join public.grant_conflict_resolutions z on z.report_id=c.id where c.assignment_id=new.id and z.decision='replaced') then raise exception 'A replaced conflict assignment cannot be reactivated'; end if;
 if new.lifecycle='active' and exists(select 1 from public.portal_applications a join public.grant_practice_sessions s on s.id=a.practice_session_id where a.id=new.application_id and not new.reviewer_id=any(s.participants)) then raise exception 'Practice assignments require a session participant'; end if;
 if new.lifecycle='active' and not private.grant_practice_current(new.application_id) then raise exception 'Practice round has ended'; end if;
 return new;
end $$;
create trigger guard_replaced_assignment before insert or update on public.reviewer_assignments for each row execute function private.guard_replaced_assignment();
revoke all on function private.guard_replaced_assignment() from public,anon,authenticated;


create or replace function private.current_user_can_access_application(_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portal_applications pa
    where pa.id = _application_id and private.grant_practice_visible(pa.id) and (
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
create function private.guard_practice_screening() returns trigger language plpgsql security definer set search_path='' as $$
declare aid uuid;
begin
 if tg_table_name='application_eligibility_reviews' then aid:=new.application_id;
 else select application_id into aid from public.application_eligibility_reviews where id=new.eligibility_review_id; end if;
 perform 1 from public.portal_applications where id=aid for update;
 if not private.grant_practice_current(aid) then raise exception 'Practice round has ended'; end if;
 return new;
end $$;
create trigger practice_screening_review_guard before insert or update on public.application_eligibility_reviews for each row execute function private.guard_practice_screening();
create trigger practice_screening_item_guard before insert or update on public.eligibility_review_items for each row execute function private.guard_practice_screening();
create trigger practice_screening_override_guard before insert or update on public.eligibility_scoring_overrides for each row execute function private.guard_practice_screening();
revoke all on function private.guard_practice_screening() from public,anon,authenticated;

commit;
