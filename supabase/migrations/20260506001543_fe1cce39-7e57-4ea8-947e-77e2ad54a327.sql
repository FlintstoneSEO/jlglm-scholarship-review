-- Add Justice League rubric columns to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS writing_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS rhetoric_score integer NOT NULL DEFAULT 0;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS is_complete boolean NOT NULL DEFAULT false;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Range validation
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_writing_score_range;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_writing_score_range CHECK (writing_score BETWEEN 0 AND 9);
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_rhetoric_score_range;
ALTER TABLE public.reviews ADD CONSTRAINT reviews_rhetoric_score_range CHECK (rhetoric_score BETWEEN 0 AND 9);

-- Make legacy score columns nullable / defaulted so they don't block inserts
ALTER TABLE public.reviews ALTER COLUMN essay_score DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN mission_alignment_score DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN education_goals_score DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN personal_impact_score DROP NOT NULL;
ALTER TABLE public.reviews ALTER COLUMN completeness_score DROP NOT NULL;

-- Trigger to auto-compute subtotal (stored in total_score) and updated_at
CREATE OR REPLACE FUNCTION public.compute_review_subtotal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.total_score := COALESCE(NEW.writing_score, 0) + COALESCE(NEW.rhetoric_score, 0);
  NEW.updated_at := now();
  IF NEW.is_complete AND NEW.submitted_at IS NULL THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_compute_subtotal ON public.reviews;
CREATE TRIGGER reviews_compute_subtotal
BEFORE INSERT OR UPDATE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.compute_review_subtotal();

-- Recompute applicant combined total (sum of completed reviews, out of 90)
CREATE OR REPLACE FUNCTION public.recompute_applicant_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE app_id UUID;
BEGIN
  app_id := COALESCE(NEW.applicant_id, OLD.applicant_id);
  UPDATE public.applicants
  SET total_score = COALESCE((
    SELECT SUM(COALESCE(writing_score,0) + COALESCE(rhetoric_score,0))
    FROM public.reviews
    WHERE applicant_id = app_id AND is_complete = true
  ), 0)
  WHERE id = app_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS reviews_recompute_applicant ON public.reviews;
CREATE TRIGGER reviews_recompute_applicant
AFTER INSERT OR UPDATE OR DELETE ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.recompute_applicant_score();