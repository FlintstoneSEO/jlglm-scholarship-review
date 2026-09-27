-- Committee-approved Evaluation Rubric.docx, 2026-09-27.
-- Run only against the intended project after inspecting the preconditions.
-- This is operational data configuration, not a schema migration.
begin;

-- Exercise the existing authenticated administrator workflow and its RLS.
select pg_catalog.set_config('request.jwt.claim.sub', '4dcae629-3fb9-4765-995d-b9e8e53bb62c', true);
set local role authenticated;

do $$
declare
  grant_program uuid := '22222222-2222-4222-8222-222222222222';
  old_version uuid := 'e6b96998-faca-4639-b9c5-548c7df2a6ec';
  new_version uuid;
  criterion_count integer;
  total_points numeric;
begin
  if not exists (select 1 from public.programs where id=grant_program and slug='business_growth_grant') then
    raise exception 'Grant program precondition failed';
  end if;
  if not exists (select 1 from public.rubric_versions where id=old_version and program_id=grant_program and version=1 and active and retired_at is null) then
    raise exception 'Expected active Grant v1 precondition failed';
  end if;
  if exists (select 1 from public.rubric_criteria where rubric_version_id=old_version) then
    raise exception 'Expected empty Grant v1 precondition failed';
  end if;

  new_version := public.create_rubric_version(grant_program, null);
  insert into public.rubric_criteria (program_id, rubric_version_id, name, description, maximum_points, display_order, active)
  values
    (grant_program, new_version, 'Business Narrative & Value Proposition',
     'Evaluate what the business does, its customers and market, the need it addresses, its differentiation, current position, and realistic growth opportunity.', 15, 10, true),
    (grant_program, new_version, 'Financial Performance & Business Health',
     'Review the 2024 and 2025 P&L statements and explanation of changes. Evaluate revenue, profitability, expenses, trends, record quality, and financial understanding. A business does not need to be highly profitable to score well; consider stage, trajectory, and whether the grant could reasonably improve its financial position.', 15, 20, true),
    (grant_program, new_version, 'Growth Opportunity',
     'Evaluate whether the $11,250 grant enables a specific, realistic, meaningful growth opportunity connected to the business''s current position and justified now.', 15, 30, true),
    (grant_program, new_version, 'Use of Grant Funds',
     'Evaluate whether the $11,250 spending plan is specific, reasonable, necessary, eligible, appropriately budgeted, and directly connected to growth.', 20, 40, true),
    (grant_program, new_version, 'Expected Business Impact & Measurable Outcomes',
     'Evaluate specific, measurable, realistic results within 12 months, with a clear causal link to the grant and metrics or targets.', 15, 50, true),
    (grant_program, new_version, 'Business Capacity & Financial Management',
     'Evaluate owner involvement, financial tracking and accounting, customer demand, and ability to execute the proposed project.', 10, 60, true),
    (grant_program, new_version, 'Why This Grant, and Why Now?',
     'Evaluate the timing, strategic importance, growth connection, and whether the grant materially enables the proposed opportunity.', 10, 70, true);

  select count(*), sum(maximum_points) into criterion_count, total_points
  from public.rubric_criteria where rubric_version_id=new_version and active;
  if criterion_count <> 7 or total_points <> 100 then
    raise exception 'Approved rubric must contain seven active criteria totaling 100';
  end if;
  if (select array_agg(maximum_points order by display_order) from public.rubric_criteria where rubric_version_id=new_version and active)
      <> array[15::numeric,15,15,20,15,10,10] then
    raise exception 'Approved rubric order or maxima mismatch';
  end if;

  perform public.activate_rubric_version(grant_program, new_version);
  if not exists (select 1 from public.rubric_versions where id=new_version and active and retired_at is null) or
     not exists (select 1 from public.rubric_versions where id=old_version and not active and retired_at is not null) then
    raise exception 'Rubric activation/retirement verification failed';
  end if;
end;
$$;

commit;
