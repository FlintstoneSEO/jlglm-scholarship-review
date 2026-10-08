begin;

-- Preserve the existing program/practice/Scholarship rules. An unresolved Grant
-- disclosure now also revokes assigned reviewer access to protected materials.
-- Program administrators retain access to resolve disclosures and reassign work.
create or replace function private.current_user_can_access_application(_application_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.portal_applications pa
    where pa.id = _application_id and private.grant_practice_visible(pa.id) and (
      (select private.current_user_has_program_role(pa.program_id, array['admin','viewer']::public.program_access_role[]))
      or (
        (select private.current_user_has_program_role(pa.program_id, array['reviewer']::public.program_access_role[]))
        and exists (
          select 1 from public.reviewer_assignments ra
          where ra.application_id = pa.id and ra.reviewer_id = (select auth.uid()) and ra.lifecycle = 'active'
        )
        and not exists (
          select 1 from public.grant_conflict_reports c
          where c.application_id = pa.id and c.reviewer_id = (select auth.uid()) and c.resolved_at is null
        )
        and (
          not exists (select 1 from public.programs p where p.id = pa.program_id and p.slug = 'scholarship')
          or exists (select 1 from public.applicants a where a.application_id = pa.id and a.preliminary_screening_status = 'eligible_for_review')
        )
      )
    )
  )
$$;

-- No backfill, record updates, score recalculation or new exposed RPC.
notify pgrst, 'reload schema';
commit;
