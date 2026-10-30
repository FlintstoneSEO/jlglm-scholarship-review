create table public.grant_selection_decisions (
 program_id uuid primary key references public.programs(id),
 finalist_ids uuid[] not null default '{}', recipient_ids uuid[] not null default '{}',
 revision integer not null default 0, finalized_at timestamptz,
 updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now(),
 check(cardinality(finalist_ids)=3),
 check((finalized_at is null and cardinality(recipient_ids)=0) or (finalized_at is not null and cardinality(recipient_ids)=2 and recipient_ids <@ finalist_ids))
);
create table public.grant_selection_history (
 id bigint generated always as identity primary key,
 program_id uuid not null references public.programs(id),
 decision jsonb not null, actor_id uuid not null references auth.users(id), occurred_at timestamptz not null default now()
);
create index on public.grant_selection_history(program_id, occurred_at);
alter table public.grant_selection_decisions enable row level security;
alter table public.grant_selection_history enable row level security;
revoke all on public.grant_selection_decisions,public.grant_selection_history from public,anon,authenticated;
grant select on public.grant_selection_decisions,public.grant_selection_history to authenticated;
create policy admin_read on public.grant_selection_decisions for select to authenticated using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));
create policy admin_read on public.grant_selection_history for select to authenticated using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));
create function public.save_grant_selection(p_program uuid,p_finalists uuid[],p_recipients uuid[],p_revision integer)
returns void language plpgsql security definer set search_path='' as $$
declare current_decision public.grant_selection_decisions;
begin
 perform private.assert_grant_committee_admin(p_program);
 perform 1 from public.programs where id=p_program for update;
 select * into current_decision from public.grant_selection_decisions where program_id=p_program;
 if coalesce(current_decision.revision,0) is distinct from p_revision then raise exception 'Selections changed. Reload before saving.'; end if;
 if current_decision.finalized_at is not null then raise exception 'Recipients have already been finalized.'; end if;
 if p_finalists is null or cardinality(p_finalists)<>3 or (select count(distinct id) from unnest(p_finalists) id)<>3 then raise exception 'Choose three different finalists.'; end if;
 if p_recipients is null or cardinality(p_recipients) not in (0,2) or (select count(distinct id) from unnest(p_recipients) id)<>cardinality(p_recipients) or not p_recipients <@ p_finalists then raise exception 'Choose two different recipients from the finalists.'; end if;
 perform 1 from public.portal_applications where id=any(p_finalists) order by id for update;
 if (select count(*) from public.portal_applications where id=any(p_finalists) and program_id=p_program and not is_test and duplicate_of is null)<>3 then raise exception 'Finalists must be active real applications in this program.'; end if;
 insert into public.grant_selection_decisions(program_id,finalist_ids,recipient_ids,revision,finalized_at,updated_by)
 values(p_program,p_finalists,p_recipients,p_revision+1,case when cardinality(p_recipients)=2 then now() end,auth.uid())
 on conflict(program_id) do update set finalist_ids=excluded.finalist_ids,recipient_ids=excluded.recipient_ids,revision=excluded.revision,finalized_at=excluded.finalized_at,updated_by=excluded.updated_by,updated_at=now();
 insert into public.grant_selection_history(program_id,decision,actor_id) select p_program,to_jsonb(d),auth.uid() from public.grant_selection_decisions d where program_id=p_program;
end $$;
revoke all on function public.save_grant_selection(uuid,uuid[],uuid[],integer) from public,anon;
grant execute on function public.save_grant_selection(uuid,uuid[],uuid[],integer) to authenticated;
