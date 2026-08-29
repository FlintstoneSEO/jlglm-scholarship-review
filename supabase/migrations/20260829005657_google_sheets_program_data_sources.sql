begin;

do $$ begin
  create type public.program_data_source_type as enum ('google_sheets');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.program_sync_status as enum ('pending', 'running', 'completed', 'partial', 'failed');
exception when duplicate_object then null; end $$;

create table public.program_data_sources (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  source_type public.program_data_source_type not null default 'google_sheets',
  spreadsheet_id text not null,
  spreadsheet_url text not null,
  worksheet_name text,
  worksheet_gid text,
  sync_enabled boolean not null default false,
  sync_interval_minutes integer not null default 15 check (sync_interval_minutes >= 15),
  service_account_email text,
  last_sync_at timestamptz,
  last_sync_status public.program_sync_status,
  last_sync_summary jsonb not null default '{}'::jsonb check (jsonb_typeof(last_sync_summary) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, source_type)
);

create table public.program_source_field_mappings (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.program_data_sources(id) on delete cascade,
  source_column text not null,
  target_field text not null,
  required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id, source_column),
  unique (data_source_id, target_field)
);

create table public.program_sync_runs (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.program_data_sources(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  trigger_type text not null check (trigger_type in ('manual', 'scheduled', 'connection_test')),
  status public.program_sync_status not null default 'pending',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  rows_read integer not null default 0 check (rows_read >= 0),
  records_created integer not null default 0 check (records_created >= 0),
  records_updated integer not null default 0 check (records_updated >= 0),
  records_skipped integer not null default 0 check (records_skipped >= 0),
  records_failed integer not null default 0 check (records_failed >= 0),
  error_details jsonb not null default '[]'::jsonb check (jsonb_typeof(error_details) = 'array'),
  created_at timestamptz not null default now()
);

alter table public.portal_applications
  add column if not exists data_source_id uuid references public.program_data_sources(id) on delete set null,
  add column if not exists source_record_key text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object');

create unique index if not exists portal_applications_data_source_record_key
  on public.portal_applications(data_source_id, source_record_key)
  where data_source_id is not null and source_record_key is not null;

create index if not exists program_sync_runs_data_source_started_at_idx
  on public.program_sync_runs(data_source_id, started_at desc);

create or replace function private.current_user_can_manage_data_source(_data_source_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.program_data_sources pds
    where pds.id = _data_source_id
      and (select private.current_user_has_program_role(pds.program_id, array['admin']::public.program_access_role[]))
  )
$$;

revoke all on function private.current_user_can_manage_data_source(uuid) from public, anon;
grant execute on function private.current_user_can_manage_data_source(uuid) to authenticated;

alter table public.program_data_sources enable row level security;
alter table public.program_source_field_mappings enable row level security;
alter table public.program_sync_runs enable row level security;

revoke all on public.program_data_sources, public.program_source_field_mappings, public.program_sync_runs from anon;
grant select, insert, update, delete on public.program_data_sources, public.program_source_field_mappings, public.program_sync_runs to authenticated;

create policy program_data_sources_admin on public.program_data_sources for all to authenticated
  using ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])))
  with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));

create policy program_source_field_mappings_admin on public.program_source_field_mappings for all to authenticated
  using ((select private.current_user_can_manage_data_source(data_source_id)))
  with check ((select private.current_user_can_manage_data_source(data_source_id)));

create policy program_sync_runs_admin on public.program_sync_runs for select to authenticated
  using ((select private.current_user_can_manage_data_source(data_source_id)));

-- Data-source metadata is written only by the service-account-backed sync function.
-- The existing portal_applications admin policy remains the browser-write boundary.

commit;
