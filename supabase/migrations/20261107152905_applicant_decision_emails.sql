-- Additive correspondence workflow. No review, selection, or eligibility backfill.
create table public.application_decision_events (
 id uuid primary key default gen_random_uuid(),
 application_id uuid not null references public.portal_applications(id),
 program_id uuid not null references public.programs(id),
 not_selected boolean not null, reason text not null check(length(trim(reason)) between 10 and 2000),
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default clock_timestamp()
);
create index on public.application_decision_events(application_id,created_at desc);
create table public.application_emails (
 id uuid primary key, application_id uuid not null references public.portal_applications(id),
 program_id uuid not null references public.programs(id), actor_id uuid not null references auth.users(id),
 kind text not null check(kind in ('decision','recipient')),
 recipient text not null, sender text not null default 'info@justiceleagueglm.org' check(sender='info@justiceleagueglm.org'),
 subject text not null, body text not null, template_revision text not null,
 snapshot jsonb not null, non_selection_confirmed boolean not null, phone_contact_confirmed boolean not null,
 status text not null default 'reserved' check(status in ('reserved','sending','accepted','failed','unknown')),
 provider_id text, error_message text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Failed means definitely not accepted. All ambiguous outcomes remain locked against retries.
create unique index application_email_once on public.application_emails(application_id,kind) where status<>'failed';
create index on public.application_emails(program_id,application_id,created_at desc);
alter table public.application_decision_events enable row level security;
alter table public.application_emails enable row level security;
revoke all on public.application_decision_events,public.application_emails from public,anon,authenticated;
grant select on public.application_decision_events,public.application_emails to authenticated;
grant select,update on public.application_emails to service_role;
create policy program_admin_read on public.application_decision_events for select to authenticated using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));
create policy program_admin_read on public.application_emails for select to authenticated using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));

create function private.application_email_state(p_application uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.portal_applications; s public.grant_selection_decisions; d public.application_decision_events;
 assigned integer; completed integer; reviews jsonb; result jsonb;
begin
 select * into a from public.portal_applications where id=p_application;
 if not found then raise exception 'Application unavailable'; end if;
 perform private.assert_grant_committee_admin(a.program_id);
 if a.is_test or a.practice_session_id is not null or a.duplicate_of is not null or a.status='withdrawn'
 or not exists(select 1 from public.programs where id=a.program_id and active) then raise exception 'Only active real applications may receive decision emails'; end if;
 select * into s from public.grant_selection_decisions where program_id=a.program_id;
 select * into d from public.application_decision_events where application_id=a.id order by created_at desc,id desc limit 1;
 select count(*),count(*) filter(where r.status='completed'),coalesce(jsonb_agg(jsonb_build_object('assignment',x.id,'review',r.id,'status',r.status,'version',r.version) order by x.id),'[]'::jsonb)
 into assigned,completed,reviews from public.reviewer_assignments x left join public.program_reviews r on r.assignment_id=x.id
 where x.application_id=a.id and x.lifecycle='active' and x.transferred_at is null;
 result:=jsonb_build_object('applicationId',a.id,'programId',a.program_id,'name',a.applicant_name,'email',a.applicant_email,
 'businessName',(select business_name from public.business_grant_application_details where application_id=a.id),
 'assigned',assigned,'completed',completed,'reviewComplete',assigned>0 and completed=assigned,
 'recipient',coalesce(a.id=any(s.recipient_ids),false),'finalized',s.finalized_at is not null,
 'notSelected',coalesce(d.not_selected,false),'decisionId',d.id,'decisionReason',d.reason,
 'selectionRevision',coalesce(s.revision,0),'applicationUpdated',a.updated_at,'reviews',reviews);
 return result || jsonb_build_object('fingerprint',md5(result::text));
end $$;
revoke all on function private.application_email_state(uuid) from public,anon,authenticated;
create function public.application_email_workspace(p_application uuid) returns jsonb
language sql security definer set search_path='' as $$
 select private.application_email_state(p_application) || jsonb_build_object('history',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.application_emails e where e.application_id=p_application),'[]'::jsonb));
$$;
revoke all on function public.application_email_workspace(uuid) from public,anon;
grant execute on function public.application_email_workspace(uuid) to authenticated;

