begin;

create type public.grant_eligibility_status as enum ('not_reviewed', 'eligible', 'needs_clarification', 'ineligible');
create type public.grant_requirement_status as enum ('pending', 'verified', 'missing', 'failed', 'needs_clarification');

create table public.application_eligibility_reviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.portal_applications(id) on delete cascade,
  program_id uuid not null references public.programs(id),
  status public.grant_eligibility_status not null default 'not_reviewed',
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint eligibility_decision_identity check ((status = 'not_reviewed' and reviewed_by is null and reviewed_at is null) or (status <> 'not_reviewed' and reviewed_by is not null and reviewed_at is not null)),
  constraint eligibility_decision_reason check (status not in ('needs_clarification', 'ineligible') or length(btrim(coalesce(notes, ''))) >= 10)
);
create index eligibility_reviews_program_idx on public.application_eligibility_reviews(program_id);

create or replace function private.validate_grant_eligibility_review()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.portal_applications a join public.programs p on p.id = a.program_id
    where a.id = new.application_id and a.program_id = new.program_id and p.slug = 'business_growth_grant') then
    raise exception 'Eligibility review must belong to a Business Growth Grant application';
  end if;
  return new;
end $$;
create trigger eligibility_review_parent_check before insert or update of application_id, program_id
  on public.application_eligibility_reviews for each row execute function private.validate_grant_eligibility_review();

create table public.eligibility_review_items (
  id uuid primary key default gen_random_uuid(),
  eligibility_review_id uuid not null references public.application_eligibility_reviews(id) on delete cascade,
  requirement_key text not null check (requirement_key in ('owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025')),
  status public.grant_requirement_status not null default 'pending',
  notes text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (eligibility_review_id, requirement_key),
  constraint requirement_review_identity check ((status = 'pending' and reviewed_by is null and reviewed_at is null) or (status <> 'pending' and reviewed_by is not null and reviewed_at is not null))
);

create table public.eligibility_scoring_overrides (
  id uuid primary key default gen_random_uuid(),
  event_number bigint generated always as identity unique,
  eligibility_review_id uuid not null references public.application_eligibility_reviews(id) on delete cascade,
  original_status public.grant_eligibility_status not null,
  scoring_allowed boolean not null,
  admin_user_id uuid not null references auth.users(id),
  reason text not null check (length(btrim(reason)) >= 10),
  created_at timestamptz not null default now()
);
create index eligibility_overrides_latest_idx on public.eligibility_scoring_overrides(eligibility_review_id, event_number desc);

create or replace function private.assert_grant_eligibility_parent(p_application_id uuid, p_program_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.portal_applications a join public.programs p on p.id = a.program_id
    where a.id = p_application_id and a.program_id = p_program_id and p.slug = 'business_growth_grant') then
    raise exception 'Grant application is unavailable';
  end if;
end $$;

