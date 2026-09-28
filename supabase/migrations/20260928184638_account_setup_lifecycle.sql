begin;

-- Grandfather rows present at cutover. New Auth-trigger and admin-created profiles
-- receive false from the default; the invitation upsert also writes false explicitly.
alter table public.profiles
  add column account_setup_completed boolean not null default true;
alter table public.profiles
  alter column account_setup_completed set default false;

-- A user must be able to read their own flag even before program access is assigned.
create policy profiles_select_own_setup on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

-- Invites have no password hash. A session alone cannot flip the setup flag.
-- This helper exposes only a boolean for the caller's own Auth row.
create function private.current_user_has_password()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and nullif(encrypted_password, '') is not null
  );
$$;
revoke all on function private.current_user_has_password() from public, anon;
grant execute on function private.current_user_has_password() to authenticated;

drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and (not account_setup_completed or (select private.current_user_has_password()))
  );

-- Keep the existing own-row UPDATE policy. Restrict the browser's UPDATE grant to
-- this one column so setup cannot be used to change identity/profile fields.
revoke update on public.profiles from authenticated;
grant update (account_setup_completed) on public.profiles to authenticated;

commit;
