-- Create storage bucket for reviewer discussion documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('reviewer-discussion-documents', 'reviewer-discussion-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create table
CREATE TABLE IF NOT EXISTS public.reviewer_discussion_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  reviewer_id UUID,
  reviewer_name TEXT,
  reviewer_email TEXT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rdd_applicant ON public.reviewer_discussion_documents(applicant_id);

ALTER TABLE public.reviewer_discussion_documents ENABLE ROW LEVEL SECURITY;

-- Any authenticated user (reviewer/admin/viewer) can view
CREATE POLICY "Authenticated can view discussion docs"
  ON public.reviewer_discussion_documents FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Reviewers/admins can insert discussion docs"
  ON public.reviewer_discussion_documents FOR INSERT
  TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reviewer'));

CREATE POLICY "Uploader or admin can delete"
  ON public.reviewer_discussion_documents FOR DELETE
  TO authenticated
  USING (reviewer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Storage policies for the bucket
CREATE POLICY "Authenticated can read discussion files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reviewer-discussion-documents');

CREATE POLICY "Reviewers/admins can upload discussion files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reviewer-discussion-documents' 
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'reviewer'))
  );

CREATE POLICY "Uploader or admin can delete discussion files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reviewer-discussion-documents' 
    AND (owner = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  );