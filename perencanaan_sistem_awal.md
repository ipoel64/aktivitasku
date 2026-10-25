# 📋 PERENCANAAN SISTEM — YASPEN BUDI UTOMO
## Sistem Pencatatan & Monitoring Aktivitas Siswa dan Guru

---

## 🏷️ Rekomendasi Nama Aplikasi

| No | Nama | Arti / Alasan |
|----|------|---------------|
| 1 | **AKTIVITAS.KU** ⭐ | Singkat, personal ("ku" = milik saya), mudah diingat siswa. Domain-friendly. |
| 2 | **BUDIKU** | Gabungan "Budi Utomo" + "Ku" (milik saya). Menunjukkan identitas yayasan. |
| 3 | **CATAKU** | "Catatan Aktivitasku" — ringkas, catchy, menggambarkan fungsi utama. |
| 4 | **PANTAU.ID** | Menggambarkan monitoring/pemantauan. Profesional & modern. |
| 5 | **JEJAK BUDI** | "Jejak" = rekam jejak aktivitas, "Budi" = karakter/yayasan. Bermakna mendalam. |

> [!TIP]
> Rekomendasi terbaik: **AKTIVITAS.KU** — mudah diingat, personal, dan langsung menggambarkan fungsi aplikasi.

---

## 📖 Deskripsi Proyek

**YASPEN BUDI UTOMO** adalah sistem aplikasi berbasis mobile & web untuk Yayasan Pendidikan Budi Utomo yang bertujuan:

1. **Mencatat** seluruh aktivitas harian siswa secara real-time
2. **Memonitor** aktivitas siswa oleh Guru/Wali Kelas
3. **Mengevaluasi** dan memberikan penilaian/komentar terhadap aktivitas
4. **Melaporkan** data aktivitas kepada Kepala Sekolah & Yayasan
5. **Menganalisis** pola kebiasaan, perilaku, bakat, dan minat siswa
6. **Memfasilitasi** komunikasi antar stakeholder melalui fitur chat

---

## 👥 Identifikasi Pengguna (User Roles)

| Role | Akses | Fungsi Utama |
|------|-------|--------------|
| **🎒 Siswa** | Input & View Own | Input aktivitas harian, isi biodata, lihat evaluasi guru, chat |
| **👨‍🏫 Guru / Wali Kelas** | View & Evaluate | Monitor aktivitas siswa kelasnya, beri evaluasi/komentar/nilai, chat |
| **🏫 Kepala Sekolah** | View All | Lihat seluruh data, laporan, statistik, print PDF |
| **🏛️ Yayasan** | View All | Lihat seluruh data lintas sekolah, laporan eksekutif |
| **⚙️ Admin** | Full Access | Kelola user, master data, konfigurasi sistem, seluruh fitur |

---

## 🔄 Workflow / Alur Kerja Sistem

### Alur Utama (Main Flow)

```mermaid
flowchart TD
    A["🔐 Login / Register"] --> B{"Peran User?"}
    
    B -->|Siswa| C["📝 Isi Biodata Lengkap\n(Pertama Kali)"]
    C --> D["📋 Input Aktivitas Harian\n(Waktu + Kegiatan + Lokasi)"]
    D --> E["📍 Auto-detect Koordinat GPS"]
    E --> F["✅ Aktivitas Tersimpan"]
    F --> G["📊 Lihat Ringkasan Harian"]
    G --> D
    
    B -->|Guru/Wali Kelas| H["📊 Dashboard Guru"]
    H --> I["👀 Lihat Aktivitas Siswa"]
    I --> J["⭐ Evaluasi / Komentar / Nilai"]
    J --> K["📈 Lihat Profil & Analisis Siswa"]
    
    B -->|Kepala Sekolah| L["📊 Dashboard Kepala Sekolah"]
    L --> M["📈 Statistik & Grafik"]
    M --> N["🗺️ Peta Sebaran"]
    N --> O["🖨️ Print Laporan PDF"]
    
    B -->|Yayasan| P["📊 Dashboard Yayasan"]
    P --> Q["📈 Laporan Eksekutif"]
    Q --> R["📋 Perbandingan Antar Sekolah"]
    
    B -->|Admin| S["⚙️ Panel Admin"]
    S --> T["👥 Kelola User & Master Data"]
    T --> U["📊 Monitoring Sistem"]
    
    style A fill:#0D9488,color:#fff
    style B fill:#F59E0B,color:#000
    style C fill:#6366F1,color:#fff
    style D fill:#6366F1,color:#fff
    style H fill:#10B981,color:#fff
    style L fill:#3B82F6,color:#fff
    style P fill:#8B5CF6,color:#fff
    style S fill:#EF4444,color:#fff
```

