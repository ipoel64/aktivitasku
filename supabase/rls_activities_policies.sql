-- Aktifkan RLS pada tabel activities
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Hapus policy lama jika ada
DROP POLICY IF EXISTS "Students can view own activities" ON public.activities;
DROP POLICY IF EXISTS "Students can insert own activities" ON public.activities;
DROP POLICY IF EXISTS "Students can update own activities" ON public.activities;
DROP POLICY IF EXISTS "Students can delete own activities" ON public.activities;

-- Policy untuk Siswa mengelola aktivitas mereka sendiri
CREATE POLICY "Students can view own activities" ON public.activities 
  FOR SELECT USING (student_id IN (SELECT id FROM public.students WHERE profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())));
  
CREATE POLICY "Students can insert own activities" ON public.activities 
  FOR INSERT WITH CHECK (student_id IN (SELECT id FROM public.students WHERE profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Students can update own activities" ON public.activities 
  FOR UPDATE USING (student_id IN (SELECT id FROM public.students WHERE profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())));

CREATE POLICY "Students can delete own activities" ON public.activities 
  FOR DELETE USING (student_id IN (SELECT id FROM public.students WHERE profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())));
