-- Run after migrations in an isolated database. Always rolls back.
begin;
do $$
begin
 if has_table_privilege('authenticated','public.grant_selection_decisions','INSERT') or has_table_privilege('authenticated','public.grant_selection_decisions','UPDATE') or has_table_privilege('authenticated','public.grant_selection_history','DELETE') then raise exception 'Direct selection writes must be denied'; end if;
 if has_function_privilege('anon','public.save_grant_selection(uuid,uuid[],uuid[],integer)','EXECUTE') then raise exception 'Anonymous execution must be denied'; end if;
 if not (select relrowsecurity from pg_class where oid='public.grant_selection_decisions'::regclass) then raise exception 'Selection RLS required'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
do $$
begin
 begin
 perform public.save_grant_selection(gen_random_uuid(),array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid()],array[]::uuid[],0);
 raise exception 'Missing identity accepted';
 exception when insufficient_privilege then null;
 end;
end $$;
rollback;
