create function public.grant_ranking_groups(p_program uuid)
returns table (group_id uuid, group_name text, application_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
  perform private.assert_grant_committee_admin(p_program);
  return query
    with ownership as materialized (
      select a.id, (private.grant_transfer_ownership(a.id)->>'id')::uuid as owner_id
      from public.production_applications a where a.program_id=p_program
    )
    select g.id, g.name, o.id
    from public.grant_reviewer_groups g
    left join ownership o on o.owner_id=g.id
    where g.program_id=p_program
    order by g.name,g.id;
end $$;
revoke all on function public.grant_ranking_groups(uuid) from public, anon;
grant execute on function public.grant_ranking_groups(uuid) to authenticated;
