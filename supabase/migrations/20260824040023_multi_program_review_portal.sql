begin;

create schema if not exists private;
revoke all on schema private from public, anon;

do $$ begin
  create type public.program_access_role as enum ('admin', 'reviewer', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_application_status as enum ('submitted', 'complete', 'incomplete', 'withdrawn');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.portal_review_status as enum ('not_started', 'in_progress', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.import_row_status as enum ('imported', 'updated', 'failed');
exception when duplicate_object then null; end $$;

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z][a-z0-9_]*$'),
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.programs (id, slug, name, description)
values
  ('11111111-1111-4111-8111-111111111111', 'scholarship', 'Educational Scholarships', 'Review scholarship applications'),
  ('22222222-2222-4222-8222-222222222222', 'business_growth_grant', 'Business Growth Grants', 'Review Business Growth Grant applications')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

create table public.user_program_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  access_role public.program_access_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, program_id)
);

create table public.portal_applications (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  external_submission_id text,
  submitted_at timestamptz,
  applicant_name text not null,
  applicant_email text,
  status public.portal_application_status not null default 'submitted',
  review_status public.portal_review_status not null default 'not_started',
  completed_review_count integer not null default 0 check (completed_review_count >= 0),
  average_score numeric(8,2) not null default 0 check (average_score >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (program_id, external_submission_id)
);

alter table public.applicants add column if not exists application_id uuid references public.portal_applications(id) on delete restrict;
create unique index if not exists applicants_application_id_key on public.applicants(application_id) where application_id is not null;

insert into public.portal_applications (
  program_id, external_submission_id, submitted_at, applicant_name, applicant_email, status, review_status, created_at, updated_at
)
select
  p.id,
  'legacy-scholarship:' || a.id::text,
  a.submission_date,
  trim(concat_ws(' ', a.first_name, a.last_name)),
  a.email,
  case
    when a.application_status::text = 'complete' then 'complete'::public.portal_application_status
    when a.application_status::text = 'incomplete' then 'incomplete'::public.portal_application_status
    when a.application_status::text = 'withdrawn' then 'withdrawn'::public.portal_application_status
    else 'submitted'::public.portal_application_status
  end,
  case
    when a.review_status::text = 'reviewed' then 'completed'::public.portal_review_status
    when a.review_status::text = 'not_started' then 'not_started'::public.portal_review_status
    else 'in_progress'::public.portal_review_status
  end,
  a.created_at,
  a.updated_at
from public.applicants a
cross join public.programs p
where p.slug = 'scholarship'
on conflict (program_id, external_submission_id) do nothing;

update public.applicants a
set application_id = pa.id
from public.portal_applications pa
join public.programs p on p.id = pa.program_id and p.slug = 'scholarship'
where pa.external_submission_id = 'legacy-scholarship:' || a.id::text
  and a.application_id is null;

create table public.business_grant_application_details (
  application_id uuid primary key references public.portal_applications(id) on delete cascade,
  contact_name text,
  contact_phone text,
  business_name text not null,
  legal_business_name text,
  business_structure text,
  year_established integer check (year_established between 1800 and 2200),
  business_address text,
  website text,
  business_description text,
  products_services text,
  owner_background text,
  employee_count integer check (employee_count >= 0),
  annual_revenue_range text,
  amount_requested numeric(12,2) check (amount_requested >= 0),
  business_need text,
  proposed_use_of_funds text,
  use_of_funds_breakdown text,
  community_impact text,
  jobs_impact text,
  eligibility_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(eligibility_answers) = 'object'),
  additional_information text,
  raw_response jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_response) = 'object'),
  updated_at timestamptz not null default now()
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.portal_applications(id) on delete cascade,
  label text not null,
  file_name text,
  storage_path text,
  external_url text,
  content_type text,
  created_at timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table public.reviewer_assignments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.portal_applications(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  unique (application_id, reviewer_id)
);

alter table public.portal_applications add constraint portal_applications_id_program_key unique (id, program_id);
alter table public.reviewer_assignments add constraint reviewer_assignments_application_program_fkey
  foreign key (application_id, program_id) references public.portal_applications(id, program_id) on delete cascade;

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  name text not null,
  description text,
  maximum_points numeric(7,2) not null check (maximum_points > 0),
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, name)
);