create function public.record_application_non_selection(p_application uuid,p_fingerprint text,p_not_selected boolean,p_reason text) returns void
language plpgsql security definer set search_path='' as $$
declare state jsonb; p uuid;
begin
 select program_id into p from public.portal_applications where id=p_application;
 perform private.assert_grant_committee_admin(p);
 perform 1 from public.programs where id=p for update;
 perform 1 from public.portal_applications where id=p_application for update;
 state:=private.application_email_state(p_application);
 if state->>'fingerprint' is distinct from p_fingerprint then raise exception 'Application changed. Reload before recording a decision.'; end if;
 if (state->>'recipient')::boolean then raise exception 'A finalized recipient cannot be marked not selected'; end if;
 if exists(select 1 from public.application_emails where application_id=p_application and status<>'failed') then raise exception 'An email is reserved or has been sent. Reconcile it before changing the decision.'; end if;
 if p_not_selected is null or p_reason is null or length(trim(p_reason)) not between 10 and 2000 then raise exception 'Enter a decision reason of 10–2000 characters'; end if;
 insert into public.application_decision_events(application_id,program_id,not_selected,reason,actor_id) values(p_application,p,p_not_selected,trim(p_reason),auth.uid());
end $$;
revoke all on function public.record_application_non_selection(uuid,text,boolean,text) from public,anon;
grant execute on function public.record_application_non_selection(uuid,text,boolean,text) to authenticated;

create function public.reserve_application_email(p_id uuid,p_application uuid,p_fingerprint text,p_kind text,p_subject text,p_body text,p_non_selection_confirmed boolean,p_phone_contact_confirmed boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare state jsonb; p uuid;
begin
 select program_id into p from public.portal_applications where id=p_application;
 perform private.assert_grant_committee_admin(p);
 perform 1 from public.programs where id=p for update;
 perform 1 from public.portal_applications where id=p_application for update;
 state:=private.application_email_state(p_application);
 if state->>'fingerprint' is distinct from p_fingerprint then raise exception 'Application changed. Reload and preview the email again.'; end if;
 if p_kind is null or p_kind not in ('decision','recipient') then raise exception 'Invalid email type'; end if;
 if p_kind='recipient' and (not (state->>'recipient')::boolean or not coalesce(p_phone_contact_confirmed,false)) then raise exception 'Confirm a finalized recipient and completed phone contact'; end if;
 if p_kind='decision' and ((state->>'recipient')::boolean or not coalesce(p_non_selection_confirmed,false)
 or not ((state->>'notSelected')::boolean or ((state->>'finalized')::boolean and (state->>'reviewComplete')::boolean))) then
 raise exception 'Complete all required reviews and finalize recipients, or explicitly record Not selected before sending an application decision.'; end if;
 if coalesce(state->>'email','') !~ '^[A-Za-z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' then raise exception 'A valid applicant email is required'; end if;
 if p_subject is null or length(trim(p_subject)) not between 1 and 160 or p_subject ~ E'[\r\n]' or p_body is null or length(trim(p_body)) not between 1 and 20000
 or (p_subject || ' ' || p_body) ~* '(\mdenial\M|\[NEEDS|\[PLACEHOLDER|\{\{)' then raise exception 'Check the subject and body: no denial wording, placeholders, or invalid lengths'; end if;
 insert into public.application_emails(id,application_id,program_id,actor_id,kind,recipient,subject,body,template_revision,snapshot,non_selection_confirmed,phone_contact_confirmed)
 values(p_id,p_application,p,auth.uid(),p_kind,state->>'email',p_subject,p_body,'prince-2026-11-07-v1',state,coalesce(p_non_selection_confirmed,false),coalesce(p_phone_contact_confirmed,false));
 return p_id;
end $$;
revoke all on function public.reserve_application_email(uuid,uuid,text,text,text,text,boolean,boolean) from public,anon;
grant execute on function public.reserve_application_email(uuid,uuid,text,text,text,text,boolean,boolean) to authenticated;

-- Finalization must not contradict an already recorded non-selection or decision email.
create function private.guard_selection_email_decisions() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from unnest(new.recipient_ids) a(id) where
 coalesce((select not_selected from public.application_decision_events where application_id=a.id order by created_at desc,id desc limit 1),false)
 or exists(select 1 from public.application_emails where application_id=a.id and kind='decision' and status<>'failed')) then
 raise exception 'A recipient has a Not selected decision or an application-decision email. Resolve that record before finalizing.'; end if;
 return new;