### Alur Input Aktivitas Siswa (Detail)

```mermaid
flowchart LR
    A["📱 Buka App"] --> B["📅 Pilih Tanggal"]
    B --> C["⏰ Pilih Jam"]
    C --> D["📂 Pilih Kategori\nAktivitas"]
    D --> E["✏️ Tulis Detail\nKegiatan"]
    E --> F["📍 Auto GPS\nCoordinate"]
    F --> G["📸 Lampiran Foto\n(Opsional)"]
    G --> H["✅ Simpan"]
    H --> I["🔄 Tambah\nAktivitas Lain?"]
    I -->|Ya| C
    I -->|Tidak| J["📊 Lihat\nRingkasan Hari Ini"]
    
    style A fill:#0D9488,color:#fff
    style H fill:#10B981,color:#fff
    style J fill:#6366F1,color:#fff
```

### Alur Evaluasi Guru

```mermaid
flowchart TD
    A["👨‍🏫 Dashboard Guru"] --> B["📋 Pilih Kelas"]
    B --> C["👤 Pilih Siswa"]
    C --> D["📅 Lihat Aktivitas\nper Tanggal"]
    D --> E["📝 Beri Komentar\nper Aktivitas"]
    E --> F["⭐ Beri Nilai/Rating"]
    F --> G["📊 Lihat Profil\nSiswa Keseluruhan"]
    G --> H{"Tindakan?"}
    H -->|Kesimpulan| I["📋 Tulis Kesimpulan\nBakat/Minat/Perilaku"]
    H -->|Laporan| J["🖨️ Generate\nLaporan PDF"]
    H -->|Chat| K["💬 Chat dengan\nSiswa/Orang Tua"]
    
    style A fill:#10B981,color:#fff
    style F fill:#F59E0B,color:#000
    style I fill:#6366F1,color:#fff
    style J fill:#3B82F6,color:#fff
```

### Alur Data Keseluruhan (System Flow)

```mermaid
flowchart TB
    subgraph INPUT ["📥 INPUT LAYER"]
        S1["Siswa 1"] --> ACT["Aktivitas Harian"]
        S2["Siswa 2"] --> ACT
        S3["Siswa N"] --> ACT
    end
    
    subgraph PROCESS ["⚙️ PROCESSING LAYER"]
        ACT --> DB[("🗄️ Database\nSupabase")]
        DB --> AI["🤖 Analisis Pola\n& Kategorisasi"]
        AI --> PROFILE["👤 Profil Siswa\nBakat/Minat/Perilaku"]
    end
    
    subgraph EVALUATE ["📝 EVALUATION LAYER"]
        DB --> GURU["👨‍🏫 Guru/Wali Kelas"]
        GURU -->|Komentar & Nilai| DB
    end
    
    subgraph OUTPUT ["📤 OUTPUT LAYER"]
        PROFILE --> DASH_G["📊 Dashboard Guru"]
        PROFILE --> DASH_KS["📊 Dashboard Kepsek"]
        PROFILE --> DASH_Y["📊 Dashboard Yayasan"]
        PROFILE --> LANDING["🌐 Landing Page"]
        PROFILE --> PDF["🖨️ Laporan PDF"]
    end
    
    subgraph COMM ["💬 COMMUNICATION"]
        CHAT["Chat & Grup Chat"]
        GURU <-.-> CHAT
        S1 <-.-> CHAT
    end
    
    style INPUT fill:#E0F2FE,color:#000
    style PROCESS fill:#F0FDF4,color:#000
    style EVALUATE fill:#FEF3C7,color:#000
    style OUTPUT fill:#F3E8FF,color:#000
    style COMM fill:#FFE4E6,color:#000
```

---

## 🗃️ Desain Database (Entity Relationship)

### ERD (Entity Relationship Diagram)