create or replace function public.set_grant_requirement(p_application_id uuid, p_requirement_key text, p_status public.grant_requirement_status, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_program_id uuid; v_review_id uuid; v_actor uuid := auth.uid();
begin
  select program_id into v_program_id from public.portal_applications where id = p_application_id;
  perform private.assert_grant_eligibility_parent(p_application_id, v_program_id);
  if v_actor is null or not private.current_user_has_program_role(v_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Program administrator access is required';
  end if;
  if p_requirement_key not in ('owner_eligibility','business_eligibility','lara_good_standing','required_documentation','profit_loss_2024','profit_loss_2025') or p_status is null then
    raise exception 'Invalid eligibility requirement';
  end if;
  insert into public.application_eligibility_reviews(application_id, program_id)
    values (p_application_id, v_program_id) on conflict (application_id) do nothing;
  select id into v_review_id from public.application_eligibility_reviews where application_id = p_application_id for update;
  insert into public.eligibility_review_items(eligibility_review_id, requirement_key, status, notes, reviewed_by, reviewed_at)
    values (v_review_id, p_requirement_key, p_status, nullif(btrim(p_notes), ''),
      case when p_status = 'pending' then null else v_actor end,
      case when p_status = 'pending' then null else now() end)
    on conflict (eligibility_review_id, requirement_key) do update set status = excluded.status, notes = excluded.notes,
      reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at, updated_at = now();
  -- Any changed verification requires a new final confirmation. Prior scores remain untouched.
  update public.application_eligibility_reviews set status = 'not_reviewed', notes = null,
    reviewed_by = null, reviewed_at = null, updated_at = now() where id = v_review_id;
  if (select scoring_allowed from public.eligibility_scoring_overrides where eligibility_review_id = v_review_id order by event_number desc limit 1) is true then
    insert into public.eligibility_scoring_overrides(eligibility_review_id, original_status, scoring_allowed, admin_user_id, reason)
      values (v_review_id, 'not_reviewed', false, v_actor, 'Verification changed; prior scoring exception requires reconsideration');
  end if;
end $$;

create or replace function public.confirm_grant_eligibility(p_application_id uuid, p_status public.grant_eligibility_status, p_notes text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_program_id uuid; v_review_id uuid; v_actor uuid := auth.uid();
begin
  select program_id into v_program_id from public.portal_applications where id = p_application_id;
  perform private.assert_grant_eligibility_parent(p_application_id, v_program_id);
  if v_actor is null or not private.current_user_has_program_role(v_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Program administrator access is required';
  end if;
  if p_status is null or p_status = 'not_reviewed' then raise exception 'Choose a final eligibility decision'; end if;
  if p_status in ('needs_clarification','ineligible') and length(btrim(coalesce(p_notes,''))) < 10 then
    raise exception 'A meaningful reason of at least 10 characters is required';
  end if;
  insert into public.application_eligibility_reviews(application_id, program_id)
    values (p_application_id, v_program_id) on conflict (application_id) do nothing;
  select id into v_review_id from public.application_eligibility_reviews where application_id = p_application_id for update;
  if p_status = 'eligible' and (select count(*) from public.eligibility_review_items
    where eligibility_review_id = v_review_id and status = 'verified') <> 6 then
    raise exception 'All six requirements must be verified before confirming Eligible';
  end if;
  update public.application_eligibility_reviews set status = p_status, notes = nullif(btrim(p_notes), ''),
    reviewed_by = v_actor, reviewed_at = now(), updated_at = now() where id = v_review_id;
  if (select scoring_allowed from public.eligibility_scoring_overrides where eligibility_review_id = v_review_id order by event_number desc limit 1) is true then
    insert into public.eligibility_scoring_overrides(eligibility_review_id, original_status, scoring_allowed, admin_user_id, reason)
      values (v_review_id, p_status, false, v_actor, 'Eligibility decision changed; prior scoring exception requires reconsideration');
  end if;
end $$;

create or replace function public.set_grant_scoring_override(p_application_id uuid, p_allowed boolean, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_program_id uuid; v_review public.application_eligibility_reviews%rowtype; v_actor uuid := auth.uid();
begin
  select program_id into v_program_id from public.portal_applications where id = p_application_id;
  perform private.assert_grant_eligibility_parent(p_application_id, v_program_id);
  if v_actor is null or not private.current_user_has_program_role(v_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Program administrator access is required';
  end if;
  if p_allowed is null or length(btrim(coalesce(p_reason,''))) < 10 then raise exception 'An override action and meaningful reason are required'; end if;
  insert into public.application_eligibility_reviews(application_id, program_id)
    values (p_application_id, v_program_id) on conflict (application_id) do nothing;
  select * into v_review from public.application_eligibility_reviews where application_id = p_application_id for update;
  if p_allowed and v_review.status = 'eligible' then raise exception 'Eligible applications do not need a scoring exception'; end if;
  insert into public.eligibility_scoring_overrides(eligibility_review_id, original_status, scoring_allowed, admin_user_id, reason)
    values (v_review.id, v_review.status, p_allowed, v_actor, btrim(p_reason));
end $$;

create or replace function private.grant_scoring_allowed(p_application_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_review public.application_eligibility_reviews%rowtype; v_override boolean;
begin
  select * into v_review from public.application_eligibility_reviews where application_id = p_application_id for share;
  if not found then return false; end if;
  select scoring_allowed into v_override from public.eligibility_scoring_overrides
    where eligibility_review_id = v_review.id order by event_number desc limit 1;
  return coalesce(v_override, false) or v_review.status = 'eligible';
end $$;

-- Check before idempotency replay, so a previously successful request cannot report
-- success after screening is revoked. Scholarship continues through its existing path.
create or replace function private.claim_review_idempotency(
  _actor uuid, _program uuid, _application uuid, _intent text, _key text, _payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text; prior public.review_idempotency_keys%rowtype;
begin
  if exists (select 1 from public.programs where id = _program and slug = 'business_growth_grant')
    and not private.grant_scoring_allowed(_application) then
    perform private.phase_d_error('eligibility_locked','Competitive scoring is locked until eligibility is confirmed');
  end if;
  if _key is null or length(_key) < 8 then perform private.phase_d_error('validation','An idempotency key is required'); end if;
  h := encode(extensions.digest(convert_to(_payload::text, 'UTF8'), 'sha256'), 'hex');
  select * into prior from public.review_idempotency_keys
    where actor_id=_actor and program_id=_program and idempotency_key=_key for update;
  if found then
    if prior.request_hash <> h then perform private.phase_d_error('conflict','Idempotency key was reused with a different payload'); end if;
    if prior.response is not null then return prior.response || jsonb_build_object('replayed', true); end if;
    perform private.phase_d_error('conflict','An identical request is already in progress');
  end if;
  begin
    insert into public.review_idempotency_keys(actor_id,program_id,application_id,intent,idempotency_key,request_hash)
      values (_actor,_program,_application,_intent,_key,h);
  exception when unique_violation then
    select * into prior from public.review_idempotency_keys
      where actor_id=_actor and program_id=_program and idempotency_key=_key;
    if prior.request_hash <> h then perform private.phase_d_error('conflict','Idempotency key was reused with a different payload'); end if;
    if prior.response is not null then return prior.response || jsonb_build_object('replayed',true); end if;
    perform private.phase_d_error('conflict','An identical request is already in progress');
  end;
  return null;
end $$;

create or replace function private.enforce_grant_scoring_gate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_application_id uuid; v_program_id uuid;
begin
  if tg_table_name = 'program_reviews' then
    if tg_op = 'DELETE' then
      v_application_id := old.application_id;
      v_program_id := old.program_id;
    else
      v_application_id := new.application_id;
      v_program_id := new.program_id;
    end if;
  else
    if tg_op = 'DELETE' then
      select application_id, program_id into v_application_id, v_program_id from public.program_reviews where id = old.review_id;
    else
      select application_id, program_id into v_application_id, v_program_id from public.program_reviews where id = new.review_id;
    end if;
  end if;
  if exists (select 1 from public.programs where id = v_program_id and slug = 'business_growth_grant')
    and not private.grant_scoring_allowed(v_application_id) then
    perform private.phase_d_error('eligibility_locked','Competitive scoring is locked until eligibility is confirmed');
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger grant_review_eligibility_gate before insert or update of status, reviewer_comments, total_score, submitted_at, rubric_version_id or delete on public.program_reviews
  for each row execute function private.enforce_grant_scoring_gate();
create trigger grant_score_eligibility_gate before insert or update or delete on public.review_scores
  for each row execute function private.enforce_grant_scoring_gate();

alter table public.application_eligibility_reviews enable row level security;
alter table public.eligibility_review_items enable row level security;
alter table public.eligibility_scoring_overrides enable row level security;
revoke all on public.application_eligibility_reviews, public.eligibility_review_items, public.eligibility_scoring_overrides from anon, authenticated;
grant select on public.application_eligibility_reviews, public.eligibility_review_items, public.eligibility_scoring_overrides to authenticated;
create policy eligibility_review_read on public.application_eligibility_reviews for select to authenticated
  using ((select private.current_user_can_access_application(application_id)));
create policy eligibility_item_read on public.eligibility_review_items for select to authenticated
  using (exists (select 1 from public.application_eligibility_reviews r where r.id = eligibility_review_id
    and (select private.current_user_can_access_application(r.application_id))));
create policy eligibility_override_read on public.eligibility_scoring_overrides for select to authenticated
  using (exists (select 1 from public.application_eligibility_reviews r where r.id = eligibility_review_id
    and (select private.current_user_can_access_application(r.application_id))));

revoke all on function public.set_grant_requirement(uuid,text,public.grant_requirement_status,text),
  public.confirm_grant_eligibility(uuid,public.grant_eligibility_status,text),
  public.set_grant_scoring_override(uuid,boolean,text) from public, anon;
grant execute on function public.set_grant_requirement(uuid,text,public.grant_requirement_status,text),
  public.confirm_grant_eligibility(uuid,public.grant_eligibility_status,text),
  public.set_grant_scoring_override(uuid,boolean,text) to authenticated;
revoke all on function private.assert_grant_eligibility_parent(uuid,uuid), private.grant_scoring_allowed(uuid),
  private.enforce_grant_scoring_gate(), private.validate_grant_eligibility_review(),
  private.claim_review_idempotency(uuid,uuid,uuid,text,text,jsonb) from public, anon, authenticated;

commit;
