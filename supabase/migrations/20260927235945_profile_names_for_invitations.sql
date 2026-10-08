begin;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text;

-- Only split unambiguous two-token names. Leave initials, suffixes, hyphenated
-- multi-part names, email-shaped values, and partially populated rows alone.
update public.profiles
set first_name = split_part(btrim(full_name), ' ', 1),
    last_name = split_part(btrim(full_name), ' ', 2)
where first_name is null and last_name is null
  and full_name is not null
  and btrim(full_name) ~ '^[[:alpha:]][[:alpha:]''-]* [[:alpha:]][[:alpha:]''-]*$'
  and btrim(full_name) !~ '[[:space:]]{2,}'
  and lower(split_part(btrim(full_name), ' ', 1)) not in ('dr', 'mr', 'mrs', 'ms', 'prof', 'rev')
  and lower(split_part(btrim(full_name), ' ', 2)) not in ('jr', 'sr', 'ii', 'iii', 'iv');

-- The Auth trigger remains responsible for the initial profile and viewer role.
-- Invitation metadata supplies explicit names; legacy signups retain full_name.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare user_count integer;
begin
  insert into public.profiles (id, email, full_name, first_name, last_name)
  values (
    new.id, new.email,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email),
    nullif(btrim(new.raw_user_meta_data->>'first_name'), ''),
    nullif(btrim(new.raw_user_meta_data->>'last_name'), '')
  );
  select count(*) into user_count from auth.users;
  if user_count = 1 then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles (user_id, role) values (new.id, 'viewer');
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

commit;