```mermaid
erDiagram
    USERS ||--o{ USER_PROFILES : has
    USERS {
        uuid id PK
        string email
        string password_hash
        enum role "siswa|guru|admin|kepsek|yayasan"
        boolean is_active
        timestamp created_at
        timestamp last_login
    }
    
    USER_PROFILES ||--o| STUDENTS : extends
    USER_PROFILES ||--o| TEACHERS : extends
    USER_PROFILES {
        uuid id PK
        uuid user_id FK
        string full_name
        string phone
        string address
        float latitude
        float longitude
        string photo_url
        date birth_date
        enum gender "L|P"
    }
    
    STUDENTS {
        uuid id PK
        uuid profile_id FK
        string nisn
        string nis
        uuid class_id FK
        enum education_level "SD|SMP|SMA"
        string talents
        string hobbies
        string interests
        string extracurriculars
        string parent_name
        string parent_phone
        text notes
    }
    
    TEACHERS {
        uuid id PK
        uuid profile_id FK
        string nip
        string position
        string subjects
        date join_date
        string certifications
    }
    
    CLASSES ||--o{ STUDENTS : contains
    CLASSES ||--o| TEACHERS : managed_by
    CLASSES {
        uuid id PK
        string name "contoh: 7A, 8B, 12-IPA-1"
        enum level "SD|SMP|SMA"
        int grade "1-12"
        string academic_year
        uuid homeroom_teacher_id FK
    }
    
    STUDENTS ||--o{ ACTIVITIES : logs
    ACTIVITIES {
        uuid id PK
        uuid student_id FK
        date activity_date
        time activity_time
        uuid category_id FK
        string title
        text description
        string photo_url
        float latitude
        float longitude
        string location_name
        timestamp created_at
    }
    
    ACTIVITY_CATEGORIES ||--o{ ACTIVITIES : categorizes
    ACTIVITY_CATEGORIES {
        uuid id PK
        string name "Ibadah|Belajar|Olahraga|dll"
        string icon
        string color
        int sort_order
    }
    
    ACTIVITIES ||--o{ EVALUATIONS : receives
    TEACHERS ||--o{ EVALUATIONS : gives
    EVALUATIONS {
        uuid id PK
        uuid activity_id FK
        uuid teacher_id FK
        int rating "1-5"
        text comment
        timestamp created_at
    }
    
    STUDENT_PROFILES {
        uuid id PK
        uuid student_id FK
        text behavior_summary
        text talent_analysis
        text hobby_analysis
        text habit_patterns
        text recommendations
        uuid evaluated_by FK
        timestamp updated_at
    }
    STUDENTS ||--o| STUDENT_PROFILES : has_analysis
    
    CHAT_ROOMS ||--o{ CHAT_MESSAGES : contains
    CHAT_ROOMS ||--o{ CHAT_MEMBERS : has
    CHAT_ROOMS {
        uuid id PK
        string name
        enum type "private|group"
        timestamp created_at
    }
    
    CHAT_MEMBERS {
        uuid id PK
        uuid room_id FK
        uuid user_id FK
        timestamp joined_at
    }
    
    CHAT_MESSAGES {
        uuid id PK
        uuid room_id FK
        uuid sender_id FK
        text content
        string attachment_url
        timestamp sent_at
        boolean is_read
    }
    
    USERS ||--o{ CHAT_MEMBERS : joins
    USERS ||--o{ CHAT_MESSAGES : sends
    STUDENTS ||--o| STUDENT_PROFILES : profiled_by
```

---

## 📱 Fitur-Fitur Aplikasi (Per Role)

### 🎒 Fitur Siswa
| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Registrasi & Biodata | Form lengkap: Nama, NISN, foto, kelas, jenjang, bakat, hobi, minat, ekskul, alamat + GPS |
| 2 | Input Aktivitas Harian | Pilih tanggal → jam → kategori → deskripsi → foto (opsional) → auto GPS |
| 3 | Timeline Aktivitas | Tampilan kronologis aktivitas per hari seperti timeline |
| 4 | Lihat Evaluasi Guru | Notifikasi & tampilan komentar/nilai dari guru |
| 5 | Profil Pribadi | Ringkasan bakat, minat, kebiasaan berdasarkan data aktivitas |
| 6 | Chat | Chat pribadi dengan guru, grup kelas |
| 7 | Riwayat Aktivitas | Kalender & filter untuk melihat aktivitas sebelumnya |

