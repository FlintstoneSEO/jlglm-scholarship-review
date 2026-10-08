begin;
-- See docs/growth-grant-committee-increment.md; no existing row rewrite.
create table public.grant_allocation_previews (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.programs(id) on delete restrict,
 actor_id uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 roster uuid[] not null check(cardinality(roster)=6),
 capacity_mode text not null check(capacity_mode in ('balanced','fixed')),
 capacity integer check(capacity>0),
 snapshot jsonb not null, allocation jsonb not null,
 superseded_at timestamptz, applied_at timestamptz,
 applied_by uuid references auth.users(id) on delete restrict,
 check((capacity_mode='balanced' and capacity is null) or (capacity_mode='fixed' and capacity is not null))
);
create index grant_previews_program_time on public.grant_allocation_previews(program_id,created_at desc);
create table public.grant_conflict_reports (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null unique, application_id uuid not null,
 program_id uuid not null, reviewer_id uuid not null,
 reason text not null check(length(btrim(reason)) between 10 and 4000),
 reported_at timestamptz not null default now(),
 -- Reserved for separately approved policy; no resolution RPC/client grants.
 resolved_at timestamptz,
 foreign key(assignment_id,application_id,program_id,reviewer_id)
 references public.reviewer_assignments(id,application_id,program_id,reviewer_id) on delete restrict
);
create index grant_conflicts_hold on public.grant_conflict_reports(application_id,reviewer_id) where resolved_at is null;
create index grant_conflicts_program_time on public.grant_conflict_reports(program_id,reported_at desc) where resolved_at is null;
alter table public.grant_allocation_previews enable row level security;
alter table public.grant_conflict_reports enable row level security;
revoke all on public.grant_allocation_previews,public.grant_conflict_reports from public,anon,authenticated;
grant select on public.grant_allocation_previews,public.grant_conflict_reports to authenticated;
create policy grant_preview_admin_read on public.grant_allocation_previews for select to authenticated
 using((select private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[])));
create policy grant_conflict_own_admin_read on public.grant_conflict_reports for select to authenticated
 using(reviewer_id=(select auth.uid()) or (select private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[])));

