import React, { useEffect, useState, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
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
  Upload,
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
} from 'lucide-react';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://zshxtebkopkvhdthavhb.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_BWHkngZK_Qym3GwhsJfTYQ___iWtw-n';

// Default school classes & majors in Perguruan Budi Utomo
const DEFAULT_CLASSES = [
  'Kelas VII',
  'Kelas VIII',
  'Kelas IX',
  'X RPL 1',
  'XI Bisnis Digital',
  'XI Manajemen Perkantoran',
  'XI TSM',
  'XI Akuntansi',
  'XI TKJ',
  'XII Bisnis Digital',
  'XII Manajemen Perkantoran',
  'XII TSM',
  'XII Akuntansi',
  'XII TKJ',
];

const DEFAULT_MAJORS = [
  'Umum (SMP)',
  'Bisnis Digital',
  'Manajemen Perkantoran',
  'Teknik Sepeda Motor (TSM)',
  'Akuntansi',
  'Teknik Komputer dan Jaringan (TKJ)',
  'Rekayasa Perangkat Lunak',
];

const DEFAULT_JENJANG = ['SMK Budi Utomo', 'SMP Budi Utomo'];

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
    // Fallback if plain text comma-separated
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
  kelas: string; // For guru: pipe or semicolon separated e.g. "XI Bisnis Digital;XI TKJ"
  jurusan: string;
  jenjang: string;
  extra: string; // Mapel for guru OR NISN for siswa
  status?: 'pending' | 'success' | 'error';
  message?: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
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
  }, []);

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

  // Combine default classes with any custom classes found in database
  const allAvailableClasses = useMemo(() => {
    const set = new Set<string>(DEFAULT_CLASSES);
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
  }, [studentsMap, teachersMap]);

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
      alert(`Akun ${newFullName} (${newRole.toUpperCase()}) berhasil dibuat!`);
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
      setEditStudentJenjang(notes.jenjang || 'SMK Budi Utomo');
      setEditStudentKelas(notes.kelas || 'XI Bisnis Digital');
      setEditStudentJurusan(notes.jurusan || 'Bisnis Digital');
      setEditStudentNisn(sRow?.nisn || '');
    } else {
      setEditStudentJenjang('SMK Budi Utomo');
      setEditStudentKelas('XI Bisnis Digital');
      setEditStudentJurusan('Bisnis Digital');
      setEditStudentNisn('');
    }
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);

    try {
      // 1. Update role in users
      const { error: uErr } = await supabase
        .from('users')
        .update({ role: editRole })
        .eq('id', editingUser.id);
      if (uErr) throw uErr;

      // 2. Ensure/update user_profiles
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

      // 3. Update teacher or student data
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
    } catch (err: any) {
      alert('Gagal menyimpan perubahan: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // CSV Template Download & Parser
  const handleDownloadCsvTemplate = () => {
    const csvContent = [
      'nama_lengkap,email,password,role,kelas,jurusan,jenjang,mapel_atau_nisn',
      '"Budi Santoso, S.Pd",budi.guru@budiutomo.com,guru12345,guru,"XI Bisnis Digital;XI TKJ",,SMK Budi Utomo,Produk Kreatif & Kewirausahaan',
      '"Siti Aminah, M.Pd",kepsek@budiutomo.com,kepsek123,kepsek,,,,Kepala Sekolah SMK',
      '"H. Ahmad Wijaya",yayasan@budiutomo.com,yayasan123,yayasan,,,,Ketua Yayasan',
      '"Andi Pratama",andi.siswa@budiutomo.com,siswa12345,siswa,XI Bisnis Digital,Bisnis Digital,SMK Budi Utomo,0081234567',
      '"Dewi Lestari",dewi.siswa@budiutomo.com,siswa12345,siswa,Kelas VIII,Umum (SMP),SMP Budi Utomo,0097654321',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_impor_akun_aktivitasku_7kaih.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target?.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length < 2) {
        alert('File CSV kosong atau tidak memiliki baris data.');
        return;
      }

      const parsedRows: BulkImportRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        // Parse CSV line respecting quotes
        const cols: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (const ch of lines[i]) {
          if (ch === '"') {
            inQuotes = !inQuotes;
          } else if (ch === ',' && !inQuotes) {
            cols.push(cur.trim());
            cur = '';
          } else {
            cur += ch;
          }
        }
        cols.push(cur.trim());

        const [full_name, email, password, roleRaw, kelas, jurusan, jenjang, extra] = cols;
        if (!full_name || !email || !password) continue;

        const cleanRole = (roleRaw || 'siswa').toLowerCase().trim();
        const validRole: BulkImportRow['role'] = ['siswa', 'guru', 'kepsek', 'yayasan', 'admin'].includes(cleanRole)
          ? (cleanRole as BulkImportRow['role'])
          : 'siswa';

        parsedRows.push({
          full_name,
          email,
          password,
          role: validRole,
          kelas: kelas || (validRole === 'guru' ? 'SEMUA_KELAS' : 'XI Bisnis Digital'),
          jurusan: jurusan || 'Bisnis Digital',
          jenjang: jenjang || 'SMK Budi Utomo',
          extra: extra || '',
          status: 'pending',
        });
      }
      setImportRows(parsedRows);
    };
    reader.readAsText(file);
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src="/kaih_logo.png" alt="7 KAIH" className="w-10 h-10 object-contain" />
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
                Pusat Manajemen Akun Guru, Siswa, Kepala Sekolah, Yayasan & Pembagian Kelas Mengajar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-xs sm:text-sm font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3.5 py-2 rounded-xl transition-colors cursor-pointer"
            >
              <LayoutDashboard size={16} />
              <span>Buka Monitoring 7 KAIH (Semua Kelas)</span>
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
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full space-y-6">
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
              <Upload size={16} />
              <span>Impor Massal (CSV/Excel)</span>
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
              {/* Role Selection Pills */}
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
                      <span>Akses Semua Kelas (Guru BK / Piket)</span>
                    </label>
                  </div>

                  {!newTeacherAllClasses && (
                    <>
                      <p className="text-[11px] text-teal-700">
                        Centang satu atau beberapa kelas yang diajar oleh guru ini. Saat login, guru hanya akan melihat data siswa dari kelas yang dipilih:
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

                      {/* Add custom class */}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customClassInput}
                          onChange={(e) => setCustomClassInput(e.target.value)}
                          placeholder="Tambah nama kelas lain (misal: X TKJ 2)..."
                          className="flex-1 border border-teal-300 rounded-xl px-3 py-1.5 text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => addCustomClass(newTeacherClasses, setNewTeacherClasses)}
                          className="px-3 py-1.5 rounded-xl bg-teal-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus size={14} /> Tambah Kelas
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
                        {DEFAULT_JENJANG.map((j) => (
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
                        {DEFAULT_MAJORS.map((m) => (
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
                        {DEFAULT_JENJANG.map((j) => (
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
                        {DEFAULT_MAJORS.map((m) => (
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

      {/* MODAL 3: IMPOR MASSAL CSV / EXCEL */}
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
                    Impor Massal Akun Pengguna (CSV / Excel)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Impor puluhan hingga ratusan akun Guru, Siswa, Kepala Sekolah, & Yayasan sekaligus
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
                  <p className="font-bold text-slate-800">Langkah 1: Unduh Template CSV Resmi</p>
                  <p>
                    Untuk Guru yang mengajar lebih dari 1 kelas, pisahkan nama kelas dengan tanda titik koma{' '}
                    <code className="bg-slate-200 px-1 rounded">;</code> (contoh:{' '}
                    <code className="bg-slate-200 px-1 rounded">XI Bisnis Digital;XI TKJ</code>).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold shrink-0 cursor-pointer shadow-2xs"
                >
                  <Download size={15} />
                  <span>Unduh Template CSV</span>
                </button>
              </div>

              <div className="p-4 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors text-center">
                <label className="cursor-pointer block">
                  <Upload className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <span className="text-sm font-bold text-slate-800 block">
                    Klik untuk Pilih File CSV dari Komputer Anda
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block">
                    Mendukung format .csv dari Microsoft Excel / Google Sheets
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleCsvFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {importRows.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-800 uppercase">
                      Pratinjau Data Siap Impor ({importRows.length} Baris)
                    </h4>
                    {importing && (
                      <span className="text-xs font-bold text-blue-600">
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
                                <span className="text-slate-400 font-semibold">Menunggu</span>
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