### 👨‍🏫 Fitur Guru / Wali Kelas
| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Dashboard | Ringkasan: total siswa, aktivitas hari ini, belum dinilai, pesan baru |
| 2 | Daftar Siswa | List siswa per kelas dengan foto, status aktivitas hari ini |
| 3 | Monitor Aktivitas | Feed real-time aktivitas siswa dengan filter tanggal/kategori |
| 4 | Evaluasi & Komentar | Beri rating ⭐ (1-5) dan komentar per aktivitas |
| 5 | Profil & Analisis Siswa | Grafik pola aktivitas, kesimpulan bakat/minat/perilaku |
| 6 | Laporan PDF | Generate & print laporan per siswa/kelas/periode |
| 7 | Chat & Grup | Chat pribadi/grup dengan siswa |
| 8 | Peta Sebaran | Maps lokasi aktivitas siswa |

### 🏫 Fitur Kepala Sekolah
| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Dashboard Eksekutif | Statistik keseluruhan sekolah dengan grafik interaktif |
| 2 | Monitoring Per Kelas | Perbandingan aktivitas antar kelas |
| 3 | Peta Sebaran | Maps sebaran lokasi siswa & aktivitas |
| 4 | Grafik & Statistik | Bar chart, pie chart, line graph per kategori |
| 5 | Laporan PDF | Print laporan berbagai kategori & filter |
| 6 | Chat | Komunikasi dengan guru & staff |

### 🏛️ Fitur Yayasan
| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Dashboard Eksekutif | Overview seluruh unit sekolah (SD/SMP/SMA) |
| 2 | Laporan Lintas Sekolah | Perbandingan data antar jenjang |
| 3 | Statistik & Grafik | Visualisasi data keseluruhan |
| 4 | Laporan PDF | Laporan eksekutif untuk rapat yayasan |

### ⚙️ Fitur Admin
| No | Fitur | Deskripsi |
|----|-------|-----------|
| 1 | Kelola User | CRUD user semua role, reset password |
| 2 | Master Data | Kelola kelas, kategori aktivitas, tahun akademik |
| 3 | Kelola Konten | Landing page, foto dokumentasi, informasi |
| 4 | Monitoring Sistem | Log aktivitas, statistik penggunaan |
| 5 | Pengaturan | Konfigurasi umum aplikasi |
| 6 | Full Access | Semua fitur role lain |

---

## 🏗️ Arsitektur Teknologi

### Stack Teknologi yang Direkomendasikan

```mermaid
graph TB
    subgraph CLIENT ["📱 CLIENT (Frontend)"]
        MOBILE["📱 Mobile App\nReact Native / Flutter"]
        WEB["🌐 Web App\nNext.js / React"]
        LANDING["🌍 Landing Page\nNext.js"]
    end
    
    subgraph BACKEND ["⚙️ BACKEND (Serverless)"]
        AUTH["🔐 Authentication\nSupabase Auth"]
        API["📡 API\nSupabase Edge Functions"]
        REALTIME["🔄 Realtime\nSupabase Realtime"]
        STORAGE["📦 Storage\nSupabase Storage"]
    end
    
    subgraph DATABASE ["🗄️ DATABASE"]
        DB[("PostgreSQL\nSupabase DB")]
        RLS["🛡️ Row Level Security"]
    end
    
    subgraph SERVICES ["🔧 SERVICES"]
        MAPS["🗺️ Google Maps API\n(Free Tier)"]
        PDF["🖨️ PDF Generation\njsPDF / React-PDF"]
        CHARTS["📊 Charts\nChart.js / Recharts"]
        PUSH["🔔 Push Notifications\nFirebase FCM"]
    end
    
    CLIENT --> BACKEND
    BACKEND --> DATABASE
    CLIENT --> SERVICES
    
    style CLIENT fill:#DBEAFE,color:#000
    style BACKEND fill:#D1FAE5,color:#000
    style DATABASE fill:#FEF3C7,color:#000
    style SERVICES fill:#F3E8FF,color:#000
```

### Rekomendasi Tech Stack

| Layer | Teknologi | Alasan |
|-------|-----------|--------|
| **Mobile App** | **React Native (Expo)** | Cross-platform (iOS + Android), satu codebase, ekosistem besar |
| **Web App** | **React / Vite** | SSR/SSG, performa tinggi, modern development |
| **Backend** | **Supabase** ⭐ | PostgreSQL + Auth + Realtime + Storage, **GRATIS** tier cukup besar |
| **Database** | **Supabase (PostgreSQL)** | Relational, Row Level Security, realtime subscriptions |

