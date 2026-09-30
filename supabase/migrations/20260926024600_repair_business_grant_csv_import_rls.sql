begin;

-- CSV imports run in the signed-in administrator's browser. Restore the
-- intended Data API boundary in case the deployed policy or grants drifted
-- from the multi-program migration.
alter table public.portal_applications enable row level security;

grant select, insert, update on table public.portal_applications to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.current_user_has_program_role(uuid, public.program_access_role[])
  to authenticated;
grant execute on function private.current_user_can_access_application(uuid)
  to authenticated;

drop policy if exists portal_applications_select on public.portal_applications;
drop policy if exists portal_applications_insert on public.portal_applications;
drop policy if exists portal_applications_update on public.portal_applications;

create policy portal_applications_select
on public.portal_applications
for select
to authenticated
using (
  (select private.current_user_has_program_role(
    program_id,
    array['admin']::public.program_access_role[]
  ))
  or (select private.current_user_can_access_application(id))
);

create policy portal_applications_insert
on public.portal_applications
for insert
to authenticated
with check (
  (select private.current_user_has_program_role(
    program_id,
    array['admin']::public.program_access_role[]
  ))
);

create policy portal_applications_update
on public.portal_applications
for update
to authenticated
using (
  (select private.current_user_has_program_role(
    program_id,
    array['admin']::public.program_access_role[]
  ))
)
with check (
  (select private.current_user_has_program_role(
    program_id,
    array['admin']::public.program_access_role[]
  ))
);

commit;
