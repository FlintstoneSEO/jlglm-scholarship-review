begin;
create function public.my_grant_group_rankings(p_program uuid)
returns table (group_id uuid, group_name text, application_id uuid, business_name text,
 applicant_name text, assigned bigint, submitted bigint, average_score numeric, standing bigint, state text)
language sql stable security definer set search_path = '' as $$
 with visible as (
   select g.id as group_id, g.name as group_name, a.id, a.applicant_name, d.business_name
   from public.grant_reviewer_groups g
   join public.grant_reviewer_group_members m on m.group_id=g.id and m.user_id=auth.uid()
   join public.programs p on p.id=g.program_id and p.slug='business_growth_grant'
   join public.active_reviewer_assignments own on own.program_id=p.id
     and own.reviewer_id=m.user_id and own.lifecycle='active'
   join public.production_applications a on a.id=own.application_id
   left join public.business_grant_application_details d on d.application_id=a.id
   where p.id=p_program and private.current_user_has_program_role(p.id,array['reviewer','admin']::public.program_access_role[])
     and private.grant_transfer_ownership(a.id)->>'id'=g.id::text
     and not exists (select 1 from public.grant_conflict_reports c
       where c.assignment_id=own.id and c.resolved_at is null)
 ), totals as (
   select v.*, count(x.id) assigned, count(r.id) submitted,
     case when count(r.id)=count(s.total) then avg(s.total) end as score
   from visible v
   join public.active_reviewer_assignments x on x.application_id=v.id and x.lifecycle='active'
   left join public.active_program_reviews r on r.assignment_id=x.id and r.status='completed'
   left join lateral (
     select sum(points.points)::numeric as total
     from public.rubric_criteria k
     left join public.review_scores points on points.criterion_id=k.id and points.review_id=r.id
     where k.rubric_version_id=r.rubric_version_id and k.active
     having sum(k.maximum_points)=100 and count(*)=count(points.points)
       and bool_and(points.points between 0 and k.maximum_points)
       and count(*)=(select count(*) from public.review_scores all_scores where all_scores.review_id=r.id)
   ) s on true
   group by v.group_id,v.group_name,v.id,v.applicant_name,v.business_name
 ), classified as (
   select t.*, case
     when not exists (select 1 from public.application_eligibility_reviews e where e.application_id=t.id
       and (e.status='eligible' or (select o.scoring_allowed from public.eligibility_scoring_overrides o
       where o.eligibility_review_id=e.id order by o.event_number desc limit 1))) then 'Eligibility pending'
     when submitted=0 then 'Awaiting review'
     when score is null then 'Score unavailable'
     when submitted<assigned then 'Provisional'
     else 'Complete' end as state
   from totals t
 ), standings as (
   select c.*, case when state in ('Provisional','Complete') then score end as current_score from classified c
 )
 select group_id,group_name,id,business_name,applicant_name,assigned,submitted,current_score,
   case when current_score is not null then rank() over(partition by group_id order by current_score desc nulls last) end,state
 from standings order by group_name,group_id,current_score desc nulls last,business_name,applicant_name,id;
$$;
revoke all on function public.my_grant_group_rankings(uuid) from public,anon;
grant execute on function public.my_grant_group_rankings(uuid) to authenticated;
commit;