---

## 📐 Struktur Halaman / Screens

### Sitemap Aplikasi

```mermaid
graph TD
    ROOT["🌐 AKTIVITAS.KU"] --> LANDING["Landing Page (Public)"]
    ROOT --> LOGIN["🔐 Login / Register"]
    
    LOGIN --> BIODATA["📝 Isi Biodata\n(Pertama Kali)"]
    
    BIODATA --> DASH_S["📱 Dashboard Siswa"]
    BIODATA --> DASH_G["📊 Dashboard Guru"]
    BIODATA --> DASH_KS["📊 Dashboard Kepsek"]
    BIODATA --> DASH_Y["📊 Dashboard Yayasan"]
    BIODATA --> DASH_A["⚙️ Dashboard Admin"]
    
    DASH_S --> S1["Input Aktivitas"]
    DASH_S --> S2["Timeline Harian"]
    DASH_S --> S3["Riwayat & Kalender"]
    DASH_S --> S4["Evaluasi dari Guru"]
    DASH_S --> S5["Profil Saya"]
    DASH_S --> S6["💬 Chat"]
    
    DASH_G --> G1["Daftar Siswa"]
    DASH_G --> G2["Monitor Aktivitas"]
    DASH_G --> G3["Evaluasi & Nilai"]
    DASH_G --> G4["Analisis Siswa"]
    DASH_G --> G5["Laporan & PDF"]
    DASH_G --> G6["💬 Chat"]
    DASH_G --> G7["🗺️ Peta Sebaran"]
    
    DASH_KS --> K1["Statistik Sekolah"]
    DASH_KS --> K2["Per Kelas"]
    DASH_KS --> K3["Grafik & Chart"]
    DASH_KS --> K4["🗺️ Peta Sebaran"]
    DASH_KS --> K5["Laporan & PDF"]
    
    DASH_A --> A1["Kelola User"]
    DASH_A --> A2["Master Data"]
    DASH_A --> A3["Kelola Konten"]
    DASH_A --> A4["Pengaturan"]
    
    LANDING --> LP1["Profil Yayasan"]
    LANDING --> LP2["Galeri Foto"]
    LANDING --> LP3["Statistik Publik"]
    LANDING --> LP4["🗺️ Peta"]
    LANDING --> LP5["Kontak"]
    
    style ROOT fill:#0D9488,color:#fff
    style LANDING fill:#6366F1,color:#fff
    style LOGIN fill:#F59E0B,color:#000
    style DASH_S fill:#10B981,color:#fff
    style DASH_G fill:#3B82F6,color:#fff
    style DASH_KS fill:#8B5CF6,color:#fff
    style DASH_Y fill:#EC4899,color:#fff
    style DASH_A fill:#EF4444,color:#fff
```

---

## 📅 Timeline Pengembangan (Estimasi)

```mermaid
gantt
    title Timeline Pengembangan AKTIVITAS.KU
    dateFormat  YYYY-MM-DD
    
    section Phase 1 - Foundation
    UI/UX Design (Stitch)        :design, 2026-07-17, 14d
    Setup Supabase & DB          :setup, 2026-07-20, 5d
    Authentication System        :auth, 2026-07-25, 7d
    
    section Phase 2 - Core Features
    Biodata Forms                :bio, 2026-08-01, 10d
    Input Aktivitas (Siswa)      :input, 2026-08-08, 10d
    Dashboard Guru + Evaluasi    :guru, 2026-08-15, 12d
    
    section Phase 3 - Dashboard & Reports
    Dashboard Kepsek/Yayasan     :dash, 2026-08-27, 10d
    Charts & Grafik              :chart, 2026-09-01, 7d
    Maps & Sebaran               :maps, 2026-09-05, 7d
    PDF Reports                  :pdf, 2026-09-10, 7d
    
    section Phase 4 - Communication
    Chat System                  :chat, 2026-09-15, 10d
    Push Notifications           :notif, 2026-09-20, 5d
    
    section Phase 5 - Polish
    Landing Page                 :landing, 2026-09-25, 7d
    Testing & Bug Fixing         :test, 2026-10-01, 14d
    Deployment & Launch          :launch, 2026-10-15, 3d
```
