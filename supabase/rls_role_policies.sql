-- Aktifkan RLS pada tabel role
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama (opsional)
DROP POLICY IF EXISTS "Users can view own student data" ON public.students;
DROP POLICY IF EXISTS "Users can update own student data" ON public.students;
DROP POLICY IF EXISTS "Users can insert own student data" ON public.students;

DROP POLICY IF EXISTS "Users can view own teacher data" ON public.teachers;
DROP POLICY IF EXISTS "Users can update own teacher data" ON public.teachers;
DROP POLICY IF EXISTS "Users can insert own teacher data" ON public.teachers;

-- Siswa
CREATE POLICY "Users can view own student data" ON public.students 
  FOR SELECT USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own student data" ON public.students 
  FOR UPDATE USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own student data" ON public.students 
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Guru
CREATE POLICY "Users can view own teacher data" ON public.teachers 
  FOR SELECT USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own teacher data" ON public.teachers 
  FOR UPDATE USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own teacher data" ON public.teachers 
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

-- Orang Tua
CREATE POLICY "Users can view own parent data" ON public.parents 
  FOR SELECT USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own parent data" ON public.parents 
  FOR UPDATE USING (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own parent data" ON public.parents 
  FOR INSERT WITH CHECK (profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));