create function private.assert_grant_committee_admin(p_program uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.current_user_has_program_role(p_program,array['admin']::public.program_access_role[])
 or not exists(select 1 from public.programs where id=p_program and slug='business_growth_grant') then
 raise exception 'Grant program administrator access is required' using errcode='42501'; end if;
end $$;
create function private.grant_committee_snapshot(p_program uuid)
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
 where a.program_id=p_program;
$$;
create function private.validate_grant_pair_roster(p_program uuid,p_roster uuid[])
returns void language plpgsql security definer set search_path='' as $$
begin
 if cardinality(p_roster) is distinct from 6 or (select count(distinct r) from unnest(p_roster) r)<>6
 or exists(select 1 from unnest(p_roster) r where not exists(
 select 1 from public.user_program_access u where u.user_id=r and u.program_id=p_program and u.access_role in ('reviewer','admin'))) then
 raise exception 'Select six distinct confirmed accounts with Grant reviewer/admin memberships'; end if;
end $$;
create function public.preview_grant_pair_allocation(p_program uuid,p_roster uuid[],p_mode text,p_capacity integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare snap jsonb; result jsonb:='[]'; pool uuid[]; n integer; i integer; pair integer; preview_id uuid;
begin
 perform private.assert_grant_committee_admin(p_program);
 -- Short locks cover direct administrative assignment/screening writers too.
 lock table public.portal_applications,public.user_program_access,public.application_eligibility_reviews,
 public.reviewer_assignments,public.program_reviews,public.admin_review_reset_events,
 public.review_idempotency_keys,public.grant_allocation_previews in share row exclusive mode;
 perform private.validate_grant_pair_roster(p_program,p_roster);
 if p_mode is null or p_mode not in ('balanced','fixed') or
 (p_mode='fixed' and (p_capacity is null or p_capacity<1)) or (p_mode='balanced' and p_capacity is not null) then
 raise exception 'Choose balanced coverage or an explicit positive fixed capacity'; end if;
 snap:=private.grant_committee_snapshot(p_program);
 select array_agg((x->>'id')::uuid order by random()) into pool from jsonb_array_elements(snap) x where x->>'exclusion' is null;
 n:=coalesce(cardinality(pool),0);
 for i in 1..n loop
 pair:=(i-1)%3;
 result:=result||jsonb_build_array(jsonb_build_object('applicationId',pool[i],
 'pair',case when p_mode='fixed' and i>p_capacity::bigint*3 then null else pair+1 end,
 'reviewers',case when p_mode='fixed' and i>p_capacity::bigint*3 then '[]'::jsonb else to_jsonb(p_roster[pair*2+1:pair*2+2]) end));
 end loop;
 update public.grant_allocation_previews set superseded_at=now() where program_id=p_program and applied_at is null and superseded_at is null;
 insert into public.grant_allocation_previews(program_id,actor_id,roster,capacity_mode,capacity,snapshot,allocation)
 values(p_program,auth.uid(),p_roster,p_mode,p_capacity,snap,result) returning id into preview_id;
 return preview_id;
end $$;
create function public.apply_grant_pair_allocation(p_preview uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview public.grant_allocation_previews%rowtype; item jsonb; reviewer uuid; assigned integer:=0;
begin
 select * into preview from public.grant_allocation_previews where id=p_preview;
 if not found then raise exception 'Preview unavailable'; end if;
 perform private.assert_grant_committee_admin(preview.program_id);
 lock table public.portal_applications,public.user_program_access,public.application_eligibility_reviews,
 public.reviewer_assignments,public.program_reviews,public.admin_review_reset_events,
 public.review_idempotency_keys,public.grant_allocation_previews in share row exclusive mode;
 select * into preview from public.grant_allocation_previews where id=p_preview for update;
 if preview.applied_at is not null then return jsonb_build_object('id',preview.id,'replayed',true,'allocation',preview.allocation); end if;
 if preview.superseded_at is not null then raise exception 'Stale preview: explicitly create a new preview'; end if;
 perform private.validate_grant_pair_roster(preview.program_id,preview.roster);
 if preview.snapshot is distinct from private.grant_committee_snapshot(preview.program_id) then
 raise exception 'Stale preview: pool, eligibility or activity changed. Refresh and explicitly reshuffle'; end if;
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
create function private.assert_no_grant_conflict(p_application uuid,p_reviewer uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
 -- Serialize report and every competitive write on the same application.
 perform 1 from public.portal_applications a join public.programs p on p.id=a.program_id
 where a.id=p_application and p.slug='business_growth_grant' for update of a;
 if not found then return; end if;
 if exists(select 1 from public.grant_conflict_reports where application_id=p_application and reviewer_id=p_reviewer and resolved_at is null) then
 perform private.phase_d_error('conflict_hold','Competitive review is on hold pending committee conflict policy'); end if;
end $$;
create function public.report_grant_conflict(p_assignment uuid,p_reason text)
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
 select * into a from public.reviewer_assignments where id=p_assignment and reviewer_id=auth.uid() and lifecycle='active' for share;
 if not found then raise exception 'Assignment changed; reload'; end if;
 insert into public.grant_conflict_reports(assignment_id,application_id,program_id,reviewer_id,reason)
 values(a.id,a.application_id,a.program_id,auth.uid(),btrim(p_reason)) on conflict(assignment_id) do nothing;
 select id into report_id from public.grant_conflict_reports where assignment_id=a.id;
 return report_id;
end $$;
create function private.enforce_grant_conflict_hold()
returns trigger language plpgsql security definer set search_path='' as $$
declare r public.program_reviews%rowtype;
begin
 if tg_table_name='program_reviews' then
 if tg_op<>'INSERT' then perform private.assert_no_grant_conflict(old.application_id,old.reviewer_id); end if;
 if tg_op<>'DELETE' then perform private.assert_no_grant_conflict(new.application_id,new.reviewer_id); end if;
 else
 if tg_op<>'INSERT' then
 select * into r from public.program_reviews where id=case when tg_table_name='review_scores' then (to_jsonb(old)->>'review_id')::uuid else (to_jsonb(old)->>'program_review_id')::uuid end;
 perform private.assert_no_grant_conflict(r.application_id,r.reviewer_id);
 end if;
 if tg_op<>'DELETE' then
 select * into r from public.program_reviews where id=case when tg_table_name='review_scores' then (to_jsonb(new)->>'review_id')::uuid else (to_jsonb(new)->>'program_review_id')::uuid end;
 perform private.assert_no_grant_conflict(r.application_id,r.reviewer_id);
 end if;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger grant_conflict_review_guard before insert or update or delete on public.program_reviews for each row execute function private.enforce_grant_conflict_hold();
create trigger grant_conflict_score_guard before insert or update or delete on public.review_scores for each row execute function private.enforce_grant_conflict_hold();
create trigger grant_conflict_certification_guard before insert or update or delete on public.grant_review_certifications for each row execute function private.enforce_grant_conflict_hold();
revoke all on function private.assert_grant_committee_admin(uuid),private.grant_committee_snapshot(uuid),private.validate_grant_pair_roster(uuid,uuid[]),private.assert_no_grant_conflict(uuid,uuid),private.enforce_grant_conflict_hold() from public,anon,authenticated;
revoke all on function public.preview_grant_pair_allocation(uuid,uuid[],text,integer),public.apply_grant_pair_allocation(uuid),public.report_grant_conflict(uuid,text) from public,anon;
grant execute on function public.preview_grant_pair_allocation(uuid,uuid[],text,integer),public.apply_grant_pair_allocation(uuid),public.report_grant_conflict(uuid,text) to authenticated;
create or replace function private.claim_review_idempotency(
  _actor uuid, _program uuid, _application uuid, _intent text, _key text, _payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text; prior public.review_idempotency_keys%rowtype;
begin
  perform private.assert_no_grant_conflict(_application,_actor);
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
commit;
