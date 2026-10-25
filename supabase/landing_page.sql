-- Buat tabel landing_images
CREATE TABLE public.landing_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Aktifkan RLS
ALTER TABLE public.landing_images ENABLE ROW LEVEL SECURITY;

-- Izinkan semua orang (publik) untuk melihat gambar landing page yang aktif
CREATE POLICY "Public can view active landing images" 
ON public.landing_images FOR SELECT 
USING (is_active = true);

-- Izinkan admin untuk mengelola (insert, update, delete)
CREATE POLICY "Admins can manage landing images" 
ON public.landing_images FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() AND users.role = 'admin'
  )
);

-- Masukkan beberapa gambar dummy awal
INSERT INTO public.landing_images (image_url, title, description, sort_order) VALUES
('https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=2070&auto=format&fit=crop', 'Pendidikan Masa Depan', 'Membangun generasi cerdas dan berkarakter.', 1),
('https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=2022&auto=format&fit=crop', 'Fasilitas Terbaik', 'Belajar dengan nyaman dan menyenangkan.', 2),
('https://images.unsplash.com/photo-1427504494785-319ce1473799?q=80&w=2070&auto=format&fit=crop', 'Raih Cita-citamu', 'Bersama kami menuju masa depan gemilang.', 3);

-- Buat bucket storage untuk mengunggah gambar (jalankan ini jika Anda bisa menjalankannya di Supabase, atau buat manual via UI Supabase Storage)
INSERT INTO storage.buckets (id, name, public) VALUES ('public_assets', 'public_assets', true) ON CONFLICT DO NOTHING;

-- Policy untuk storage
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'public_assets' );
CREATE POLICY "Admin Upload Access" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'public_assets' AND auth.role() = 'authenticated' );
CREATE POLICY "Admin Delete Access" ON storage.objects FOR DELETE USING ( bucket_id = 'public_assets' AND auth.role() = 'authenticated' );
