-- pgcrypto is installed in extensions; the helper pins an empty search_path.
-- Qualify digest so both review submission RPCs can claim idempotency keys.
create or replace function private.claim_review_idempotency(
  _actor uuid, _program uuid, _application uuid, _intent text, _key text, _payload jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare h text; prior public.review_idempotency_keys%rowtype;
begin
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
