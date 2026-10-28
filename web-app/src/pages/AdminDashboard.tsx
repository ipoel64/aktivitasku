import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '../utils/supabase';
import {
  UserPlus,
  LogOut,
  CheckCircle,
  XCircle,
  Search,
  Shield,
  BookOpen,
  GraduationCap,
  Download,
  Edit3,
  Building2,
  Award,
  Plus,
  X,
  LayoutDashboard,
  Filter,
  FileSpreadsheet,
  CheckSquare,
  Square,
  Layers,
  Palette,
  ArrowUp,
  ArrowDown,
  Trash2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import {
  loadMasterData,
  loadLandingConfig,
  saveAppConfig,
  DEFAULT_MASTER_DATA,
  DEFAULT_LANDING_CONFIG,
} from '../utils/appConfig';
import type {
  MasterDataConfig,
  LandingPageConfig,
  KaihSlideConfig,
} from '../utils/appConfig';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zshxtebkopkvhdthavhb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_BWHkngZK_Qym3GwhsJfTYQ___iWtw-n';

export function parseTeacherClasses(teacherRow: any): string[] {
  if (!teacherRow) return [];
  try {
    if (teacherRow.certifications) {
      const parsed = JSON.parse(teacherRow.certifications);
      if (Array.isArray(parsed?.assigned_classes)) {
        return parsed.assigned_classes;
      }
    }
  } catch {
    if (typeof teacherRow.certifications === 'string' && teacherRow.certifications.trim()) {
      return teacherRow.certifications.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

export function parseStudentNotes(studentRow: any): Record<string, any> {
  if (!studentRow?.notes) return {};
  try {
    return typeof studentRow.notes === 'string' ? JSON.parse(studentRow.notes) : studentRow.notes;
  } catch {
    return {};
  }
}

interface BulkImportRow {
  full_name: string;
  email: string;
  password: string;
  role: 'siswa' | 'guru' | 'kepsek' | 'yayasan' | 'admin';
  kelas: string;
  jurusan: string;
  jenjang: string;
  extra: string;
  status?: 'pending' | 'success' | 'error';
  message?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  // Active Main Tab: 'users' | 'master_data' | 'landing_page'
  const [activeMainTab, setActiveMainTab] = useState<'users' | 'master_data' | 'landing_page'>('users');

  // Master Data & Landing Page Config State
  const [masterData, setMasterData] = useState<MasterDataConfig>(DEFAULT_MASTER_DATA);
  const [landingConfig, setLandingConfig] = useState<LandingPageConfig>(DEFAULT_LANDING_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // New item inputs for master data
  const [newJenjangInput, setNewJenjangInput] = useState('');
  const [newKelasInput, setNewKelasInput] = useState('');
  const [newJurusanInput, setNewJurusanInput] = useState('');
  const [newAgamaInput, setNewAgamaInput] = useState('');
  const [newSukuInput, setNewSukuInput] = useState('');

  // Users State
  const [users, setUsers] = useState<any[]>([]);
  const [teachersMap, setTeachersMap] = useState<Record<string, any>>({});
  const [studentsMap, setStudentsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('all');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');

  // Create User Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'siswa' | 'guru' | 'kepsek' | 'yayasan' | 'admin'>('guru');
  const [newTeacherClasses, setNewTeacherClasses] = useState<string[]>([]);
  const [newTeacherAllClasses, setNewTeacherAllClasses] = useState(false);
  const [newTeacherSubjects, setNewTeacherSubjects] = useState('');
  const [newTeacherPosition, setNewTeacherPosition] = useState('Guru / Wali Kelas');
  const [newStudentJenjang, setNewStudentJenjang] = useState('SMK Budi Utomo');
  const [newStudentKelas, setNewStudentKelas] = useState('XI Bisnis Digital');
  const [newStudentJurusan, setNewStudentJurusan] = useState('Bisnis Digital');
  const [newStudentNisn, setNewStudentNisn] = useState('');
  const [customClassInput, setCustomClassInput] = useState('');
  const [creating, setCreating] = useState(false);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'siswa' | 'guru' | 'kepsek' | 'yayasan' | 'admin'>('guru');
  const [editTeacherClasses, setEditTeacherClasses] = useState<string[]>([]);
  const [editTeacherAllClasses, setEditTeacherAllClasses] = useState(false);
  const [editTeacherSubjects, setEditTeacherSubjects] = useState('');
  const [editTeacherPosition, setEditTeacherPosition] = useState('');
  const [editStudentJenjang, setEditStudentJenjang] = useState('SMK Budi Utomo');
  const [editStudentKelas, setEditStudentKelas] = useState('');
  const [editStudentJurusan, setEditStudentJurusan] = useState('');
  const [editStudentNisn, setEditStudentNisn] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Bulk Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<BulkImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    fetchAllData();
    loadConfigs();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadConfigs = async () => {
    const [m, l] = await Promise.all([loadMasterData(), loadLandingConfig()]);
    setMasterData(m);
    setLandingConfig(l);
  };

  const fetchAllData = async () => {
    setLoading(true);
    const [usersRes, teachersRes, studentsRes] = await Promise.all([
      supabase
        .from('users')
        .select(`
          id, email, role, is_active, created_at,
          user_profiles (id, full_name, phone, photo_url)
        `)
        .order('created_at', { ascending: false }),
      supabase.from('teachers').select('*'),
      supabase.from('students').select('*'),
    ]);

    if (usersRes.data) {
      setUsers(usersRes.data);
    }

    const tMap: Record<string, any> = {};
    (teachersRes.data || []).forEach((t: any) => {
      if (t.profile_id) tMap[t.profile_id] = t;
    });
    setTeachersMap(tMap);

    const sMap: Record<string, any> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.profile_id) sMap[s.profile_id] = s;
    });
    setStudentsMap(sMap);

    setLoading(false);
  };

  // Combine Master Data classes with any existing classes
  const allAvailableClasses = useMemo(() => {
    const set = new Set<string>(masterData.kelas);
    Object.values(studentsMap).forEach((s: any) => {
      const notes = parseStudentNotes(s);
      if (notes.kelas) set.add(notes.kelas);
    });
    Object.values(teachersMap).forEach((t: any) => {
      parseTeacherClasses(t).forEach((c) => {
        if (c !== 'SEMUA_KELAS') set.add(c);
      });
    });
    return Array.from(set);
  }, [masterData.kelas, studentsMap, teachersMap]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const toggleUserStatus = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ is_active: !currentStatus })
      .eq('id', id);

    if (!error) {
      setUsers(users.map((u) => (u.id === id ? { ...u, is_active: !currentStatus } : u)));
    }
  };

  // ================= MASTER DATA ACTIONS =================
  const addMasterItem = (type: keyof MasterDataConfig, value: string, setter: (v: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (masterData[type].includes(trimmed)) {
      alert(`Data "${trimmed}" sudah ada di daftar.`);
      return;
    }
    setMasterData({
      ...masterData,
      [type]: [...masterData[type], trimmed],
    });
    setter('');
  };

  const removeMasterItem = (type: keyof MasterDataConfig, value: string) => {
    if (confirm(`Hapus "${value}" dari daftar ${type}?`)) {
      setMasterData({
        ...masterData,
        [type]: masterData[type].filter((item) => item !== value),
      });
    }
  };

  const handleSaveMasterData = async () => {
    setSavingConfig(true);
    try {
      await saveAppConfig({ masterData });
      showToast('Master Data sekolah berhasil disimpan dan disinkronkan ke seluruh aplikasi!');
    } catch (err: any) {
      alert('Gagal menyimpan Master Data: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  // ================= LANDING PAGE ACTIONS =================
  const handleSaveLandingPage = async () => {
    setSavingConfig(true);
    try {
      await saveAppConfig({ landingConfig });
      showToast('Tampilan Landing Page berhasil disimpan dan langsung tayang di portal web!');
    } catch (err: any) {
      alert('Gagal menyimpan Pengaturan Landing Page: ' + err.message);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAddSlide = () => {
    const newSlide: KaihSlideConfig = {
      id: `slide-${Date.now()}`,
      order: (landingConfig.slides?.length || 0) + 1,
      title: 'Kegiatan Siswa 7 KAIH Baru',
      habit: 'Kebiasaan Baru',
      image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1400&q=80',
      quote: 'Karakter hebat terwujud dari kebiasaan baik setiap hari.',
    };
    setLandingConfig({
      ...landingConfig,
      slides: [...(landingConfig.slides || []), newSlide],
    });
  };

  const handleUpdateSlide = (idx: number, field: keyof KaihSlideConfig, value: any) => {
    const updated = [...(landingConfig.slides || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setLandingConfig({ ...landingConfig, slides: updated });
  };

  const handleMoveSlide = (idx: number, direction: 'up' | 'down') => {
    const list = [...(landingConfig.slides || [])];
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[idx];
    list[idx] = list[targetIdx];
    list[targetIdx] = temp;

    // re-assign order
    list.forEach((s, i) => {
      s.order = i + 1;
    });

    setLandingConfig({ ...landingConfig, slides: list });
  };

  const handleDeleteSlide = (idx: number) => {
    if (confirm('Hapus slide ini dari landing page?')) {
      const list = [...(landingConfig.slides || [])].filter((_, i) => i !== idx);
      list.forEach((s, i) => {
        s.order = i + 1;
      });
      setLandingConfig({ ...landingConfig, slides: list });
    }
  };

  // ================= SINGLE ACCOUNT PROVISIONING =================
  const provisionSingleAccount = async (params: {
    email: string;
    password: string;
    fullName: string;
    role: 'siswa' | 'guru' | 'kepsek' | 'yayasan' | 'admin';
    teacherClasses?: string[];
    teacherSubjects?: string;
    teacherPosition?: string;
    studentJenjang?: string;
    studentKelas?: string;
    studentJurusan?: string;
    studentNisn?: string;
  }) => {
    const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await tempSupabase.auth.signUp({
      email: params.email.trim(),
      password: params.password,
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('Gagal membuat user di sistem autentikasi.');

    const userId = authData.user.id;

    // 1. Upsert into public.users
    const { error: userError } = await supabase.from('users').upsert({
      id: userId,
      email: params.email.trim(),
      role: params.role,
      is_active: true,
    });
    if (userError) throw userError;

    // 2. Upsert into public.user_profiles
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          user_id: userId,
          full_name: params.fullName.trim(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single();

    if (profileError) throw profileError;

    // 3. Role-specific table provisioning
    if (params.role === 'guru' && profileData) {
      const assignedClasses = params.teacherClasses || [];
      await supabase.from('teachers').upsert(
        {
          profile_id: profileData.id,
          subjects: params.teacherSubjects || null,
          position: params.teacherPosition || 'Guru / Wali Kelas',
          certifications: JSON.stringify({
            assigned_classes: assignedClasses,
            updated_at: new Date().toISOString(),
          }),
        },
        { onConflict: 'profile_id' }
      );
    } else if (params.role === 'siswa' && profileData) {
      const eduLevel = params.studentJenjang?.includes('SMP') ? 'SMP' : 'SMA';
      const notesPayload = {
        jenjang: params.studentJenjang || 'SMK Budi Utomo',
        kelas: params.studentKelas || 'XI Bisnis Digital',
        jurusan: params.studentJurusan || 'Bisnis Digital',
      };
      await supabase.from('students').upsert(
        {
          profile_id: profileData.id,
          nisn: params.studentNisn ? params.studentNisn.trim() : null,
          education_level: eduLevel,
          notes: JSON.stringify(notesPayload),
        },
        { onConflict: 'profile_id' }
      );
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const finalTeacherClasses = newTeacherAllClasses ? ['SEMUA_KELAS'] : newTeacherClasses;
      if (newRole === 'guru' && finalTeacherClasses.length === 0) {
        alert('Pilih minimal 1 kelas yang diajar oleh Guru ini (atau centang "Semua Kelas").');
        setCreating(false);
        return;
      }

      await provisionSingleAccount({
        email: newEmail,
        password: newPassword,
        fullName: newFullName,
        role: newRole,
        teacherClasses: finalTeacherClasses,
        teacherSubjects: newTeacherSubjects,
        teacherPosition: newTeacherPosition,
        studentJenjang: newStudentJenjang,
        studentKelas: newStudentKelas,
        studentJurusan: newStudentJurusan,
        studentNisn: newStudentNisn,
      });

      setShowAddModal(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewTeacherClasses([]);
      setNewTeacherAllClasses(false);
      setNewTeacherSubjects('');
      setNewStudentNisn('');
      await fetchAllData();
      showToast(`Akun ${newFullName} (${newRole.toUpperCase()}) berhasil dibuat!`);
    } catch (error: any) {
      alert('Gagal membuat pengguna: ' + error.message);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (u: any) => {
    const profileObj = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles;
    const profileId = profileObj?.id;
    setEditingUser({ ...u, profileId, profileObj });
    setEditFullName(profileObj?.full_name || '');
    setEditRole(u.role);

    if (u.role === 'guru' && profileId) {
      const tRow = teachersMap[profileId];
      const classes = parseTeacherClasses(tRow);
      if (classes.includes('SEMUA_KELAS')) {
        setEditTeacherAllClasses(true);
        setEditTeacherClasses([]);
      } else {
        setEditTeacherAllClasses(false);
        setEditTeacherClasses(classes);
      }
      setEditTeacherSubjects(tRow?.subjects || '');
      setEditTeacherPosition(tRow?.position || 'Guru / Wali Kelas');
    } else {
      setEditTeacherAllClasses(false);
      setEditTeacherClasses([]);
      setEditTeacherSubjects('');
      setEditTeacherPosition('Guru / Wali Kelas');
    }

    if (u.role === 'siswa' && profileId) {
      const sRow = studentsMap[profileId];
      const notes = parseStudentNotes(sRow);
      setEditStudentJenjang(notes.jenjang || masterData.jenjang[0] || 'SMK Budi Utomo');
      setEditStudentKelas(notes.kelas || masterData.kelas[0] || 'XI Bisnis Digital');
      setEditStudentJurusan(notes.jurusan || masterData.jurusan[0] || 'Bisnis Digital');
      setEditStudentNisn(sRow?.nisn || '');
    } else {
      setEditStudentJenjang(masterData.jenjang[0] || 'SMK Budi Utomo');
      setEditStudentKelas(masterData.kelas[0] || 'XI Bisnis Digital');
      setEditStudentJurusan(masterData.jurusan[0] || 'Bisnis Digital');
      setEditStudentNisn('');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);

    try {
      const { error: uErr } = await supabase
        .from('users')
        .update({ role: editRole })
        .eq('id', editingUser.id);
      if (uErr) throw uErr;

      let profileId = editingUser.profileId;
      if (profileId) {
        await supabase
          .from('user_profiles')
          .update({ full_name: editFullName.trim() })
          .eq('id', profileId);
      } else {
        const { data: newProf } = await supabase
          .from('user_profiles')
          .insert({ user_id: editingUser.id, full_name: editFullName.trim() })
          .select()
          .single();
        profileId = newProf?.id;
      }

      if (editRole === 'guru' && profileId) {
        const finalClasses = editTeacherAllClasses ? ['SEMUA_KELAS'] : editTeacherClasses;
        const existingTeacher = teachersMap[profileId];
        const payload = {
          profile_id: profileId,
          subjects: editTeacherSubjects || null,
          position: editTeacherPosition || 'Guru / Wali Kelas',
          certifications: JSON.stringify({
            assigned_classes: finalClasses,
            updated_at: new Date().toISOString(),
          }),
        };
        if (existingTeacher?.id) {
          await supabase.from('teachers').update(payload).eq('id', existingTeacher.id);
        } else {
          await supabase.from('teachers').insert(payload);
        }
      } else if (editRole === 'siswa' && profileId) {
        const existingStudent = studentsMap[profileId];
        const existingNotes = parseStudentNotes(existingStudent);
        const updatedNotes = {
          ...existingNotes,
          jenjang: editStudentJenjang,
          kelas: editStudentKelas,
          jurusan: editStudentJurusan,
        };
        const eduLevel = editStudentJenjang.includes('SMP') ? 'SMP' : 'SMA';
        if (existingStudent?.id) {
          await supabase
            .from('students')
            .update({
              nisn: editStudentNisn ? editStudentNisn.trim() : existingStudent.nisn,
              education_level: eduLevel,
              notes: JSON.stringify(updatedNotes),
            })
            .eq('id', existingStudent.id);
        } else {
          await supabase.from('students').insert({
            profile_id: profileId,
            nisn: editStudentNisn ? editStudentNisn.trim() : null,
            education_level: eduLevel,
            notes: JSON.stringify(updatedNotes),
          });
        }
      }

      setEditingUser(null);
      await fetchAllData();
      showToast('Perubahan data pengguna berhasil disimpan!');
    } catch (err: any) {
      alert('Gagal menyimpan perubahan: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ================= EXCEL TEMPLATE DOWNLOAD & EXCEL FILE UPLOAD (Requirement 1) =================
  const handleDownloadExcelTemplate = () => {
    const exampleData = [
      {
        NAMA_LENGKAP: 'Budi Santoso, S.Pd',
        EMAIL: 'budi.guru@budiutomo.com',
        PASSWORD: 'password123',
        ROLE: 'guru',
        KELAS: 'XI Bisnis Digital;XI TKJ',
        JURUSAN: '',
        JENJANG: 'SMK Budi Utomo',
        MAPEL_ATAU_NISN: 'Produk Kreatif & Kewirausahaan',
      },
      {
        NAMA_LENGKAP: 'Siti Aminah, M.Pd',
        EMAIL: 'kepsek@budiutomo.com',
        PASSWORD: 'password123',
        ROLE: 'kepsek',
        KELAS: '',
        JURUSAN: '',
        JENJANG: '',
        MAPEL_ATAU_NISN: 'Kepala Sekolah SMK',
      },
      {
        NAMA_LENGKAP: 'H. Ahmad Wijaya',
        EMAIL: 'yayasan@budiutomo.com',
        PASSWORD: 'password123',
        ROLE: 'yayasan',
        KELAS: '',
        JURUSAN: '',
        JENJANG: '',
        MAPEL_ATAU_NISN: 'Ketua Yayasan',
      },
      {
        NAMA_LENGKAP: 'Andi Pratama',
        EMAIL: 'andi.siswa@budiutomo.com',
        PASSWORD: 'password123',
        ROLE: 'siswa',
        KELAS: 'XI Bisnis Digital',
        JURUSAN: 'Bisnis Digital',
        JENJANG: 'SMK Budi Utomo',
        MAPEL_ATAU_NISN: '0081234567',
      },
      {
        NAMA_LENGKAP: 'Dewi Lestari',
        EMAIL: 'dewi.siswa@budiutomo.com',
        PASSWORD: 'password123',
        ROLE: 'siswa',
        KELAS: 'Kelas VIII',
        JURUSAN: 'Umum (SMP)',
        JENJANG: 'SMP Budi Utomo',
        MAPEL_ATAU_NISN: '0097654321',
      },
    ];

    const guideData = [
      { KOLOM: 'NAMA_LENGKAP', DESKRIPSI: 'Nama lengkap beserta gelar (Wajib)', CONTOH: 'Dra. Hj. Siti Rahmah, M.Pd' },
      { KOLOM: 'EMAIL', DESKRIPSI: 'Alamat email aktif untuk login sistem (Wajib & Unik)', CONTOH: 'siti.guru@budiutomo.com' },
      { KOLOM: 'PASSWORD', DESKRIPSI: 'Kata sandi akun, minimal 6 karakter (Wajib)', CONTOH: 'guru12345' },
      { KOLOM: 'ROLE', DESKRIPSI: 'Pilihan role: guru / siswa / kepsek / yayasan / admin (Wajib)', CONTOH: 'guru' },
      { KOLOM: 'KELAS', DESKRIPSI: 'Untuk Guru: pisahkan dengan titik koma jika > 1 kelas (misal: XI TKJ;XI TSM). Untuk Siswa: isi 1 nama kelas', CONTOH: 'XI Bisnis Digital;XI TKJ' },
      { KOLOM: 'JURUSAN', DESKRIPSI: 'Jurusan siswa (misal: Bisnis Digital, TKJ, TSM, Akuntansi)', CONTOH: 'Bisnis Digital' },
      { KOLOM: 'JENJANG', DESKRIPSI: 'Unit sekolah: SMK Budi Utomo / SMP Budi Utomo / SD Budi Utomo', CONTOH: 'SMK Budi Utomo' },
      { KOLOM: 'MAPEL_ATAU_NISN', DESKRIPSI: 'Mata pelajaran yang diampu untuk Guru, ATAU Nomor NISN untuk Siswa', CONTOH: 'Matematika' },
    ];

    const wb = XLSX.utils.book_new();
    const wsData = XLSX.utils.json_to_sheet(exampleData);
    const wsGuide = XLSX.utils.json_to_sheet(guideData);

    wsData['!cols'] = [
      { wch: 25 },
      { wch: 28 },
      { wch: 15 },
      { wch: 12 },
      { wch: 30 },
      { wch: 25 },
      { wch: 20 },
      { wch: 30 },
    ];
    wsGuide['!cols'] = [
      { wch: 20 },
      { wch: 60 },
      { wch: 30 },
    ];

    XLSX.utils.book_append_sheet(wb, wsData, 'DATA_PENGGUNA');
    XLSX.utils.book_append_sheet(wb, wsGuide, 'PANDUAN_KOLOM');

    XLSX.writeFile(wb, 'Template_Impor_Akun_Aktivitasku_7KAIH.xlsx');
  };

  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (json.length === 0) {
          alert('File Excel kosong atau tidak memiliki baris data.');
          return;
        }

        const parsedRows: BulkImportRow[] = [];
        for (const row of json) {
          const full_name = String(row.NAMA_LENGKAP || row.nama_lengkap || row.Nama || row.nama || '').trim();
          const email = String(row.EMAIL || row.email || row.Email || '').trim();
          const password = String(row.PASSWORD || row.password || row.Password || '').trim();
          const roleRaw = String(row.ROLE || row.role || row.Role || 'siswa').toLowerCase().trim();
          const kelas = String(row.KELAS || row.kelas || row.Kelas || '').trim();
          const jurusan = String(row.JURUSAN || row.jurusan || row.Jurusan || '').trim();
          const jenjang = String(row.JENJANG || row.jenjang || row.Jenjang || '').trim();
          const extra = String(row.MAPEL_ATAU_NISN || row.mapel_atau_nisn || row.mapel || row.nisn || row.Extra || '').trim();

          if (!full_name || !email || !password) continue;

          const validRole: BulkImportRow['role'] = ['siswa', 'guru', 'kepsek', 'yayasan', 'admin'].includes(roleRaw)
            ? (roleRaw as BulkImportRow['role'])
            : 'siswa';

          parsedRows.push({
            full_name,
            email,
            password,
            role: validRole,
            kelas: kelas || (validRole === 'guru' ? 'SEMUA_KELAS' : 'XI Bisnis Digital'),
            jurusan: jurusan || 'Bisnis Digital',
            jenjang: jenjang || 'SMK Budi Utomo',
            extra,
            status: 'pending',
          });
        }

        if (parsedRows.length === 0) {
          alert('Tidak ditemukan baris data valid (pastikan kolom NAMA_LENGKAP, EMAIL, dan PASSWORD terisi).');
          return;
        }

        setImportRows(parsedRows);
      } catch (err: any) {
        alert('Gagal membaca file Excel: ' + (err.message || 'Format file tidak didukung'));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleRunBulkImport = async () => {
    if (importRows.length === 0) return;
    setImporting(true);
    setImportProgress({ done: 0, total: importRows.length });

    const updated = [...importRows];
    for (let i = 0; i < updated.length; i++) {
      const row = updated[i];
      if (row.status === 'success') {
        setImportProgress((p) => ({ ...p, done: i + 1 }));
        continue;
      }

      try {
        const teacherClasses =
          row.role === 'guru'
            ? row.kelas
                .split(/[;|]/)
                .map((s) => s.trim())
                .filter(Boolean)
            : [];

        await provisionSingleAccount({
          email: row.email,
          password: row.password,
          fullName: row.full_name,
          role: row.role,
          teacherClasses: teacherClasses.length > 0 ? teacherClasses : ['SEMUA_KELAS'],
          teacherSubjects: row.extra,
          teacherPosition: 'Guru / Wali Kelas',
          studentJenjang: row.jenjang,
          studentKelas: row.kelas,
          studentJurusan: row.jurusan,
          studentNisn: row.extra,
        });

        updated[i] = { ...row, status: 'success', message: 'Berhasil dibuat' };
      } catch (err: any) {
        updated[i] = { ...row, status: 'error', message: err.message || 'Gagal' };
      }
      setImportRows([...updated]);
      setImportProgress({ done: i + 1, total: updated.length });
    }

    setImporting(false);
    await fetchAllData();
    showToast('Proses impor massal akun selesai!');
  };

  const toggleClassInList = (cls: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(cls)) {
      setList(list.filter((c) => c !== cls));
    } else {
      setList([...list, cls]);
    }
  };

  const addCustomClass = (targetList: string[], setTargetList: (v: string[]) => void) => {
    const trimmed = customClassInput.trim();
    if (!trimmed) return;
    if (!targetList.includes(trimmed)) {
      setTargetList([...targetList, trimmed]);
    }
    setCustomClassInput('');
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const profileObj = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles;
      const fullName = profileObj?.full_name || '';
      const profileId = profileObj?.id;

      const matchesSearch =
        fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = selectedRole === 'all' || u.role === selectedRole;

      let matchesClass = true;
      if (selectedClassFilter !== 'all') {
        if (u.role === 'siswa' && profileId) {
          const notes = parseStudentNotes(studentsMap[profileId]);
          matchesClass = notes.kelas === selectedClassFilter;
        } else if (u.role === 'guru' && profileId) {
          const tClasses = parseTeacherClasses(teachersMap[profileId]);
          matchesClass = tClasses.includes('SEMUA_KELAS') || tClasses.includes(selectedClassFilter);
        } else {
          matchesClass = false;
        }
      }

      return matchesSearch && matchesRole && matchesClass;
    });
  }, [users, searchTerm, selectedRole, selectedClassFilter, studentsMap, teachersMap]);

  const roleCounts = useMemo(() => {
    return {
      total: users.length,
      admin: users.filter((u) => u.role === 'admin').length,
      guru: users.filter((u) => u.role === 'guru').length,
      siswa: users.filter((u) => u.role === 'siswa').length,
      kepsek: users.filter((u) => u.role === 'kepsek').length,
      yayasan: users.filter((u) => u.role === 'yayasan').length,
    };
  }, [users]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
            <Shield size={12} className="mr-1" /> Admin
          </span>
        );
      case 'guru':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 border border-teal-200">
            <BookOpen size={12} className="mr-1" /> Guru / Wali Kelas
          </span>
        );
      case 'kepsek':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Award size={12} className="mr-1" /> Kepala Sekolah
          </span>
        );
      case 'yayasan':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200">
            <Building2 size={12} className="mr-1" /> Yayasan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <GraduationCap size={12} className="mr-1" /> Siswa
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={landingConfig.logoKaihUrl || '/kaih_logo.png'} alt="7 KAIH" className="w-10 h-10 object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                  Panel Super Admin — AKTIVITASKU & 7 KAIH
                </h1>
                <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-600 text-white">
                  FULL CONTROL
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Pusat Manajemen Pengguna, Master Data Sekolah & Kustomisasi Landing Page
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LayoutDashboard size={16} />
              <span>Buka Monitoring 7 KAIH</span>
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut size={16} />
              <span>Keluar</span>
            </button>
          </div>
        </div>

        {/* Admin Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-2 border-t border-slate-100 pt-1 pb-1">
          <button
            onClick={() => setActiveMainTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'users'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Shield size={16} />
            <span>Kelola Akun & Penugasan Guru ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveMainTab('master_data')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'master_data'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers size={16} />
            <span>Master Data Sekolah (Jenjang, Kelas, Jurusan, Agama, Suku)</span>
          </button>

          <button
            onClick={() => setActiveMainTab('landing_page')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
              activeMainTab === 'landing_page'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Palette size={16} />
            <span>Pengaturan Landing Page (Gambar, Teks & Logo)</span>
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 size={18} />
          <span className="text-xs sm:text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
        {/* ================= TAB 1: USERS MANAGEMENT ================= */}
        {activeMainTab === 'users' && (
          <>
            {/* Summary Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
                <p className="text-xs font-semibold text-slate-500">Total Akun</p>
                <p className="text-2xl font-extrabold text-slate-900 mt-1">{roleCounts.total}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-teal-200 bg-gradient-to-br from-white to-teal-50/40 shadow-xs">
                <p className="text-xs font-semibold text-teal-700">Guru / Wali Kelas</p>
                <p className="text-2xl font-extrabold text-teal-900 mt-1">{roleCounts.guru}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-gradient-to-br from-white to-blue-50/40 shadow-xs">
                <p className="text-xs font-semibold text-blue-700">Siswa Terdaftar</p>
                <p className="text-2xl font-extrabold text-blue-900 mt-1">{roleCounts.siswa}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/40 shadow-xs">
                <p className="text-xs font-semibold text-amber-700">Kepala Sekolah</p>
                <p className="text-2xl font-extrabold text-amber-900 mt-1">{roleCounts.kepsek}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-white to-fuchsia-50/40 shadow-xs">
                <p className="text-xs font-semibold text-fuchsia-700">Yayasan</p>
                <p className="text-2xl font-extrabold text-fuchsia-900 mt-1">{roleCounts.yayasan}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50/40 shadow-xs">
                <p className="text-xs font-semibold text-purple-700">Administrator</p>
                <p className="text-2xl font-extrabold text-purple-900 mt-1">{roleCounts.admin}</p>
              </div>
            </div>

            {/* Action & Filter Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row gap-3 justify-between items-stretch lg:items-center">
              <div className="flex flex-1 flex-wrap gap-2.5 items-center">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari nama pengguna atau email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-full border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="border border-slate-300 rounded-xl px-3.5 py-2 text-sm bg-white font-medium text-slate-700 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Semua Role ({roleCounts.total})</option>
                  <option value="guru">Guru ({roleCounts.guru})</option>
                  <option value="siswa">Siswa ({roleCounts.siswa})</option>
                  <option value="kepsek">Kepala Sekolah ({roleCounts.kepsek})</option>
                  <option value="yayasan">Yayasan ({roleCounts.yayasan})</option>
                  <option value="admin">Admin ({roleCounts.admin})</option>
                </select>

                <div className="flex items-center gap-1.5 border border-slate-300 rounded-xl px-3 py-2 bg-white">
                  <Filter className="w-4 h-4 text-slate-400" />
                  <select
                    value={selectedClassFilter}
                    onChange={(e) => setSelectedClassFilter(e.target.value)}
                    className="text-sm bg-transparent font-medium text-slate-700 focus:outline-none"
                  >
                    <option value="all">Semua Kelas</option>
                    {allAvailableClasses.map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={16} />
                  <span>Impor Massal (Excel .xlsx)</span>
                </button>

                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer"
                >
                  <UserPlus size={16} />
                  <span>Tambah Akun Baru</span>
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Pengguna & Email
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Role Akses
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Kelas Ajar (Guru) / Rombel & Jurusan (Siswa)
                      </th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Status Akun
                      </th>
                      <th className="px-5 py-3.5 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Aksi Kontrol Admin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                          Memuat data seluruh pengguna...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-500">
                          Tidak ada pengguna yang sesuai dengan filter pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const profileObj = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles;
                        const fullName = profileObj?.full_name || 'Tanpa Nama';
                        const profileId = profileObj?.id;

                        const teacherRow = profileId ? teachersMap[profileId] : null;
                        const teacherClasses = parseTeacherClasses(teacherRow);
                        const studentRow = profileId ? studentsMap[profileId] : null;
                        const studentNotes = parseStudentNotes(studentRow);

                        return (
                          <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                                  {profileObj?.photo_url ? (
                                    <img src={profileObj.photo_url} alt={fullName} className="w-full h-full object-cover" />
                                  ) : (
                                    fullName.charAt(0).toUpperCase()
                                  )}
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-slate-900">{fullName}</div>
                                  <div className="text-xs text-slate-500">{u.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">{getRoleBadge(u.role)}</td>

                            <td className="px-5 py-4">
                              {u.role === 'guru' ? (
                                <div className="space-y-1">
                                  {teacherClasses.length === 0 ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                      Belum diatur kelas ajarnya (Klik Atur Kelas)
                                    </span>
                                  ) : teacherClasses.includes('SEMUA_KELAS') ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Semua Kelas (Akses Penuh Seluruh Kelas)
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {teacherClasses.map((cls) => (
                                        <span
                                          key={cls}
                                          className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-teal-50 text-teal-800 border border-teal-200"
                                        >
                                          {cls}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                  {teacherRow?.subjects && (
                                    <div className="text-[11px] text-slate-500">
                                      Mapel: <span className="font-semibold text-slate-700">{teacherRow.subjects}</span>
                                    </div>
                                  )}
                                </div>
                              ) : u.role === 'siswa' ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                                      {studentNotes.kelas || 'Belum pilih kelas'}
                                    </span>
                                    {studentNotes.jurusan && (
                                      <span className="text-xs font-medium text-slate-600">• {studentNotes.jurusan}</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400">
                                    {studentNotes.jenjang || 'SMK/SMP Budi Utomo'}
                                    {studentRow?.nisn ? ` • NISN: ${studentRow.nisn}` : ''}
                                  </div>
                                </div>
                              ) : u.role === 'kepsek' ? (
                                <span className="text-xs font-semibold text-slate-600">
                                  Monitoring Akademik Seluruh Kelas
                                </span>
                              ) : u.role === 'yayasan' ? (
                                <span className="text-xs font-semibold text-slate-600">
                                  Executive Monitoring Yayasan
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-purple-700">
                                  Kontrol Penuh Seluruh Sistem
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap">
                              {u.is_active ? (
                                <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                                  <CheckCircle size={13} className="mr-1" /> Aktif
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-full border border-red-200">
                                  <XCircle size={13} className="mr-1" /> Nonaktif
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4 whitespace-nowrap text-right text-xs font-medium space-x-2">
                              <button
                                onClick={() => openEditModal(u)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                              >
                                <Edit3 size={13} />
                                <span>{u.role === 'guru' ? 'Atur Kelas / Edit' : 'Edit Data'}</span>
                              </button>

                              <button
                                onClick={() => toggleUserStatus(u.id, u.is_active)}
                                className={`inline-flex items-center px-3 py-1.5 rounded-lg font-bold border transition-colors cursor-pointer ${
                                  u.is_active
                                    ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200'
                                    : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                                }`}
                              >
                                {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================= TAB 2: MASTER DATA MANAGEMENT (Requirement 2) ================= */}
        {activeMainTab === 'master_data' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Master Data Terpadu Sekolah
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seluruh data pilihan di bawah ini akan seragam digunakan pada menu pendaftaran, dropdown profil Guru & Siswa, serta filter kelas.
                </p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSaveMasterData}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{savingConfig ? 'Menyimpan...' : 'Simpan Perubahan Master Data'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. KELAS / ROMBEL */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Daftar Kelas / Rombel</h3>
                    <p className="text-[11px] text-slate-500">Kelas untuk penugasan guru & siswa</p>
                  </div>
                  <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    {masterData.kelas.length} Kelas
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {masterData.kelas.map((cls) => (
                    <span
                      key={cls}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200"
                    >
                      <span>{cls}</span>
                      <button
                        type="button"
                        onClick={() => removeMasterItem('kelas', cls)}
                        className="text-teal-400 hover:text-red-600 cursor-pointer"
                        title="Hapus Kelas"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newKelasInput}
                    onChange={(e) => setNewKelasInput(e.target.value)}
                    placeholder="Tambah nama kelas baru (misal: XII RPL 1)..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMasterItem('kelas', newKelasInput, setNewKelasInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMasterItem('kelas', newKelasInput, setNewKelasInput)}
                    className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* 2. JURUSAN / KOMPETENSI KEAHLIAN */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Daftar Jurusan / Kompetensi</h3>
                    <p className="text-[11px] text-slate-500">Pilihan program keahlian siswa</p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
                    {masterData.jurusan.length} Jurusan
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {masterData.jurusan.map((jur) => (
                    <span
                      key={jur}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200"
                    >
                      <span>{jur}</span>
                      <button
                        type="button"
                        onClick={() => removeMasterItem('jurusan', jur)}
                        className="text-blue-400 hover:text-red-600 cursor-pointer"
                        title="Hapus Jurusan"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newJurusanInput}
                    onChange={(e) => setNewJurusanInput(e.target.value)}
                    placeholder="Tambah jurusan baru (misal: Desain Komunikasi Visual)..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMasterItem('jurusan', newJurusanInput, setNewJurusanInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMasterItem('jurusan', newJurusanInput, setNewJurusanInput)}
                    className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* 3. JENJANG / UNIT SEKOLAH */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Jenjang / Unit Pendidikan</h3>
                    <p className="text-[11px] text-slate-500">Unit di lingkungan Perguruan Budi Utomo</p>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                    {masterData.jenjang.length} Jenjang
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {masterData.jenjang.map((j) => (
                    <span
                      key={j}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200"
                    >
                      <span>{j}</span>
                      <button
                        type="button"
                        onClick={() => removeMasterItem('jenjang', j)}
                        className="text-purple-400 hover:text-red-600 cursor-pointer"
                        title="Hapus Jenjang"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newJenjangInput}
                    onChange={(e) => setNewJenjangInput(e.target.value)}
                    placeholder="Tambah unit jenjang (misal: TK Budi Utomo)..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMasterItem('jenjang', newJenjangInput, setNewJenjangInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMasterItem('jenjang', newJenjangInput, setNewJenjangInput)}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* 4. AGAMA */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Pilihan Agama</h3>
                    <p className="text-[11px] text-slate-500">Standar pengisian biodata siswa & guru</p>
                  </div>
                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                    {masterData.agama.length} Agama
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {masterData.agama.map((ag) => (
                    <span
                      key={ag}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200"
                    >
                      <span>{ag}</span>
                      <button
                        type="button"
                        onClick={() => removeMasterItem('agama', ag)}
                        className="text-amber-400 hover:text-red-600 cursor-pointer"
                        title="Hapus Agama"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newAgamaInput}
                    onChange={(e) => setNewAgamaInput(e.target.value)}
                    placeholder="Tambah pilihan agama..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMasterItem('agama', newAgamaInput, setNewAgamaInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMasterItem('agama', newAgamaInput, setNewAgamaInput)}
                    className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
                  >
                    + Tambah
                  </button>
                </div>
              </div>

              {/* 5. SUKU / ETNIS */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3.5 lg:col-span-2">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Daftar Suku / Etnis Siswa</h3>
                    <p className="text-[11px] text-slate-500">Standar isian suku pada biodata siswa & pencetakan resmi PDF</p>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    {masterData.suku.length} Suku
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 max-h-56 overflow-y-auto p-1">
                  {masterData.suku.map((sk) => (
                    <span
                      key={sk}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    >
                      <span>{sk}</span>
                      <button
                        type="button"
                        onClick={() => removeMasterItem('suku', sk)}
                        className="text-emerald-400 hover:text-red-600 cursor-pointer"
                        title="Hapus Suku"
                      >
                        <X size={13} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100 max-w-md">
                  <input
                    type="text"
                    value={newSukuInput}
                    onChange={(e) => setNewSukuInput(e.target.value)}
                    placeholder="Tambah nama suku baru..."
                    className="flex-1 border border-slate-300 rounded-xl px-3 py-2 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addMasterItem('suku', newSukuInput, setNewSukuInput);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addMasterItem('suku', newSukuInput, setNewSukuInput)}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                  >
                    + Tambah Suku
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 3: LANDING PAGE CUSTOMIZATION (Requirement 3) ================= */}
        {activeMainTab === 'landing_page' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                  Pengaturan Tampilan Landing Page
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Atur urutan foto *background* 7 KAIH, kalimat kutipan, teks sambutan, serta logo 7 KAIH & Yayasan secara langsung.
                </p>
              </div>
              <button
                type="button"
                disabled={savingConfig}
                onClick={handleSaveLandingPage}
                className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-colors cursor-pointer disabled:opacity-50"
              >
                <Save size={16} />
                <span>{savingConfig ? 'Menyimpan...' : 'Simpan & Terapkan ke Landing Page'}</span>
              </button>
            </div>

            {/* Logo Settings */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                1. Logo Aplikasi & Yayasan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Logo 7 KAIH (Gerakan Tujuh Kebiasaan Anak Indonesia Hebat)
                  </label>
                  <div className="flex items-center gap-3">
                    <img
                      src={landingConfig.logoKaihUrl || '/kaih_logo.png'}
                      alt="Logo 7 KAIH"
                      className="w-12 h-12 rounded-xl object-contain border bg-slate-50 p-1 shrink-0"
                    />
                    <input
                      type="text"
                      value={landingConfig.logoKaihUrl}
                      onChange={(e) => setLandingConfig({ ...landingConfig, logoKaihUrl: e.target.value })}
                      placeholder="/kaih_logo.png"
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    URL Logo Yayasan Pendidikan Budi Utomo
                  </label>
                  <div className="flex items-center gap-3">
                    {landingConfig.logoYaspenUrl ? (
                      <img
                        src={landingConfig.logoYaspenUrl}
                        alt="Logo Yayasan"
                        className="w-12 h-12 rounded-xl object-contain border bg-slate-50 p-1 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        YASPEN
                      </div>
                    )}
                    <input
                      type="text"
                      value={landingConfig.logoYaspenUrl}
                      onChange={(e) => setLandingConfig({ ...landingConfig, logoYaspenUrl: e.target.value })}
                      placeholder="Masukkan URL foto/logo Yayasan..."
                      className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Main Texts Settings */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                2. Teks Utama Sambutan & Fitur
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Judul Sambutan</label>
                  <input
                    type="text"
                    value={landingConfig.heroTitle}
                    onChange={(e) => setLandingConfig({ ...landingConfig, heroTitle: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Sub-Deskripsi Sistem</label>
                  <textarea
                    rows={2}
                    value={landingConfig.heroSubtitle}
                    onChange={(e) => setLandingConfig({ ...landingConfig, heroSubtitle: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teks Fitur 1</label>
                    <input
                      type="text"
                      value={landingConfig.feature1}
                      onChange={(e) => setLandingConfig({ ...landingConfig, feature1: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teks Fitur 2</label>
                    <input
                      type="text"
                      value={landingConfig.feature2}
                      onChange={(e) => setLandingConfig({ ...landingConfig, feature2: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teks Fitur 3</label>
                    <input
                      type="text"
                      value={landingConfig.feature3}
                      onChange={(e) => setLandingConfig({ ...landingConfig, feature3: e.target.value })}
                      className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Background Slides List & Ordering (Requirement 3) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    3. Daftar Gambar Background & Urutan Tampilan (Slide 1, 2, 3...)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Foto-foto ini akan berputar otomatis secara berurutan di latar belakang halaman masuk.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSlide}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 text-xs font-bold cursor-pointer"
                >
                  <Plus size={14} /> + Tambah Slide Foto
                </button>
              </div>

              <div className="space-y-4">
                {(landingConfig.slides || []).map((slide, idx) => (
                  <div
                    key={slide.id || idx}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors flex flex-col md:flex-row gap-4 items-start"
                  >
                    <div className="relative w-full md:w-44 h-28 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-200">
                      <img src={slide.image} alt={slide.title} className="w-full h-full object-cover" />
                      <div className="absolute top-1.5 left-1.5 bg-slate-900/80 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md">
                        Urutan #{idx + 1}
                      </div>
                    </div>

                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          URL Gambar Background
                        </label>
                        <input
                          type="text"
                          value={slide.image}
                          onChange={(e) => handleUpdateSlide(idx, 'image', e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          Tag Kebiasaan (Pill Hijau)
                        </label>
                        <input
                          type="text"
                          value={slide.habit}
                          onChange={(e) => handleUpdateSlide(idx, 'habit', e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                          placeholder="Kebiasaan 1: Bangun Pagi"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          Judul Kegiatan
                        </label>
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => handleUpdateSlide(idx, 'title', e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                          Kalimat Kutipan / Quote
                        </label>
                        <input
                          type="text"
                          value={slide.quote}
                          onChange={(e) => handleUpdateSlide(idx, 'quote', e.target.value)}
                          className="w-full border border-slate-300 rounded-xl px-3 py-1.5 text-xs bg-white italic"
                        />
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-1.5 shrink-0 self-center md:self-start">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMoveSlide(idx, 'up')}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Geser Naik"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        disabled={idx === (landingConfig.slides?.length || 1) - 1}
                        onClick={() => handleMoveSlide(idx, 'down')}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Geser Turun"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(idx)}
                        className="p-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                        title="Hapus Slide"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: TAMBAH AKUN BARU (SATU PER SATU) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Buat Akun Pengguna Baru</h2>
                  <p className="text-xs text-slate-500">
                    Hanya Admin yang dapat menerbitkan akun Guru, Siswa, Kepala Sekolah, & Yayasan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Pilih Role / Jabatan Akun <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'guru', label: 'Guru / Wali' },
                    { id: 'siswa', label: 'Siswa' },
                    { id: 'kepsek', label: 'Kepsek' },
                    { id: 'yayasan', label: 'Yayasan' },
                    { id: 'admin', label: 'Admin' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setNewRole(r.id as any)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        newRole === r.id
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap & Gelar <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder={newRole === 'guru' ? 'Contoh: Dra. Hj. Siti Rahmah, M.Pd' : 'Nama Lengkap'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Login <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="nama@budiutomo.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Password Awal <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="Minimal 6 karakter"
                  />
                </div>
              </div>

              {/* Dynamic Fields for GURU */}
              {newRole === 'guru' && (
                <div className="p-4 rounded-2xl bg-teal-50/60 border border-teal-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-teal-900 uppercase tracking-wider">
                      Pengaturan Kelas yang Diajar Guru
                    </h3>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newTeacherAllClasses}
                        onChange={(e) => setNewTeacherAllClasses(e.target.checked)}
                        className="rounded text-teal-600 focus:ring-teal-500"
                      />
                      <span>Akses Semua Kelas</span>
                    </label>
                  </div>

                  {!newTeacherAllClasses && (
                    <>
                      <p className="text-[11px] text-teal-700">
                        Centang kelas yang diajar oleh guru ini (data diambil dari Master Data Kelas):
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1">
                        {allAvailableClasses.map((cls) => {
                          const checked = newTeacherClasses.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => toggleClassInList(cls, newTeacherClasses, setNewTeacherClasses)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                                checked
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
                              }`}
                            >
                              {checked ? <CheckSquare size={14} className="shrink-0" /> : <Square size={14} className="shrink-0 text-slate-400" />}
                              <span className="truncate">{cls}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customClassInput}
                          onChange={(e) => setCustomClassInput(e.target.value)}
                          placeholder="Tambah nama kelas lain..."
                          className="flex-1 border border-teal-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomClass(newTeacherClasses, setNewTeacherClasses)}
                          className="px-3 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> Tambah
                        </button>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-teal-900 mb-1">Mata Pelajaran Diampu</label>
                      <input
                        type="text"
                        value={newTeacherSubjects}
                        onChange={(e) => setNewTeacherSubjects(e.target.value)}
                        placeholder="Misal: Matematika / Produktif TKJ"
                        className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-teal-900 mb-1">Jabatan Guru</label>
                      <input
                        type="text"
                        value={newTeacherPosition}
                        onChange={(e) => setNewTeacherPosition(e.target.value)}
                        placeholder="Wali Kelas / Guru Mapel"
                        className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Dynamic Fields for SISWA */}
              {newRole === 'siswa' && (
                <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-3">
                  <h3 className="text-xs font-extrabold text-blue-900 uppercase tracking-wider">
                    Penempatan Kelas & Jurusan Siswa
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Unit / Jenjang Sekolah</label>
                      <select
                        value={newStudentJenjang}
                        onChange={(e) => setNewStudentJenjang(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {masterData.jenjang.map((j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Kelas / Rombel</label>
                      <select
                        value={newStudentKelas}
                        onChange={(e) => setNewStudentKelas(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {allAvailableClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Jurusan / Kompetensi</label>
                      <select
                        value={newStudentJurusan}
                        onChange={(e) => setNewStudentJurusan(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {masterData.jurusan.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">NISN / NIS (Opsional)</label>
                      <input
                        type="text"
                        value={newStudentNisn}
                        onChange={(e) => setNewStudentNisn(e.target.value)}
                        placeholder="Nomor Induk Siswa"
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {creating ? 'Menyimpan Akun...' : 'Simpan & Aktifkan Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT PENGGUNA & ATUR KELAS GURU / SISWA */}
      {editingUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">
                  Edit Data & Hak Kelas Pengguna
                </h2>
                <p className="text-xs text-slate-500">{editingUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFullName}
                    onChange={(e) => setEditFullName(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role Sistem</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm bg-white font-semibold"
                  >
                    <option value="guru">Guru / Wali Kelas</option>
                    <option value="siswa">Siswa</option>
                    <option value="kepsek">Kepala Sekolah</option>
                    <option value="yayasan">Yayasan</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              {editRole === 'guru' && (
                <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-teal-900 uppercase">
                      Kelas yang Diajar Guru Ini
                    </h3>
                    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editTeacherAllClasses}
                        onChange={(e) => setEditTeacherAllClasses(e.target.checked)}
                        className="rounded text-teal-600"
                      />
                      <span>Akses Semua Kelas</span>
                    </label>
                  </div>

                  {!editTeacherAllClasses && (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
                        {allAvailableClasses.map((cls) => {
                          const checked = editTeacherClasses.includes(cls);
                          return (
                            <button
                              key={cls}
                              type="button"
                              onClick={() => toggleClassInList(cls, editTeacherClasses, setEditTeacherClasses)}
                              className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                                checked
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-teal-50'
                              }`}
                            >
                              {checked ? <CheckSquare size={14} className="shrink-0" /> : <Square size={14} className="shrink-0 text-slate-400" />}
                              <span className="truncate">{cls}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customClassInput}
                          onChange={(e) => setCustomClassInput(e.target.value)}
                          placeholder="Tambah kelas baru..."
                          className="flex-1 border border-teal-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomClass(editTeacherClasses, setEditTeacherClasses)}
                          className="px-3 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-bold cursor-pointer"
                        >
                          + Kelas
                        </button>
                      </div>
                    </>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-teal-900 mb-1">Mata Pelajaran</label>
                      <input
                        type="text"
                        value={editTeacherSubjects}
                        onChange={(e) => setEditTeacherSubjects(e.target.value)}
                        className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-teal-900 mb-1">Jabatan</label>
                      <input
                        type="text"
                        value={editTeacherPosition}
                        onChange={(e) => setEditTeacherPosition(e.target.value)}
                        className="w-full border border-teal-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {editRole === 'siswa' && (
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-3">
                  <h3 className="text-xs font-extrabold text-blue-900 uppercase">
                    Data Kelas & Jurusan Siswa
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Jenjang</label>
                      <select
                        value={editStudentJenjang}
                        onChange={(e) => setEditStudentJenjang(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {masterData.jenjang.map((j) => (
                          <option key={j} value={j}>
                            {j}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Kelas</label>
                      <select
                        value={editStudentKelas}
                        onChange={(e) => setEditStudentKelas(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {allAvailableClasses.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">Jurusan</label>
                      <select
                        value={editStudentJurusan}
                        onChange={(e) => setEditStudentJurusan(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white font-semibold"
                      >
                        {masterData.jurusan.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-blue-900 mb-1">NISN</label>
                      <input
                        type="text"
                        value={editStudentNisn}
                        onChange={(e) => setEditStudentNisn(e.target.value)}
                        className="w-full border border-blue-300 rounded-xl px-3 py-2 text-xs bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: IMPOR MASSAL EXCEL (.XLSX) (Requirement 1) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center">
                  <FileSpreadsheet size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">
                    Impor Massal Akun Pengguna (Microsoft Excel .xlsx)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Impor puluhan hingga ratusan akun Guru, Siswa, Kepala Sekolah, & Yayasan sekaligus dengan file Excel
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">Langkah 1: Unduh Template Resmi Excel (.xlsx)</p>
                  <p>
                    Template Excel sudah dilengkapi contoh data dan lembar kedua <code className="bg-slate-200 px-1 rounded font-bold">PANDUAN_KOLOM</code>.
                    Untuk Guru mengajar multi-kelas, gunakan tanda titik koma <code className="bg-slate-200 px-1 rounded">;</code> (contoh: <code className="bg-slate-200 px-1 rounded">XI Bisnis Digital;XI TKJ</code>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0 cursor-pointer shadow-sm"
                >
                  <Download size={15} />
                  <span>Unduh Template Excel (.xlsx)</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-emerald-400 transition-colors text-center">
                <label className="cursor-pointer block">
                  <FileSpreadsheet className="w-9 h-9 text-emerald-600 mx-auto mb-2" />
                  <span className="text-sm font-bold text-slate-800 block">
                    Klik untuk Memilih File Excel (.xlsx / .xls) dari Komputer Anda
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    Mendukung berkas Microsoft Excel (.xlsx, .xls) serta CSV
                  </span>
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    onChange={handleExcelFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {importRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase">
                      Pratinjau Data Siap Impor ({importRows.length} Baris Terbaca dari Excel)
                    </h4>
                    {importing && (
                      <span className="text-xs font-bold text-emerald-600">
                        Memproses {importProgress.done} / {importProgress.total}...
                      </span>
                    )}
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="min-w-full divide-y divide-slate-200 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Nama</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Email</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Role</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Kelas</th>
                          <th className="px-3 py-2 text-left font-bold text-slate-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {importRows.map((r, i) => (
                          <tr key={i}>
                            <td className="px-3 py-2 font-semibold text-slate-800">{r.full_name}</td>
                            <td className="px-3 py-2 text-slate-600">{r.email}</td>
                            <td className="px-3 py-2 uppercase font-bold text-slate-700">{r.role}</td>
                            <td className="px-3 py-2 text-slate-600">{r.kelas}</td>
                            <td className="px-3 py-2">
                              {r.status === 'pending' && (
                                <span className="text-slate-400 font-semibold">Siap Impor</span>
                              )}
                              {r.status === 'success' && (
                                <span className="text-emerald-600 font-bold">✓ Berhasil</span>
                              )}
                              {r.status === 'error' && (
                                <span className="text-red-600 font-bold" title={r.message}>
                                  ✕ {r.message}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowImportModal(false);
                    setImportRows([]);
                  }}
                  className="px-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={importing || importRows.length === 0}
                  onClick={handleRunBulkImport}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {importing ? 'Sedang Mengimpor...' : `Proses Impor (${importRows.length} Akun)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