insert into public.rubric_criteria (program_id, name, description, maximum_points, display_order)
select id, 'Writing', 'Addresses the prompt with clear grammar and structure.', 9, 10 from public.programs where slug = 'scholarship'
on conflict (program_id, name) do nothing;
insert into public.rubric_criteria (program_id, name, description, maximum_points, display_order)
select id, 'Rhetoric', 'Uses relevant experience, examples, reasoning, and argument.', 9, 20 from public.programs where slug = 'scholarship'
on conflict (program_id, name) do nothing;

create table public.program_reviews (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references public.reviewer_assignments(id) on delete restrict,
  application_id uuid not null references public.portal_applications(id) on delete cascade,
  program_id uuid not null references public.programs(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  status public.portal_review_status not null default 'not_started',
  reviewer_comments text,
  total_score numeric(8,2) not null default 0 check (total_score >= 0),
  started_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (application_id, reviewer_id)
);

alter table public.reviewer_assignments add constraint reviewer_assignments_identity_key unique (id, application_id, program_id, reviewer_id);
alter table public.program_reviews add constraint program_reviews_assignment_identity_fkey
  foreign key (assignment_id, application_id, program_id, reviewer_id)
  references public.reviewer_assignments(id, application_id, program_id, reviewer_id) on delete restrict;

create table public.review_scores (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.program_reviews(id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria(id) on delete restrict,
  points numeric(7,2) not null check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (review_id, criterion_id)
);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete restrict,
  source text not null check (source in ('csv', 'google_sheets', 'manual')),
  source_file_name text,
  imported_by uuid not null references auth.users(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  imported_count integer not null default 0,
  updated_count integer not null default 0,
  failed_count integer not null default 0
);

create table public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  external_submission_id text,
  application_id uuid references public.portal_applications(id) on delete set null,
  row_number integer not null check (row_number > 0),
  status public.import_row_status not null,
  error_message text,
  created_at timestamptz not null default now(),
  unique (batch_id, row_number)
);

-- Preserve current access during rollout.
insert into public.user_program_access (user_id, program_id, access_role)
select ur.user_id, p.id,
  case ur.role::text when 'admin' then 'admin'::public.program_access_role when 'reviewer' then 'reviewer'::public.program_access_role else 'viewer'::public.program_access_role end
from public.user_roles ur
join public.programs p on p.slug = 'scholarship'
on conflict (user_id, program_id) do nothing;

insert into public.user_program_access (user_id, program_id, access_role)
select ur.user_id, p.id, 'admin'::public.program_access_role
from public.user_roles ur
join public.programs p on p.slug = 'business_growth_grant'
where ur.role = 'admin'
on conflict (user_id, program_id) do nothing;

insert into public.reviewer_assignments (application_id, program_id, reviewer_id)
select a.application_id, pa.program_id, upa.user_id
from public.applicants a
join public.portal_applications pa on pa.id = a.application_id
join public.user_program_access upa on upa.program_id = pa.program_id and upa.access_role = 'reviewer'
where a.preliminary_screening_status = 'eligible_for_review'
on conflict (application_id, reviewer_id) do nothing;

create or replace function private.current_user_is_global_admin()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.user_roles ur
  where ur.user_id = (select auth.uid()) and ur.role = 'admin'
) $$;

create or replace function private.current_user_has_program_role(_program_id uuid, _roles public.program_access_role[])
returns boolean language sql stable security definer set search_path = ''
as $$ select (select private.current_user_is_global_admin()) or exists (
  select 1 from public.user_program_access upa
  where upa.user_id = (select auth.uid()) and upa.program_id = _program_id and upa.access_role = any(_roles)
) $$;

create or replace function private.current_user_can_access_application(_application_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1
  from public.portal_applications pa
  where pa.id = _application_id and (
    (select private.current_user_has_program_role(pa.program_id, array['admin','viewer']::public.program_access_role[]))
    or (
      (select private.current_user_has_program_role(pa.program_id, array['reviewer']::public.program_access_role[]))
      and exists (
        select 1 from public.reviewer_assignments ra
        where ra.application_id = pa.id and ra.reviewer_id = (select auth.uid())
      )
    )
  )
) $$;

create or replace function private.current_user_can_access_scholarship_applicant(_applicant_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.applicants a
  where a.id = _applicant_id and (select private.current_user_can_access_application(a.application_id))
) $$;

