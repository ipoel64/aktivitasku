-- =====================================================================
-- PRD V2.0 : Chat Peta Sebaran & KAIH Quiz Arena
-- Jalankan sekali di Supabase SQL Editor.
-- =====================================================================

-- 1. Pesan / notifikasi Guru <-> Siswa dari Peta Sebaran
CREATE TABLE IF NOT EXISTS public.map_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   uuid NOT NULL,
  sender_role  text NOT NULL DEFAULT 'guru',   -- guru | admin | siswa
  sender_name  text,
  kind         text NOT NULL DEFAULT 'chat',   -- chat | notif
  body         text NOT NULL,
  read_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_map_messages_student ON public.map_messages(student_id, created_at);

-- 2. Kuis edukasi (soal disimpan sebagai JSON agar mudah diubah guru)
CREATE TABLE IF NOT EXISTS public.quizzes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 text NOT NULL,
  category              text DEFAULT 'Karakter 7 KAIH',
  kind                  text DEFAULT 'pilihan_ganda',   -- pilihan_ganda | benar_salah | studi_kasus
  target_class          text DEFAULT 'SEMUA',           -- nama kelas atau SEMUA
  per_question_seconds  int  DEFAULT 20,
  total_seconds         int,                            -- null = pakai waktu per soal
  shuffle_questions     boolean DEFAULT true,
  speed_bonus           boolean DEFAULT true,
  questions             jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{q, options[], answer, explanation}]
  status                text DEFAULT 'DRAFT',           -- DRAFT | LIVE | ENDED
  host_name             text,
  created_at            timestamptz DEFAULT now(),
  started_at            timestamptz,
  ended_at              timestamptz
);

-- 3. Jawaban / skor siswa
CREATE TABLE IF NOT EXISTS public.quiz_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id    uuid NOT NULL,
  student_name  text,
  kelas         text,
  score         int DEFAULT 0,
  correct_count int DEFAULT 0,
  total_count   int DEFAULT 0,
  finished_at   timestamptz DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

-- Akses (selaras dengan kebijakan RLS proyek saat ini)
ALTER TABLE public.map_messages     DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes          DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_submissions DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.map_messages, public.quizzes, public.quiz_submissions TO anon, authenticated;

-- Aktifkan Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.map_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quizzes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_submissions;