end $$;
revoke all on function private.guard_selection_email_decisions() from public,anon,authenticated;
create trigger guard_selection_email_decisions before insert or update on public.grant_selection_decisions for each row execute function private.guard_selection_email_decisions();

-- Serialize changes with reservation. Do not hold a database transaction open over a network send.
create function private.guard_pending_application_email() returns trigger language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
 if tg_table_name='portal_applications' then
  if tg_op='UPDATE' and new.applicant_email is not distinct from old.applicant_email and new.applicant_name=old.applicant_name and new.program_id=old.program_id and new.status=old.status and new.is_test=old.is_test and new.duplicate_of is not distinct from old.duplicate_of and new.practice_session_id is not distinct from old.practice_session_id then return new; end if;
  a:=old.id;
 else
  a:=case when tg_op='DELETE' then old.application_id else new.application_id end;
  perform 1 from public.portal_applications where id=a for update;
 end if;
 if exists(select 1 from public.application_emails where application_id=a and status in ('reserved','sending','unknown')) then
 raise exception 'An applicant email is pending. Reconcile its outcome before changing this application or its reviews.'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.guard_pending_application_email() from public,anon,authenticated;
create trigger guard_pending_application_email before update or delete on public.portal_applications for each row execute function private.guard_pending_application_email();
create trigger guard_pending_assignment_email before insert or update or delete on public.reviewer_assignments for each row execute function private.guard_pending_application_email();
create trigger guard_pending_review_email before insert or update or delete on public.program_reviews for each row execute function private.guard_pending_application_email();

create table public.application_email_reconciliations (
 id uuid primary key default gen_random_uuid(), email_id uuid not null references public.application_emails(id),
 program_id uuid not null references public.programs(id), actor_id uuid not null references auth.users(id),
 previous_status text not null, resolved_status text not null, evidence text not null,
 created_at timestamptz not null default now()
);
alter table public.application_email_reconciliations enable row level security;
revoke all on public.application_email_reconciliations from public,anon,authenticated;
grant select on public.application_email_reconciliations to authenticated;
create policy program_admin_read on public.application_email_reconciliations for select to authenticated using(private.current_user_has_program_role(program_id,array['admin']::public.program_access_role[]));
create function public.reconcile_application_email(p_email uuid,p_accepted boolean,p_evidence text) returns void
language plpgsql security definer set search_path='' as $$
declare e public.application_emails;
begin
 select * into e from public.application_emails where id=p_email;
 perform private.assert_grant_committee_admin(e.program_id);
 perform 1 from public.programs where id=e.program_id for update;
 perform 1 from public.portal_applications where id=e.application_id for update;
 select * into e from public.application_emails where id=p_email for update;
 if e.status not in ('unknown','reserved','sending') or e.updated_at > now()-interval '5 minutes' then raise exception 'Only uncertain or stale sends older than five minutes can be reconciled'; end if;
 if p_accepted is null or p_evidence is null or length(trim(p_evidence)) not between 20 and 2000 then raise exception 'Record mailbox verification evidence (20–2000 characters)'; end if;
 insert into public.application_email_reconciliations(email_id,program_id,actor_id,previous_status,resolved_status,evidence)
 values(e.id,e.program_id,auth.uid(),e.status,case when p_accepted then 'accepted' else 'failed' end,trim(p_evidence));
 update public.application_emails set status=case when p_accepted then 'accepted' else 'failed' end,
 error_message='Manually reconciled after checking the mailbox: '||trim(p_evidence),updated_at=now() where id=e.id;
end $$;
revoke all on function public.reconcile_application_email(uuid,boolean,text) from public,anon;
grant execute on function public.reconcile_application_email(uuid,boolean,text) to authenticated;
-- Service credentials may only claim and record delivery, not rewrite reviewed message content.
revoke all on public.application_emails from service_role;
grant select on public.application_emails to service_role;
grant update(status,provider_id,error_message,updated_at) on public.application_emails to service_role;