create or replace function private.current_user_shares_program(_other_user_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$ select (select private.current_user_is_global_admin()) or _other_user_id = (select auth.uid()) or exists (
  select 1 from public.user_program_access mine
  join public.user_program_access theirs on theirs.program_id = mine.program_id
  where mine.user_id = (select auth.uid()) and theirs.user_id = _other_user_id
) $$;

revoke all on all functions in schema private from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.current_user_is_global_admin() to authenticated;
grant execute on function private.current_user_has_program_role(uuid, public.program_access_role[]) to authenticated;
grant execute on function private.current_user_can_access_application(uuid) to authenticated;
grant execute on function private.current_user_can_access_scholarship_applicant(uuid) to authenticated;
grant execute on function private.current_user_shares_program(uuid) to authenticated;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$ select _user_id = (select auth.uid()) and exists (
  select 1 from public.user_roles where user_id = _user_id and role = _role
) $$;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

create or replace function public.get_user_role(_user_id uuid)
returns public.app_role language sql stable security definer set search_path = ''
as $$ select role from public.user_roles
  where _user_id = (select auth.uid()) and user_id = _user_id
  order by case role when 'admin' then 1 when 'reviewer' then 2 when 'viewer' then 3 end limit 1 $$;
revoke all on function public.get_user_role(uuid) from public, anon;
grant execute on function public.get_user_role(uuid) to authenticated;

create or replace function private.validate_review_score()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare criterion public.rubric_criteria%rowtype; review public.program_reviews%rowtype;
begin
  select * into criterion from public.rubric_criteria where id = new.criterion_id;
  select * into review from public.program_reviews where id = new.review_id;
  if criterion.id is null or review.id is null or criterion.program_id <> review.program_id then
    raise exception 'Rubric criterion must belong to the review program';
  end if;
  if new.points > criterion.maximum_points then
    raise exception 'Score % exceeds maximum % for %', new.points, criterion.maximum_points, criterion.name;
  end if;
  return new;
end $$;

create or replace function private.validate_business_grant_detail()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (
    select 1 from public.portal_applications pa join public.programs p on p.id = pa.program_id
    where pa.id = new.application_id and p.slug = 'business_growth_grant'
  ) then raise exception 'Business grant details require a Business Growth Grant application';
  end if;
  return new;
end $$;

create or replace function private.recompute_program_review()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_review_id uuid;
begin
  target_review_id := coalesce(new.review_id, old.review_id);
  update public.program_reviews pr set
    total_score = coalesce((select sum(rs.points) from public.review_scores rs where rs.review_id = target_review_id), 0),
    updated_at = now()
  where pr.id = target_review_id;
  return null;
end $$;

create or replace function public.recompute_applicant_score()
returns trigger language plpgsql security definer set search_path = '' as $$
declare app_id uuid; completed_count integer;
begin
  app_id := coalesce(new.applicant_id, old.applicant_id);
  select count(*) into completed_count from public.reviews where applicant_id = app_id and is_complete = true;
  update public.applicants set
    total_score = coalesce((select sum(coalesce(writing_score, 0) + coalesce(rhetoric_score, 0)) from public.reviews where applicant_id = app_id and is_complete = true), 0),
    review_status = case when completed_count >= 5 then 'reviewed'::public.review_status when exists (select 1 from public.reviews where applicant_id = app_id) then 'in_progress'::public.review_status else 'not_started'::public.review_status end
  where id = app_id;
  return null;
end $$;

create or replace function private.recompute_portal_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_application_id uuid;
begin
  target_application_id := coalesce(new.application_id, old.application_id);
  update public.portal_applications pa set
    completed_review_count = (select count(*) from public.program_reviews pr where pr.application_id = target_application_id and pr.status = 'completed'),
    average_score = coalesce((select avg(pr.total_score) from public.program_reviews pr where pr.application_id = target_application_id and pr.status = 'completed'), 0),
    review_status = case
      when exists (select 1 from public.program_reviews pr where pr.application_id = target_application_id and pr.status = 'completed')
        and not exists (select 1 from public.reviewer_assignments ra left join public.program_reviews pr on pr.assignment_id = ra.id where ra.application_id = target_application_id and coalesce(pr.status, 'not_started') <> 'completed') then 'completed'::public.portal_review_status
      when exists (select 1 from public.program_reviews pr where pr.application_id = target_application_id and pr.status <> 'not_started') then 'in_progress'::public.portal_review_status
      else 'not_started'::public.portal_review_status
    end,
    updated_at = now()
  where pa.id = target_application_id;
  return null;
end $$;

create or replace function private.sync_scholarship_application()
returns trigger language plpgsql security definer set search_path = '' as $$
declare scholarship_program_id uuid;
begin
  select id into scholarship_program_id from public.programs where slug = 'scholarship';
  if new.application_id is null then
    insert into public.portal_applications (program_id, external_submission_id, submitted_at, applicant_name, applicant_email, status, review_status)
    values (
      scholarship_program_id,
      'legacy-scholarship:' || new.id::text,
      new.submission_date,
      trim(concat_ws(' ', new.first_name, new.last_name)),
      new.email,
      case when new.application_status::text = 'complete' then 'complete'::public.portal_application_status when new.application_status::text = 'incomplete' then 'incomplete'::public.portal_application_status when new.application_status::text = 'withdrawn' then 'withdrawn'::public.portal_application_status else 'submitted'::public.portal_application_status end,
      case when new.review_status::text = 'reviewed' then 'completed'::public.portal_review_status when new.review_status::text = 'not_started' then 'not_started'::public.portal_review_status else 'in_progress'::public.portal_review_status end
    ) returning id into new.application_id;
  else
    update public.portal_applications set
      submitted_at = new.submission_date,
      applicant_name = trim(concat_ws(' ', new.first_name, new.last_name)),
      applicant_email = new.email,
      status = case when new.application_status::text = 'complete' then 'complete'::public.portal_application_status when new.application_status::text = 'incomplete' then 'incomplete'::public.portal_application_status when new.application_status::text = 'withdrawn' then 'withdrawn'::public.portal_application_status else 'submitted'::public.portal_application_status end,
      review_status = case when new.review_status::text = 'reviewed' then 'completed'::public.portal_review_status when new.review_status::text = 'not_started' then 'not_started'::public.portal_review_status else 'in_progress'::public.portal_review_status end,
      updated_at = now()
    where id = new.application_id;
  end if;
  return new;
end $$;

create or replace function private.assign_scholarship_reviewers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.preliminary_screening_status = 'eligible_for_review' and new.application_id is not null then
    insert into public.reviewer_assignments (application_id, program_id, reviewer_id)
    select new.application_id, pa.program_id, upa.user_id
    from public.portal_applications pa
    join public.user_program_access upa on upa.program_id = pa.program_id and upa.access_role = 'reviewer'
    where pa.id = new.application_id
    on conflict (application_id, reviewer_id) do nothing;
  end if;
  return null;
end $$;

create or replace function private.assign_existing_scholarships_to_reviewer()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.access_role = 'reviewer' and exists (select 1 from public.programs p where p.id = new.program_id and p.slug = 'scholarship') then
    insert into public.reviewer_assignments (application_id, program_id, reviewer_id)
    select a.application_id, new.program_id, new.user_id
    from public.applicants a
    where a.preliminary_screening_status = 'eligible_for_review' and a.application_id is not null
    on conflict (application_id, reviewer_id) do nothing;
  end if;
  return null;
end $$;

create trigger review_scores_validate before insert or update on public.review_scores
for each row execute function private.validate_review_score();
create trigger business_grant_details_validate before insert or update on public.business_grant_application_details
for each row execute function private.validate_business_grant_detail();
create trigger review_scores_recompute after insert or update or delete on public.review_scores
for each row execute function private.recompute_program_review();
create trigger program_reviews_recompute_application after insert or update or delete on public.program_reviews
for each row execute function private.recompute_portal_application();
create trigger applicants_sync_portal before insert or update on public.applicants
for each row execute function private.sync_scholarship_application();
create trigger applicants_assign_reviewers after insert or update of preliminary_screening_status on public.applicants
for each row execute function private.assign_scholarship_reviewers();
create trigger program_access_assign_scholarships after insert or update of access_role on public.user_program_access
for each row execute function private.assign_existing_scholarships_to_reviewer();

create trigger programs_touch before update on public.programs for each row execute function public.touch_updated_at();
create trigger portal_applications_touch before update on public.portal_applications for each row execute function public.touch_updated_at();
create trigger business_grant_details_touch before update on public.business_grant_application_details for each row execute function public.touch_updated_at();
create trigger rubric_criteria_touch before update on public.rubric_criteria for each row execute function public.touch_updated_at();
create trigger review_scores_touch before update on public.review_scores for each row execute function public.touch_updated_at();

create index user_program_access_user_idx on public.user_program_access(user_id);
create index user_program_access_program_idx on public.user_program_access(program_id);
create index portal_applications_program_idx on public.portal_applications(program_id, submitted_at desc);
create index reviewer_assignments_reviewer_idx on public.reviewer_assignments(reviewer_id);
create index reviewer_assignments_program_idx on public.reviewer_assignments(program_id);
create index rubric_criteria_program_idx on public.rubric_criteria(program_id, active, display_order);
create index program_reviews_application_idx on public.program_reviews(application_id);
create index program_reviews_reviewer_idx on public.program_reviews(reviewer_id);
create index review_scores_review_idx on public.review_scores(review_id);
create index application_documents_application_idx on public.application_documents(application_id);

alter table public.programs enable row level security;
alter table public.user_program_access enable row level security;
alter table public.portal_applications enable row level security;
alter table public.business_grant_application_details enable row level security;
alter table public.application_documents enable row level security;
alter table public.reviewer_assignments enable row level security;
alter table public.rubric_criteria enable row level security;
alter table public.program_reviews enable row level security;
alter table public.review_scores enable row level security;
alter table public.import_batches enable row level security;
alter table public.import_rows enable row level security;

revoke all on table public.programs, public.user_program_access, public.portal_applications,
  public.business_grant_application_details, public.application_documents, public.reviewer_assignments,
  public.rubric_criteria, public.program_reviews, public.review_scores, public.import_batches, public.import_rows
from anon, authenticated;
grant select on table public.programs to authenticated;
grant select, insert, update, delete on table public.user_program_access, public.portal_applications,
  public.business_grant_application_details, public.application_documents, public.reviewer_assignments,
  public.rubric_criteria, public.program_reviews, public.review_scores, public.import_batches, public.import_rows
to authenticated;

create policy programs_select on public.programs for select to authenticated using (
  active and (select private.current_user_has_program_role(id, array['admin','reviewer','viewer']::public.program_access_role[]))
);
create policy program_access_select on public.user_program_access for select to authenticated using (
  user_id = (select auth.uid()) or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy program_access_insert on public.user_program_access for insert to authenticated with check (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy program_access_update on public.user_program_access for update to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
) with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));
create policy program_access_delete on public.user_program_access for delete to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);

