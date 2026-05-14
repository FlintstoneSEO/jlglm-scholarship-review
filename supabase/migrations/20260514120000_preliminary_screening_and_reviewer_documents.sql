BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'preliminary_screening_status' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.preliminary_screening_status AS ENUM (
      'pending_screening',
      'eligible_for_review',
      'did_not_meet_minimum_requirements'
    );
  END IF;
END $$;

ALTER TABLE public.applicants
  ADD COLUMN IF NOT EXISTS preliminary_screening_status public.preliminary_screening_status NOT NULL DEFAULT 'pending_screening',
  ADD COLUMN IF NOT EXISTS preliminary_screening_note text,
  ADD COLUMN IF NOT EXISTS preliminary_screened_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preliminary_screened_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_applicants_preliminary_screening_status
  ON public.applicants(preliminary_screening_status);

DROP POLICY IF EXISTS "Authenticated read applicants" ON public.applicants;
DROP POLICY IF EXISTS "Admin update applicants" ON public.applicants;

CREATE POLICY "Role aware read applicants" ON public.applicants
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    (public.has_role(auth.uid(), 'reviewer') OR public.has_role(auth.uid(), 'viewer'))
    AND preliminary_screening_status = 'eligible_for_review'
  )
);

CREATE POLICY "Role aware update applicants" ON public.applicants
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'))
WITH CHECK (
  public.has_role(auth.uid(),'admin')
  OR (
    public.has_role(auth.uid(),'reviewer')
    AND preliminary_screening_status = 'eligible_for_review'
    AND preliminary_screened_by IS NULL
    AND preliminary_screened_at IS NULL
    AND preliminary_screening_note IS NULL
  )
);

CREATE TABLE IF NOT EXISTS public.reviewer_discussion_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id uuid NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name text,
  reviewer_email text,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size bigint NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviewer_discussion_documents ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_reviewer_discussion_documents_applicant_id ON public.reviewer_discussion_documents(applicant_id);
CREATE INDEX IF NOT EXISTS idx_reviewer_discussion_documents_reviewer_id ON public.reviewer_discussion_documents(reviewer_id);

CREATE POLICY "Admins select all discussion docs" ON public.reviewer_discussion_documents
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reviewers select eligible discussion docs" ON public.reviewer_discussion_documents
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'reviewer')
  AND EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = reviewer_discussion_documents.applicant_id
      AND a.preliminary_screening_status = 'eligible_for_review'
  )
);

CREATE POLICY "Admins insert discussion docs" ON public.reviewer_discussion_documents
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reviewers insert eligible own discussion docs" ON public.reviewer_discussion_documents
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'reviewer')
  AND reviewer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.applicants a
    WHERE a.id = reviewer_discussion_documents.applicant_id
      AND a.preliminary_screening_status = 'eligible_for_review'
  )
);

CREATE POLICY "Admins delete discussion docs" ON public.reviewer_discussion_documents
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Reviewers delete own discussion docs" ON public.reviewer_discussion_documents
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'reviewer') AND reviewer_id = auth.uid());

INSERT INTO storage.buckets (id, name, public)
VALUES ('reviewer-discussion-documents', 'reviewer-discussion-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read reviewer discussion storage" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'reviewer-discussion-documents'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Reviewers read eligible reviewer discussion storage" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'reviewer-discussion-documents'
  AND public.has_role(auth.uid(), 'reviewer')
  AND split_part(name, '/', 2) = auth.uid()::text
);

CREATE POLICY "Admins upload reviewer discussion storage" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reviewer-discussion-documents'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Reviewers upload own reviewer discussion storage" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'reviewer-discussion-documents'
  AND public.has_role(auth.uid(), 'reviewer')
  AND split_part(name, '/', 2) = auth.uid()::text
);

COMMIT;
