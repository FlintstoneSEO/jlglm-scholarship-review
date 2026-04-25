
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'reviewer', 'viewer');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY CASE role WHEN 'admin' THEN 1 WHEN 'reviewer' THEN 2 WHEN 'viewer' THEN 3 END LIMIT 1 $$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Auto-create profile + assign first user as admin, others as viewer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count int;
BEGIN
  INSERT INTO public.profiles (id, email, full_name) VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  SELECT count(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enums for applicant
CREATE TYPE public.application_status AS ENUM ('submitted','complete','incomplete','finalist','selected','not_selected','withdrawn');
CREATE TYPE public.review_status AS ENUM ('not_started','in_progress','reviewed','needs_discussion','follow_up');
CREATE TYPE public.recommendation AS ENUM ('strongly_recommend','recommend','consider','needs_discussion','do_not_recommend');

-- Applicants
CREATE TABLE public.applicants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_date TIMESTAMPTZ,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  high_school_graduate_or_ged TEXT,
  graduation_high_school TEXT,
  ged_completion_date DATE,
  college_attending TEXT,
  essay_url TEXT,
  transcript_url TEXT,
  applicant_signature_status BOOLEAN DEFAULT false,
  applicant_signature_date DATE,
  guardian_signature_status BOOLEAN DEFAULT false,
  guardian_signature_date DATE,
  is_18_or_older BOOLEAN DEFAULT false,
  has_essay BOOLEAN GENERATED ALWAYS AS (essay_url IS NOT NULL AND length(essay_url) > 0) STORED,
  has_transcript BOOLEAN GENERATED ALWAYS AS (transcript_url IS NOT NULL AND length(transcript_url) > 0) STORED,
  application_status application_status NOT NULL DEFAULT 'submitted',
  review_status review_status NOT NULL DEFAULT 'not_started',
  total_score NUMERIC(5,2) DEFAULT 0,
  rank INT,
  is_finalist BOOLEAN DEFAULT false,
  is_selected BOOLEAN DEFAULT false,
  needs_follow_up BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applicants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read applicants" ON public.applicants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/reviewer insert applicants" ON public.applicants FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin update applicants" ON public.applicants FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'));
CREATE POLICY "Admin delete applicants" ON public.applicants FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER applicants_touch BEFORE UPDATE ON public.applicants FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Reviews
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  essay_score INT NOT NULL DEFAULT 0 CHECK (essay_score BETWEEN 0 AND 30),
  mission_alignment_score INT NOT NULL DEFAULT 0 CHECK (mission_alignment_score BETWEEN 0 AND 25),
  education_goals_score INT NOT NULL DEFAULT 0 CHECK (education_goals_score BETWEEN 0 AND 20),
  personal_impact_score INT NOT NULL DEFAULT 0 CHECK (personal_impact_score BETWEEN 0 AND 15),
  completeness_score INT NOT NULL DEFAULT 0 CHECK (completeness_score BETWEEN 0 AND 10),
  total_score INT GENERATED ALWAYS AS (essay_score + mission_alignment_score + education_goals_score + personal_impact_score + completeness_score) STORED,
  recommendation recommendation,
  reviewer_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read reviews" ON public.reviews FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reviewers insert own reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer')) AND reviewer_id = auth.uid());
CREATE POLICY "Reviewers update own reviews" ON public.reviews FOR UPDATE TO authenticated USING (reviewer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete reviews" ON public.reviews FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- Recompute applicant avg score on review change
CREATE OR REPLACE FUNCTION public.recompute_applicant_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE app_id UUID;
BEGIN
  app_id := COALESCE(NEW.applicant_id, OLD.applicant_id);
  UPDATE public.applicants SET total_score = COALESCE((SELECT AVG(total_score) FROM public.reviews WHERE applicant_id = app_id), 0) WHERE id = app_id;
  RETURN NULL;
END;
$$;
CREATE TRIGGER reviews_recompute AFTER INSERT OR UPDATE OR DELETE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.recompute_applicant_score();

-- Notes
CREATE TABLE public.applicant_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'general',
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.applicant_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read notes" ON public.applicant_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reviewers insert notes" ON public.applicant_notes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'));
CREATE POLICY "Owners update notes" ON public.applicant_notes FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owners delete notes" ON public.applicant_notes FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Contact logs
CREATE TABLE public.contact_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id UUID NOT NULL REFERENCES public.applicants(id) ON DELETE CASCADE,
  contact_type TEXT NOT NULL,
  subject TEXT,
  message TEXT,
  contacted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  contacted_by_name TEXT,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read contacts" ON public.contact_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Reviewers insert contacts" ON public.contact_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'reviewer'));
CREATE POLICY "Admin update contacts" ON public.contact_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete contacts" ON public.contact_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE INDEX idx_applicants_status ON public.applicants(application_status);
CREATE INDEX idx_applicants_score ON public.applicants(total_score DESC);
CREATE INDEX idx_reviews_applicant ON public.reviews(applicant_id);
CREATE INDEX idx_notes_applicant ON public.applicant_notes(applicant_id);
CREATE INDEX idx_contacts_applicant ON public.contact_logs(applicant_id);
