-- schema.sql
-- YASPEN BUDI UTOMO Database Schema (PostgreSQL for Supabase)

-- Enable UUID extension (Enabled by default in Supabase)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums
CREATE TYPE user_role AS ENUM ('siswa', 'guru', 'admin', 'kepsek', 'yayasan', 'ortu');
CREATE TYPE gender_type AS ENUM ('L', 'P');
CREATE TYPE religion_type AS ENUM ('Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu');
CREATE TYPE education_level AS ENUM ('SD', 'SMP', 'SMA');
CREATE TYPE parent_relation AS ENUM ('Ayah', 'Ibu', 'Wali');
CREATE TYPE employment_status AS ENUM ('PNS', 'Honorer', 'GTT');
CREATE TYPE attendance_status AS ENUM ('hadir', 'izin', 'sakit', 'alpha');
CREATE TYPE compliance_reason AS ENUM ('tidak_punya_hp', 'tidak_patuh', 'lupa', 'sakit', 'lainnya');
CREATE TYPE prayer_calculation_method AS ENUM ('Kemenag', 'MWL', 'ISNA');
CREATE TYPE chat_room_type AS ENUM ('private', 'group');
CREATE TYPE language_code AS ENUM ('id', 'en');

-- Table: USERS (extends Supabase auth.users but handled via public for application logic)
CREATE TABLE public.users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role user_role DEFAULT 'siswa',
    is_active BOOLEAN DEFAULT true,
    language language_code DEFAULT 'id',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Table: USER_PROFILES
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    photo_url TEXT,
    birth_date DATE,
    gender gender_type,
    religion religion_type,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: PARENTS
CREATE TABLE public.parents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
    relation parent_relation NOT NULL,
    occupation TEXT,
    notes TEXT
);

-- Table: CLASSES
CREATE TABLE public.classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL, -- e.g., '7A', '8B', '12-IPA-1'
    level education_level NOT NULL,
    grade INTEGER NOT NULL, -- 1 to 12
    academic_year TEXT NOT NULL,
    homeroom_teacher_id UUID -- will add foreign key later after TEACHERS table
);

-- Table: STUDENTS
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
    nisn TEXT UNIQUE,
    nis TEXT,
    class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
    education_level education_level,
    talents TEXT,
    hobbies TEXT,
    interests TEXT,
    extracurriculars TEXT,
    blood_type TEXT,
    aspiration TEXT,
    health_notes TEXT,
    notes TEXT
);

-- Table: PARENT_STUDENT (Many-to-Many relationship)
CREATE TABLE public.parent_student (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_id UUID REFERENCES public.parents(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    UNIQUE(parent_id, student_id)
);

-- Table: TEACHERS
CREATE TABLE public.teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE UNIQUE,
    nip TEXT UNIQUE,
    nuptk TEXT,
    nik TEXT UNIQUE,
    position TEXT,
    subjects TEXT,
    education_level TEXT,
    university TEXT,
    major TEXT,
    employment_status employment_status,
    join_date DATE,
    certifications TEXT
);

-- Add foreign key to classes
ALTER TABLE public.classes ADD CONSTRAINT fk_homeroom_teacher FOREIGN KEY (homeroom_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;

-- Table: ACTIVITY_CATEGORIES
CREATE TABLE public.activity_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    sort_order INTEGER DEFAULT 0
);

-- Table: ACTIVITIES
CREATE TABLE public.activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    activity_time TIME NOT NULL,
    category_id UUID REFERENCES public.activity_categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    description TEXT,
    photo_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: EVALUATIONS
CREATE TABLE public.evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    activity_id UUID REFERENCES public.activities(id) ON DELETE CASCADE UNIQUE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: ATTENDANCE
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    attendance_date DATE NOT NULL,
    period_number INTEGER NOT NULL, -- e.g., 1 for 'Jam ke-1'
    subject TEXT,
    status attendance_status NOT NULL,
    alpha_reason TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, attendance_date, period_number)
);

-- Table: ACTIVITY_COMPLIANCE
CREATE TABLE public.activity_compliance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES public.teachers(id) ON DELETE CASCADE,
    compliance_date DATE NOT NULL,
    reason compliance_reason NOT NULL,
    custom_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, compliance_date)
);

-- Table: STUDENT_PROFILES_ANALYSIS
CREATE TABLE public.student_profiles_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE UNIQUE,
    behavior_summary TEXT,
    talent_analysis TEXT,
    hobby_analysis TEXT,
    habit_patterns TEXT,
    recommendations TEXT,
    evaluated_by UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: PRAYER_SETTINGS
CREATE TABLE public.prayer_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    is_enabled BOOLEAN DEFAULT true,
    timezone TEXT DEFAULT 'Asia/Jakarta',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    calculation_method prayer_calculation_method DEFAULT 'Kemenag',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat System Tables
CREATE TABLE public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT,
    type chat_room_type NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.chat_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(room_id, user_id)
);

CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    attachment_url TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_read BOOLEAN DEFAULT false
);
