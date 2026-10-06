begin;

create function public.save_grant_eligibility_checklist(
  p_application_id uuid,
  p_items jsonb,
  p_expected_updated_at timestamptz default null,
  p_decision public.grant_eligibility_status default null,
  p_notes text default null
) returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  v_program_id uuid;
  v_parent public.application_eligibility_reviews%rowtype;
  v_created uuid;
  v_item jsonb;
begin
  select program_id into v_program_id from public.portal_applications where id = p_application_id;
  perform private.assert_grant_eligibility_parent(p_application_id, v_program_id);
  if auth.uid() is null or not private.current_user_has_program_role(v_program_id, array['admin']::public.program_access_role[]) then
    raise exception 'Program administrator access is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Invalid eligibility checklist';
  end if;
  if jsonb_array_length(p_items) > 6 or exists (
    select 1 from jsonb_array_elements(p_items) item
    where jsonb_typeof(item) <> 'object' or item->>'key' is null or item->>'status' is null
  ) or (select count(*) <> count(distinct item->>'key') from jsonb_array_elements(p_items) item) then
    raise exception 'Invalid eligibility checklist';
  end if;
  insert into public.application_eligibility_reviews(application_id, program_id)
    values(p_application_id, v_program_id) on conflict(application_id) do nothing returning id into v_created;
  select * into strict v_parent from public.application_eligibility_reviews where application_id = p_application_id for update;
  if (v_created is null and v_parent.updated_at is distinct from p_expected_updated_at)
    or (v_created is not null and p_expected_updated_at is not null) then
    raise exception 'Eligibility changed since you opened it. Reload the application before saving.';
  end if;
  for v_item in select value from jsonb_array_elements(p_items) loop
    -- Existing RPC enforces keys, states, actor/time, decision reset and override revocation.
    perform public.set_grant_requirement(p_application_id, v_item->>'key',
      (v_item->>'status')::public.grant_requirement_status, v_item->>'notes');
  end loop;
  if p_decision is not null then
    perform public.confirm_grant_eligibility(p_application_id, p_decision, p_notes);
  end if;
  return (select updated_at from public.application_eligibility_reviews where id = v_parent.id);
end $$;

revoke all on function public.save_grant_eligibility_checklist(uuid,jsonb,timestamptz,public.grant_eligibility_status,text) from public,anon;
grant execute on function public.save_grant_eligibility_checklist(uuid,jsonb,timestamptz,public.grant_eligibility_status,text) to authenticated;
commit;