create policy portal_applications_select on public.portal_applications for select to authenticated using (
  (select private.current_user_can_access_application(id))
);
create policy portal_applications_insert on public.portal_applications for insert to authenticated with check (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy portal_applications_update on public.portal_applications for update to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
) with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));
create policy portal_applications_delete on public.portal_applications for delete to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);

create policy business_details_select on public.business_grant_application_details for select to authenticated using (
  (select private.current_user_can_access_application(application_id))
);
create policy business_details_insert on public.business_grant_application_details for insert to authenticated with check (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);
create policy business_details_update on public.business_grant_application_details for update to authenticated using (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
) with check (exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[]))));
create policy business_details_delete on public.business_grant_application_details for delete to authenticated using (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);

create policy application_documents_select on public.application_documents for select to authenticated using ((select private.current_user_can_access_application(application_id)));
create policy application_documents_insert on public.application_documents for insert to authenticated with check (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);
create policy application_documents_update on public.application_documents for update to authenticated using (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
) with check (exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[]))));
create policy application_documents_delete on public.application_documents for delete to authenticated using (
  exists (select 1 from public.portal_applications pa where pa.id = application_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);

create policy assignments_select on public.reviewer_assignments for select to authenticated using (
  reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy assignments_insert on public.reviewer_assignments for insert to authenticated with check (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
  and exists (select 1 from public.portal_applications pa where pa.id = application_id and pa.program_id = reviewer_assignments.program_id)
  and exists (select 1 from public.user_program_access upa where upa.user_id = reviewer_id and upa.program_id = reviewer_assignments.program_id and upa.access_role in ('reviewer','admin'))
);
create policy assignments_update on public.reviewer_assignments for update to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
) with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));
create policy assignments_delete on public.reviewer_assignments for delete to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);

