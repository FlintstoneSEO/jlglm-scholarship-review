-- Behavioral rubric version test. Run with `supabase test db` against the
-- disposable local database after applying all migrations. Everything rolls
-- back; never run this fixture directly against a live project.
begin;

insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at)
values (
  'd0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'phase-d-rubric-test@example.invalid', '', now()
);
insert into public.user_roles (user_id, role)
values ('d0000000-0000-4000-8000-000000000001', 'admin')
on conflict (user_id, role) do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-4000-8000-000000000001', true);

do $$
declare
  grant_program uuid;
  original_version public.rubric_versions%rowtype;
  source_draft uuid;
  draft_version uuid;
  blank_version uuid;
  new_version_number integer;
  source_count integer;
  original_count integer;
  draft_count integer;
  active_count integer;
begin
  select id into grant_program from public.programs where slug = 'business_growth_grant';
  if grant_program is null then raise exception 'Grant program fixture is missing'; end if;
  select * into strict original_version from public.rubric_versions where program_id = grant_program and active;
  select count(*) into original_count from public.rubric_criteria where rubric_version_id = original_version.id;

  source_draft := public.create_rubric_version(grant_program, original_version.id);
  select version into new_version_number from public.rubric_versions where id = source_draft;
  if new_version_number <= original_version.version then raise exception 'Draft version number did not increment'; end if;
  insert into public.rubric_criteria(program_id, rubric_version_id, name, description, maximum_points, display_order)
  values (grant_program, source_draft, 'Phase D disposable test criterion', 'Temporary test row', 7.5, 9990);

  draft_version := public.create_rubric_version(grant_program, source_draft);
  if (select rv.version from public.rubric_versions rv where rv.id = draft_version) <= new_version_number then
    raise exception 'Cloned version number did not increment';
  end if;
  if (select active from public.rubric_versions where id = draft_version) then raise exception 'New draft became active'; end if;

  select count(*) into source_count from public.rubric_criteria where rubric_version_id = source_draft;
  select count(*) into draft_count from public.rubric_criteria where rubric_version_id = draft_version;
  if draft_count <> source_count then raise exception 'Clone criteria count differs from source'; end if;
  if exists (
    (select name, description, maximum_points, display_order, active
     from public.rubric_criteria where rubric_version_id = source_draft)
    except
    (select name, description, maximum_points, display_order, active
     from public.rubric_criteria where rubric_version_id = draft_version)
  ) then raise exception 'Clone changed criterion content or ordering'; end if;
  if exists (
    select 1 from public.rubric_criteria source
    join public.rubric_criteria clone on clone.rubric_version_id = draft_version and clone.id = source.id
    where source.rubric_version_id = source_draft
  ) then raise exception 'Clone reused source criterion IDs'; end if;

  perform public.activate_rubric_version(grant_program, draft_version);

  select count(*) into active_count from public.rubric_versions where program_id = grant_program and active;
  if active_count <> 1 then raise exception 'Activation did not preserve exactly one active version'; end if;
  if not (select active from public.rubric_versions where id = draft_version) then raise exception 'Target draft was not activated'; end if;
  if not (select retired_at is not null and not active from public.rubric_versions where id = original_version.id) then
    raise exception 'Previous active version was not retained as retired';
  end if;
  if (select count(*) from public.rubric_criteria where rubric_version_id = original_version.id) <> original_count then
    raise exception 'Original version criteria changed during activation';
  end if;

  begin
    update public.rubric_criteria set name = 'Changed active criterion'
    where rubric_version_id = draft_version and name = 'Phase D disposable test criterion';
    raise exception 'Active criterion edit unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Active criterion edit unexpectedly succeeded' then raise; end if;
  end;

  blank_version := public.create_rubric_version(grant_program, null);
  begin
    perform public.activate_rubric_version(grant_program, blank_version);
    raise exception 'Empty draft activation unexpectedly succeeded';
  exception when raise_exception then
    if sqlerrm = 'Empty draft activation unexpectedly succeeded' then raise; end if;
  end;
  if (select count(*) from public.rubric_versions where program_id = grant_program and active) <> 1 then
    raise exception 'Rejected empty activation changed the active version';
  end if;
end;
$$;

rollback;
