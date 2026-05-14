ALTER TABLE public.applicants 
  ADD COLUMN IF NOT EXISTS preliminary_screened_by UUID,
  ADD COLUMN IF NOT EXISTS preliminary_screened_at TIMESTAMPTZ;