create policy rubric_select on public.rubric_criteria for select to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin','reviewer','viewer']::public.program_access_role[]))
);
create policy rubric_insert on public.rubric_criteria for insert to authenticated with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));
create policy rubric_update on public.rubric_criteria for update to authenticated using ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))) with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));
create policy rubric_delete on public.rubric_criteria for delete to authenticated using ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));

create policy program_reviews_select on public.program_reviews for select to authenticated using (
  reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy program_reviews_insert on public.program_reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid())
  and exists (select 1 from public.reviewer_assignments ra where ra.id = assignment_id and ra.application_id = program_reviews.application_id and ra.program_id = program_reviews.program_id and ra.reviewer_id = (select auth.uid()))
);
create policy program_reviews_update on public.program_reviews for update to authenticated using (
  reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
) with check (
  reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
);
create policy program_reviews_delete on public.program_reviews for delete to authenticated using ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])));

create policy review_scores_select on public.review_scores for select to authenticated using (
  exists (select 1 from public.program_reviews pr where pr.id = review_id and (pr.reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(pr.program_id, array['admin']::public.program_access_role[]))))
);
create policy review_scores_insert on public.review_scores for insert to authenticated with check (
  exists (select 1 from public.program_reviews pr where pr.id = review_id and pr.reviewer_id = (select auth.uid()))
);
create policy review_scores_update on public.review_scores for update to authenticated using (
  exists (select 1 from public.program_reviews pr where pr.id = review_id and pr.reviewer_id = (select auth.uid()))
) with check (exists (select 1 from public.program_reviews pr where pr.id = review_id and pr.reviewer_id = (select auth.uid())));
create policy review_scores_delete on public.review_scores for delete to authenticated using (
  exists (select 1 from public.program_reviews pr where pr.id = review_id and (pr.reviewer_id = (select auth.uid()) or (select private.current_user_has_program_role(pr.program_id, array['admin']::public.program_access_role[]))))
);

