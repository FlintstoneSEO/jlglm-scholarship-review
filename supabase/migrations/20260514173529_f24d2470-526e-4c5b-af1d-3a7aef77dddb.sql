DO $$ BEGIN
  CREATE TYPE public.preliminary_screening_status AS ENUM ('pending_screening', 'eligible_for_review', 'did_not_meet_minimum_requirements');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.applicants 
  ADD COLUMN IF NOT EXISTS preliminary_screening_status public.preliminary_screening_status NOT NULL DEFAULT 'pending_screening';