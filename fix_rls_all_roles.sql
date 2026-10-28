-- =========================================================================
-- PERBAIKAN ROW LEVEL SECURITY (RLS) SUPABASE - PERGURUAN BUDI UTOMO BINJAI
-- Masalah: Akun Yayasan, Kepala Sekolah, dan Admin melihat data aktivitas & absensi KOSONG (0)
-- Sebab: Policy RLS tabel 'activities' sebelumnya hanya mengizinkan role = 'guru'
-- Solusi: Jalankan skrip ini di menu Supabase Studio > SQL Editor > Klik RUN
-- =========================================================================

-- 1. Mengizinkan Guru, Admin, Yayasan, dan Kepala Sekolah Melihat Seluruh Aktivitas
DROP POLICY IF EXISTS "Siswa melihat aktivitasnya sendiri & Guru melihat semua" ON public.activities;
DROP POLICY IF EXISTS "Aktivitas dapat diakses Guru Admin Yayasan Kepsek" ON public.activities;
DROP POLICY IF EXISTS "Students can view own activities" ON public.activities;

CREATE POLICY "Aktivitas dapat diakses Siswa Guru Admin Yayasan Kepsek"
ON public.activities
FOR SELECT
USING (
  -- Siswa hanya melihat aktivitas miliknya sendiri
  (auth.uid() IN (
    SELECT up.user_id FROM public.user_profiles up
    JOIN public.students s ON s.profile_id = up.id
    WHERE s.id = activities.student_id
  ))
  OR 
  -- Guru, Admin, Yayasan, dan Kepala Sekolah dapat melihat seluruh aktivitas semua kelas
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE LOWER(role::text) IN ('guru', 'admin', 'yayasan', 'kepsek')
  ))
);

-- 2. Pastikan Siswa Bisa Tambah & Ubah Aktivitasnya Sendiri
DROP POLICY IF EXISTS "Siswa bisa menambah aktivitas" ON public.activities;
CREATE POLICY "Siswa bisa menambah aktivitas"
ON public.activities
FOR INSERT
WITH CHECK (
  auth.uid() IN (
    SELECT up.user_id FROM public.user_profiles up
    JOIN public.students s ON s.profile_id = up.id
    WHERE s.id = activities.student_id
  )
);

-- 3. Membuka Akses Tabel Attendance (Absensi Siswa) untuk Semua Peran Pengelola
DROP POLICY IF EXISTS "Attendance dapat diakses Guru Admin Yayasan Kepsek" ON public.attendance;
CREATE POLICY "Attendance dapat diakses Guru Admin Yayasan Kepsek"
ON public.attendance
FOR SELECT
USING (
  (auth.uid() IN (
    SELECT id FROM public.users 
    WHERE LOWER(role::text) IN ('guru', 'admin', 'yayasan', 'kepsek')
  ))
  OR 
  (auth.uid() IN (
    SELECT up.user_id FROM public.user_profiles up
    JOIN public.students s ON s.profile_id = up.id
    WHERE s.id = attendance.student_id
  ))
);

-- 4. Mengizinkan Guru dan Admin Menginput & Memperbarui Absensi
DROP POLICY IF EXISTS "Guru dan Admin dapat mengelola absensi" ON public.attendance;
CREATE POLICY "Guru dan Admin dapat mengelola absensi"
ON public.attendance
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM public.users 
    WHERE LOWER(role::text) IN ('guru', 'admin')
  )
);

-- 5. Tabel Evaluations (Penilaian Aktivitas)
DROP POLICY IF EXISTS "Semua bisa melihat penilaian" ON public.evaluations;
CREATE POLICY "Semua bisa melihat penilaian"
ON public.evaluations
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Hanya Guru dan Admin yang bisa menilai" ON public.evaluations;
CREATE POLICY "Hanya Guru dan Admin yang bisa menilai"
ON public.evaluations
FOR ALL
USING (
  auth.uid() IN (
    SELECT id FROM public.users 
    WHERE LOWER(role::text) IN ('guru', 'admin')
  )
);

-- =========================================================================
-- OPSI ALTERNATIF TERCEPAT (JIKA TIDAK INGIN REPOT DENGAN RLS PADA PORTAL INTERNAL):
-- ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;
-- =========================================================================
