-- Run after 20260928184638_account_setup_lifecycle.sql. All fixtures roll back.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values
  ('ff111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated', 'setup-a@example.invalid', '', now()),
  ('ff222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated', 'setup-b@example.invalid', '', now());

do $$
begin
  if (select account_setup_completed from public.profiles where id = 'ff111111-1111-4111-8111-111111111111') then
    raise exception 'New profiles must start incomplete';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'email', 'UPDATE') then
    raise exception 'Authenticated user can update unrelated profile fields';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'ff111111-1111-4111-8111-111111111111', true);

-- Before a password exists, even the owner cannot mark setup complete.
do $$
begin
  begin
    update public.profiles set account_setup_completed = true
    where id = 'ff111111-1111-4111-8111-111111111111';
    raise exception 'Setup was allowed before password creation';
  exception when insufficient_privilege then null;
  end;
end $$;

reset role;
update auth.users set encrypted_password = 'test-password-hash'
where id = 'ff111111-1111-4111-8111-111111111111';
set local role authenticated;

do $$
declare affected integer;
begin
  update public.profiles set account_setup_completed = true
  where id = 'ff111111-1111-4111-8111-111111111111';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Own setup update failed'; end if;

  update public.profiles set account_setup_completed = true
  where id = 'ff222222-2222-4222-8222-222222222222';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Other user setup update succeeded'; end if;
end $$;

reset role;
do $$
begin
  if not (select account_setup_completed from public.profiles where id = 'ff111111-1111-4111-8111-111111111111')
    or (select account_setup_completed from public.profiles where id = 'ff222222-2222-4222-8222-222222222222') then
    raise exception 'Setup state changed for the wrong user';
  end if;
end $$;

rollback;
