-- Record an admin's confirmation of an email sent outside the portal.
create table public.grant_decision_email_sent (
  application_id uuid not null references public.portal_applications(id),
  program_id uuid not null references public.programs(id),
  decision_id uuid references public.application_decision_events(id),
  recorded_by uuid not null references auth.users(id),
  recorded_by_name text,
  recorded_at timestamptz not null default now(),
  unique nulls not distinct (application_id, decision_id)
);
create index on public.grant_decision_email_sent(program_id, application_id);
alter table public.grant_decision_email_sent enable row level security;
revoke all on public.grant_decision_email_sent from public, anon, authenticated;
grant select on public.grant_decision_email_sent to authenticated;
create policy grant_admin_read on public.grant_decision_email_sent
  for select to authenticated
  using (private.current_user_has_program_role(program_id, array['admin']::public.program_access_role[]));

create function public.record_grant_decision_email_sent(p_application uuid, p_fingerprint text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  program uuid;
  decision uuid;
  state jsonb;
begin
  select program_id into program from public.portal_applications where id = p_application;
  perform private.assert_grant_committee_admin(program);
  perform 1 from public.programs where id = program for update;
  perform 1 from public.portal_applications where id = p_application for update;
  state := private.application_email_state(p_application);
  if state->>'fingerprint' is distinct from p_fingerprint then
    raise exception 'Application changed. Reload before marking the email sent.';
  end if;
  if not (state->>'recipient')::boolean then
    if not (state->>'notSelected')::boolean then
      raise exception 'Record a grant decision before marking an email sent.';
    end if;
    decision := (state->>'decisionId')::uuid;
  end if;
  insert into public.grant_decision_email_sent(
    application_id, program_id, decision_id, recorded_by, recorded_by_name
  )
  values (
    p_application, program, decision, auth.uid(),
    (select nullif(btrim(full_name), '') from public.profiles where id = auth.uid())
  )
  on conflict (application_id, decision_id) do nothing;
end;
$$;
revoke all on function public.record_grant_decision_email_sent(uuid, text) from public, anon;
grant execute on function public.record_grant_decision_email_sent(uuid, text) to authenticated;