create policy import_batches_admin on public.import_batches for all to authenticated using (
  (select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]))
) with check ((select private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[])) and imported_by = (select auth.uid()));
create policy import_rows_admin on public.import_rows for all to authenticated using (
  exists (select 1 from public.import_batches b where b.id = batch_id and (select private.current_user_has_program_role(b.program_id, array['admin']::public.program_access_role[])))
) with check (exists (select 1 from public.import_batches b where b.id = batch_id and (select private.current_user_has_program_role(b.program_id, array['admin']::public.program_access_role[]))));

-- Replace legacy broad access with program/assignment-aware policies.
do $$ declare pol record; begin
  for pol in select policyname, tablename from pg_policies where schemaname = 'public' and tablename in ('applicants','reviews','applicant_notes','contact_logs','reviewer_discussion_documents')
  loop execute format('drop policy if exists %I on public.%I', pol.policyname, pol.tablename); end loop;
end $$;

create policy applicants_select on public.applicants for select to authenticated using ((select private.current_user_can_access_application(application_id)));
create policy applicants_insert on public.applicants for insert to authenticated with check ((select private.current_user_is_global_admin()));
create policy applicants_update on public.applicants for update to authenticated using ((select private.current_user_is_global_admin())) with check ((select private.current_user_is_global_admin()));
create policy applicants_delete on public.applicants for delete to authenticated using ((select private.current_user_is_global_admin()));

create policy scholarship_reviews_select on public.reviews for select to authenticated using (
  reviewer_id = (select auth.uid()) or exists (
    select 1 from public.applicants a join public.portal_applications pa on pa.id = a.application_id
    where a.id = reviews.applicant_id and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[]))
  )
);
create policy scholarship_reviews_insert on public.reviews for insert to authenticated with check (
  reviewer_id = (select auth.uid()) and exists (
    select 1 from public.applicants a join public.reviewer_assignments ra on ra.application_id = a.application_id
    where a.id = reviews.applicant_id and ra.reviewer_id = (select auth.uid())
  )
);
create policy scholarship_reviews_update on public.reviews for update to authenticated using (
  reviewer_id = (select auth.uid()) or (select private.current_user_is_global_admin())
) with check (reviewer_id = (select auth.uid()) or (select private.current_user_is_global_admin()));
create policy scholarship_reviews_delete on public.reviews for delete to authenticated using ((select private.current_user_is_global_admin()));

