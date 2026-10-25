# 📝 Detail Form Isian (Biodata)

Berikut adalah contoh rincian *field* (kolom isian) yang akan muncul pada layar aplikasi saat pengguna (Siswa atau Guru) pertama kali mendaftar atau melengkapi profil mereka. 

Form ini dirancang berdasarkan struktur *Database* (Tabel `user_profiles`, `students`, dan `teachers`) yang telah kita susun.

---

## 🎒 1. Form Biodata Siswa
*(Form ini akan muncul di Aplikasi Mobile setelah Siswa berhasil membuat akun)*

### Bagian A: Identitas Pribadi
- **Nama Lengkap**: `[Text Input]` *(Wajib)*
- **Nomor Induk Siswa Nasional (NISN)**: `[Number Input]` *(Wajib, 10 Digit)*
- **Nomor Induk Siswa (NIS)**: `[Number Input]`
- **Jenis Kelamin**: `[Dropdown: Laki-laki / Perempuan]` *(Wajib)*
- **Agama**: `[Dropdown: Islam / Kristen / Katolik / Hindu / Buddha / Konghucu]`
- **Tanggal Lahir**: `[Date Picker]`
- **Nomor HP / WhatsApp**: `[Phone Input]`

### Bagian B: Data Akademik
- **Jenjang Pendidikan**: `[Dropdown: SD / SMP / SMA]` *(Wajib)*
- **Pilih Kelas Saat Ini**: `[Dropdown: 7A, 7B, 10-MIPA, dll]` *(Berdasarkan jenjang yang dipilih)*
- **Cita-cita**: `[Text Input]`

### Bagian C: Profil Bakat & Minat
- **Bakat / Keahlian**: `[Multiple Choice / Tags: Melukis, Menyanyi, Olahraga, Mengaji, dll]`
- **Hobi**: `[Text Area]`
- **Ketertarikan (Interests)**: `[Text Area]`
- **Ekstrakurikuler yang Diikuti**: `[Multiple Select: Pramuka, PMR, Rohis, Futsal, dll]`

### Bagian D: Data Fisik & Alamat
- **Golongan Darah**: `[Dropdown: A / B / AB / O]`
- **Riwayat Penyakit Khusus**: `[Text Area]` *(Opsional)*
- **Alamat Rumah Lengkap**: `[Text Area]` *(Wajib)*
- **Titik Koordinat Rumah (GPS)**: `[Button: Deteksi Lokasi Saya 📍]` *(Otomatis terisi Latitude & Longitude)*

### Bagian E: Data Orang Tua / Wali
- **Nama Ayah/Ibu/Wali**: `[Text Input]`
- **Nomor HP Orang Tua**: `[Phone Input]` *(Sangat penting untuk grup komunikasi)*
- **Pekerjaan Orang Tua**: `[Text Input]`

---

## 👨‍🏫 2. Form Biodata Guru / Wali Kelas
*(Form ini akan muncul di Portal Web setelah Guru login pertama kali)*

### Bagian A: Identitas Pribadi
- **Nama Lengkap (Beserta Gelar)**: `[Text Input]` *(Wajib)*
- **Jenis Kelamin**: `[Dropdown: Laki-laki / Perempuan]` *(Wajib)*
- **Agama**: `[Dropdown: Islam / Kristen / dll]`
- **Tanggal Lahir**: `[Date Picker]`
- **Nomor HP / WhatsApp Aktif**: `[Phone Input]` *(Wajib)*
- **Alamat Tempat Tinggal**: `[Text Area]`

### Bagian B: Data Kepegawaian (Dinas)
- **NIP (Jika PNS)**: `[Number Input]` *(Opsional)*
- **NUPTK**: `[Number Input]` *(Opsional)*
- **NIK (KTP)**: `[Number Input]` *(Wajib)*
- **Status Kepegawaian**: `[Dropdown: PNS / Guru Tetap Yayasan (GTY) / Guru Tidak Tetap (GTT) / Honorer]`
- **Tanggal Bergabung**: `[Date Picker]`

### Bagian C: Penugasan Mengajar
- **Jabatan Utama**: `[Dropdown: Guru Mata Pelajaran / Wali Kelas / Kepala Sekolah / Staf]`
- **Mata Pelajaran yang Diampu**: `[Multiple Select: Matematika, Agama, Penjaskes, dll]`
- **Wali Kelas Untuk**: `[Dropdown: 7A, 8B, dll]` *(Pilih jika menjabat sebagai wali kelas)*

### Bagian D: Riwayat Pendidikan Guru
- **Pendidikan Terakhir**: `[Dropdown: D3 / S1 / S2 / S3]`
- **Universitas / Perguruan Tinggi**: `[Text Input]`
- **Jurusan / Program Studi**: `[Text Input]`
- **Sertifikasi Profesi**: `[Text Area]` *(Opsional)*

---

> [!TIP]
> **Catatan Pengembang (Developer Note):**
> 1. Input dengan label `[Date Picker]` akan menggunakan kalender interaktif agar penulisan tanggal seragam di database.
> 2. Tombol `[Deteksi Lokasi Saya 📍]` pada form Siswa bertujuan agar sistem Peta (Map) yang baru saja kita buat di Portal Kepala Sekolah bisa mengetahui sebaran lokasi rumah murid dengan presisi.
