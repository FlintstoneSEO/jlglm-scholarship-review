begin;

-- INSERT ... RETURNING must be able to select the row it just created. The
-- general application-access helper looks the application up by id, but that
-- second query cannot see the new row during the same command. Authorize
-- program admins directly from the row's program_id before falling back to
-- the assignment-aware helper used by viewers and reviewers.
drop policy if exists portal_applications_select on public.portal_applications;

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

commit;