create policy applicant_notes_select on public.applicant_notes for select to authenticated using ((select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy applicant_notes_insert on public.applicant_notes for insert to authenticated with check (created_by = (select auth.uid()) and (select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy applicant_notes_update on public.applicant_notes for update to authenticated using (created_by = (select auth.uid()) or (select private.current_user_is_global_admin())) with check (created_by = (select auth.uid()) or (select private.current_user_is_global_admin()));
create policy applicant_notes_delete on public.applicant_notes for delete to authenticated using (created_by = (select auth.uid()) or (select private.current_user_is_global_admin()));

create policy contact_logs_select on public.contact_logs for select to authenticated using ((select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy contact_logs_insert on public.contact_logs for insert to authenticated with check (contacted_by = (select auth.uid()) and (select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy contact_logs_update on public.contact_logs for update to authenticated using ((select private.current_user_is_global_admin())) with check ((select private.current_user_is_global_admin()));
create policy contact_logs_delete on public.contact_logs for delete to authenticated using ((select private.current_user_is_global_admin()));

create policy discussion_documents_select on public.reviewer_discussion_documents for select to authenticated using ((select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy discussion_documents_insert on public.reviewer_discussion_documents for insert to authenticated with check (reviewer_id = (select auth.uid()) and (select private.current_user_can_access_scholarship_applicant(applicant_id)));
create policy discussion_documents_delete on public.reviewer_discussion_documents for delete to authenticated using (reviewer_id = (select auth.uid()) or (select private.current_user_is_global_admin()));

drop policy if exists "Authenticated read profiles" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
create policy profiles_select_program_peers on public.profiles for select to authenticated using ((select private.current_user_shares_program(id)));
create policy profiles_update_own on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$ declare pol record; begin
  for pol in select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' and (qual like '%reviewer-discussion-documents%' or with_check like '%reviewer-discussion-documents%')
  loop execute format('drop policy if exists %I on storage.objects', pol.policyname); end loop;
end $$;

create policy discussion_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'reviewer-discussion-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and (select private.current_user_can_access_scholarship_applicant(split_part(name, '/', 1)::uuid))
);
create policy discussion_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'reviewer-discussion-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and split_part(name, '/', 2) = (select auth.uid())::text
  and (select private.current_user_can_access_scholarship_applicant(split_part(name, '/', 1)::uuid))
);
create policy discussion_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'reviewer-discussion-documents'
  and (split_part(name, '/', 2) = (select auth.uid())::text or (select private.current_user_is_global_admin()))
);

insert into storage.buckets (id, name, public) values ('business-grant-documents', 'business-grant-documents', false)
on conflict (id) do update set public = false;
create policy business_storage_select on storage.objects for select to authenticated using (
  bucket_id = 'business-grant-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and (select private.current_user_can_access_application(split_part(name, '/', 1)::uuid))
);
create policy business_storage_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'business-grant-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and exists (select 1 from public.portal_applications pa where pa.id = split_part(name, '/', 1)::uuid and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);
create policy business_storage_update on storage.objects for update to authenticated using (
  bucket_id = 'business-grant-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and exists (select 1 from public.portal_applications pa where pa.id = split_part(name, '/', 1)::uuid and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
) with check (
  bucket_id = 'business-grant-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and exists (select 1 from public.portal_applications pa where pa.id = split_part(name, '/', 1)::uuid and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);
create policy business_storage_delete on storage.objects for delete to authenticated using (
  bucket_id = 'business-grant-documents'
  and split_part(name, '/', 1) ~* '^[0-9a-f-]{36}$'
  and exists (select 1 from public.portal_applications pa where pa.id = split_part(name, '/', 1)::uuid and (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[])))
);

create or replace view public.program_rankings with (security_invoker = true) as
select
  dense_rank() over (partition by pa.program_id order by pa.average_score desc, pa.submitted_at asc nulls last, pa.id) as rank,
  pa.id as application_id,
  pa.program_id,
  coalesce(bg.business_name, pa.applicant_name) as display_name,
  pa.applicant_name,
  pa.completed_review_count,
  pa.average_score,
  pa.review_status
from public.portal_applications pa
left join public.business_grant_application_details bg on bg.application_id = pa.id
where (select private.current_user_has_program_role(pa.program_id, array['admin']::public.program_access_role[]));
revoke all on public.program_rankings from anon, authenticated;
grant select on public.program_rankings to authenticated;

commit;
