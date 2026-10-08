begin;
create table public.grant_reviewer_groups (
 id uuid primary key default gen_random_uuid(),
 program_id uuid not null references public.programs(id) on delete restrict,
 name text not null check(length(btrim(name)) between 1 and 80),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default now(),
 updated_by uuid not null references auth.users(id) on delete restrict,
 updated_at timestamptz not null default now()
);
create unique index grant_group_name on public.grant_reviewer_groups(program_id,lower(btrim(name)));
create index grant_group_creator on public.grant_reviewer_groups(created_by);
create index grant_group_editor on public.grant_reviewer_groups(updated_by);
create table public.grant_reviewer_group_members (
 group_id uuid not null references public.grant_reviewer_groups(id) on delete restrict,
 user_id uuid not null references public.profiles(id) on delete restrict,
 primary key(group_id,user_id)
);
create index grant_group_member_user on public.grant_reviewer_group_members(user_id);
alter table public.grant_reviewer_groups enable row level security;
alter table public.grant_reviewer_group_members enable row level security;
revoke all on public.grant_reviewer_groups,public.grant_reviewer_group_members from public,anon,authenticated;
grant select on public.grant_reviewer_groups,public.grant_reviewer_group_members to authenticated;
create policy grant_groups_admin_read on public.grant_reviewer_groups for select to authenticated
 using((select private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[])));
create policy grant_group_members_admin_read on public.grant_reviewer_group_members for select to authenticated
 using(exists(select 1 from public.grant_reviewer_groups g where g.id=group_id));
alter table public.grant_allocation_previews add column group_snapshot jsonb;

create function public.save_grant_reviewer_group(p_program uuid,p_name text,p_members uuid[],p_group uuid default null,p_revision integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; current_revision integer;
begin
 perform private.assert_grant_committee_admin(p_program);
 -- Same lock order as group preview/apply; membership changes cannot race validation.
 lock table public.grant_reviewer_groups,public.grant_reviewer_group_members in share row exclusive mode;
 lock table public.user_program_access in share row exclusive mode;
 perform private.assert_grant_committee_admin(p_program);
 if p_name is null or length(btrim(p_name)) not between 1 and 80 then raise exception 'Enter a group name (1-80 characters)'; end if;
 if p_members is null or cardinality(p_members) not between 1 and 20
 or (select count(distinct m) from unnest(p_members) m)<>cardinality(p_members)
 or exists(select 1 from unnest(p_members) m where not exists(select 1 from public.profiles where id=m)
 or not exists(select 1 from public.user_program_access where user_id=m and program_id=p_program and access_role in ('reviewer','admin'))) then
 raise exception 'Select distinct existing app accounts with Grant reviewer/admin membership (1-20 members)'; end if;
 if p_group is null then
 insert into public.grant_reviewer_groups(program_id,name,created_by,updated_by)
 values(p_program,btrim(p_name),auth.uid(),auth.uid()) returning id into result;
 else
 select revision into current_revision from public.grant_reviewer_groups where id=p_group and program_id=p_program for update;
 if not found then raise exception 'Group unavailable in this program'; end if;
 if p_revision is distinct from current_revision then raise exception 'Stale group: reload before editing'; end if;
 update public.grant_reviewer_groups set name=btrim(p_name),revision=revision+1,updated_by=auth.uid(),updated_at=now() where id=p_group;
 delete from public.grant_reviewer_group_members where group_id=p_group;
 result:=p_group;
 end if;
 insert into public.grant_reviewer_group_members(group_id,user_id) select result,m from unnest(p_members) m;
 return result;
end $$;
create function private.grant_group_snapshot(p_program uuid,p_groups uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if cardinality(p_groups) is distinct from 3 or (select count(distinct g) from unnest(p_groups) g)<>3 then
 raise exception 'Select three distinct saved groups'; end if;
 select jsonb_agg(jsonb_build_object('id',g.id,'name',g.name,'revision',g.revision,'members',
 (select coalesce(jsonb_agg(m.user_id order by m.user_id),'[]'::jsonb) from public.grant_reviewer_group_members m where m.group_id=g.id)) order by chosen.ordinality)
 into result from unnest(p_groups) with ordinality chosen(id,ordinality) join public.grant_reviewer_groups g on g.id=chosen.id and g.program_id=p_program;
 if jsonb_array_length(result) is distinct from 3 or exists(select 1 from jsonb_array_elements(result) g where jsonb_array_length(g->'members')<>2) then
 raise exception 'Each saved pair must have exactly two members in this program'; end if;
 return result;
end $$;
create function public.preview_grant_group_allocation(p_program uuid,p_groups uuid[],p_mode text,p_capacity integer default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare snap jsonb; roster uuid[]; result uuid;
begin
 perform private.assert_grant_committee_admin(p_program);
 lock table public.grant_reviewer_groups,public.grant_reviewer_group_members in share row exclusive mode;
 snap:=private.grant_group_snapshot(p_program,p_groups);
 select array_agg(m.value::uuid order by g.ordinality,m.ordinality) into roster
 from jsonb_array_elements(snap) with ordinality g(value,ordinality)
 cross join lateral jsonb_array_elements_text(g.value->'members') with ordinality m(value,ordinality);
 result:=public.preview_grant_pair_allocation(p_program,roster,p_mode,p_capacity);
 update public.grant_allocation_previews set group_snapshot=snap where id=result;
 return result;
end $$;
revoke all on function private.grant_group_snapshot(uuid,uuid[]) from public,anon,authenticated;
revoke all on function public.save_grant_reviewer_group(uuid,text,uuid[],uuid,integer),public.preview_grant_group_allocation(uuid,uuid[],text,integer) from public,anon;
grant execute on function public.save_grant_reviewer_group(uuid,text,uuid[],uuid,integer),public.preview_grant_group_allocation(uuid,uuid[],text,integer) to authenticated;

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
 if preview.applied_at is not null then return jsonb_build_object('id',preview.id,'replayed',true,'allocation',preview.allocation); end if;
 if preview.superseded_at is not null then raise exception 'Stale preview: explicitly create a new preview'; end if;
 perform private.validate_grant_pair_roster(preview.program_id,preview.roster);
 if preview.snapshot is distinct from private.grant_committee_snapshot(preview.program_id) then
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

create or replace function public.preview_grant_pair_allocation(p_program uuid,p_roster uuid[],p_mode text,p_capacity integer default null)
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

commit;
