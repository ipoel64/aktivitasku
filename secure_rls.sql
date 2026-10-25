-- Fase 4: Mengamankan Database YASPEN Budi Utomo dengan Row Level Security (RLS)

-- 1. Mengamankan Tabel 'activities' (Aktivitas Siswa)
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Siswa HANYA BISA melihat aktivitas miliknya sendiri
-- Guru BISA melihat semua aktivitas
DROP POLICY IF EXISTS "Siswa melihat aktivitasnya sendiri & Guru melihat semua" ON activities;
CREATE POLICY "Siswa melihat aktivitasnya sendiri & Guru melihat semua"
ON public.activities
FOR SELECT
USING (
  (auth.uid() IN (
    SELECT up.user_id FROM user_profiles up
    JOIN students s ON s.profile_id = up.id
    WHERE s.id = activities.student_id
  ))
  OR 
  (auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'guru'
  ))
);

-- Siswa BISA menambahkan aktivitas miliknya sendiri
DROP POLICY IF EXISTS "Siswa bisa menambah aktivitas" ON activities;
CREATE POLICY "Siswa bisa menambah aktivitas"
ON public.activities
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT up.user_id FROM user_profiles up
    JOIN students s ON s.profile_id = up.id
    WHERE s.id = activities.student_id
  )
);

-- 2. Mengamankan Tabel 'evaluations' (Penilaian Guru)
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

-- Semua (Siswa & Guru) bisa melihat penilaian
DROP POLICY IF EXISTS "Semua bisa melihat penilaian" ON evaluations;
CREATE POLICY "Semua bisa melihat penilaian"
ON public.evaluations
FOR SELECT
USING (true);

-- HANYA GURU yang bisa menambahkan penilaian
DROP POLICY IF EXISTS "Hanya Guru yang bisa menilai" ON evaluations;
CREATE POLICY "Hanya Guru yang bisa menilai"
ON public.evaluations
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM public.users WHERE role = 'guru'
  )
);
