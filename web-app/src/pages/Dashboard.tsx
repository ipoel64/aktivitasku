import React, { useEffect, useState, useMemo, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { 
  LogOut, Star, CheckCircle, Search, Calendar, MapPin, Clock, X, 
  ClipboardList, TrendingUp, Users, Map as MapLocationIcon, Activity as ActivityIcon, 
  BarChart2, UserCheck, Save, XCircle, HeartPulse, FileText, 
  Sparkles, ZoomIn, RotateCcw, Phone, User, 
  Award, School, Home, Briefcase, GraduationCap, Camera, KeyRound, LayoutDashboard, Settings,
  Printer
} from 'lucide-react';
import {
  loadSchoolLocationConfig,
  DEFAULT_SCHOOL_CONFIG,
  type SchoolLocationConfig,
} from '../utils/appConfig';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import KaihLoadingScreen from '../components/KaihLoadingScreen';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const ATTENDANCE_STATUSES = [
  { label: 'Tepat Waktu', value: 'Tepat Waktu', color: 'bg-emerald-500 text-white', lightBg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle },
  { label: 'Terlambat', value: 'Terlambat', color: 'bg-amber-500 text-white', lightBg: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  { label: 'Izin', value: 'Izin', color: 'bg-blue-500 text-white', lightBg: 'bg-blue-50 text-blue-700 border-blue-200', icon: FileText },
  { label: 'Sakit', value: 'Sakit', color: 'bg-purple-500 text-white', lightBg: 'bg-purple-50 text-purple-700 border-purple-200', icon: HeartPulse },
  { label: 'Alpha', value: 'Alpha', color: 'bg-rose-500 text-white', lightBg: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
];

const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  'Bangun Pagi': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_bangun_pagi.jpg',
  'Beribadah': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_beribadah_v2.jpg',
  'Berolahraga': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_berolahraga.jpg',
  'Makan Sehat dan Bergizi': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_makan_sehat.jpg',
  'Gemar Belajar': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_gemar_belajar.jpg',
  'Bermasyarakat': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_bermasyarakat.jpg',
  'Tidur Tepat Waktu': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_tidur_tepat_waktu.jpg',
  'Tidur Cepat': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_tidur_tepat_waktu.jpg',
};

const KAIH_CATEGORIES = [
  'Bangun Pagi',
  'Beribadah',
  'Berolahraga',
  'Makan Sehat dan Bergizi',
  'Gemar Belajar',
  'Bermasyarakat',
  'Tidur Tepat Waktu'
];

const formatIndonesianDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
    }
  } catch (e) {
    console.error(e);
  }
  return dateStr;
};

const getInitials = (name: string) => {
  if (!name) return 'S';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'S';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const parseStudentNotes = (rawNotes: any) => {
  const defaultData = {
    jenjang: '',
    jurusan: '',
    kelas: '',
    suku: '',
    house_photo_url: '',
    parentName: '',
    parentPhone: '',
    parentOccupation: ''
  };

  if (!rawNotes) return defaultData;
  if (typeof rawNotes === 'object') {
    return {
      jenjang: rawNotes.jenjang || '',
      jurusan: rawNotes.jurusan || '',
      kelas: rawNotes.kelas || '',
      suku: rawNotes.suku || '',
      house_photo_url: rawNotes.house_photo_url || '',
      parentName: rawNotes.name || rawNotes.father_name || '',
      parentPhone: rawNotes.phone || '',
      parentOccupation: rawNotes.occupation || ''
    };
  }

  try {
    const parsed = JSON.parse(rawNotes);
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        jenjang: parsed.jenjang || '',
        jurusan: parsed.jurusan || '',
        kelas: parsed.kelas || '',
        suku: parsed.suku || '',
        house_photo_url: parsed.house_photo_url || '',
        parentName: parsed.name || parsed.father_name || '',
        parentPhone: parsed.phone || '',
        parentOccupation: parsed.occupation || ''
      };
    }
  } catch (e) {
    // plain string
  }

  return {
    ...defaultData,
    parentName: String(rawNotes)
  };
};

const parseAndDeduplicateWebActivities = (rawList: any[]) => {
  if (!Array.isArray(rawList)) return [];

  const parsed = rawList.map((raw) => {
    const rawDesc = String(raw?.description || '');
    const statusMatch = rawDesc.match(/\[STATUS:(RENCANA|REALISASI)\]/i);
    const jamRencanaMatch = rawDesc.match(/\[JAM_RENCANA:(\d{2}:\d{2})\]/);
    const planIdMatch = rawDesc.match(/\[PLAN_ID:([^\]]+)\]/);

    let kaihStatus: 'RENCANA' | 'REALISASI' = 'REALISASI';
    if (statusMatch) {
      kaihStatus = statusMatch[1].toUpperCase() === 'RENCANA' ? 'RENCANA' : 'REALISASI';
    } else if (raw?.photo_url === 'PLAN_PENDING') {
      kaihStatus = 'RENCANA';
    }

    const cleanDesc = rawDesc
      .replace(/\[STATUS:[^\]]+\]\s*/gi, '')
      .replace(/\[JAM_RENCANA:[^\]]+\]\s*/gi, '')
      .replace(/\[PLAN_ID:[^\]]+\]\s*/gi, '')
      .trim();

    const rawTime = raw?.activity_time ? String(raw.activity_time).slice(0, 5) : '-';
    const plannedTime = jamRencanaMatch ? jamRencanaMatch[1] : rawTime;
    const realizedTime = kaihStatus === 'REALISASI' ? rawTime : null;

    return {
      ...raw,
      description: cleanDesc,
      raw_description: rawDesc,
      kaihStatus,
      plannedTime,
      realizedTime,
      planId: planIdMatch ? planIdMatch[1] : null,
    };
  });

  const supersededPlanIds = new Set<string>();
  const realizedKeys = new Set<string>();

  for (const item of parsed) {
    if (item.kaihStatus === 'REALISASI') {
      if (item.planId) supersededPlanIds.add(String(item.planId));
      const baseDesc = item.description.split(' | Catatan Realisasi:')[0].trim().toLowerCase();
      const studentId = item.student_id || item.students?.id || '';
      const key = `${studentId}_${item.activity_date || ''}_${(item.title || '').toLowerCase()}_${baseDesc}`;
      realizedKeys.add(key);
    }
  }

  return parsed.filter((item) => {
    if (item.kaihStatus === 'RENCANA') {
      if (supersededPlanIds.has(String(item.id))) return false;
      const baseDesc = item.description.trim().toLowerCase();
      const studentId = item.student_id || item.students?.id || '';
      const key = `${studentId}_${item.activity_date || ''}_${(item.title || '').toLowerCase()}_${baseDesc}`;
      if (realizedKeys.has(key)) return false;
    }
    return true;
  });
};

// Map Fly-To Helper Component
function FlyToLocation({ targetLoc }: { targetLoc: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetLoc) {
      map.flyTo([targetLoc.lat, targetLoc.lng], 16, {
        duration: 1.2
      });
    }
  }, [targetLoc, map]);
  return null;
}

export default function Dashboard() {
  const [activeTab, setActiveTabState] = useState<'dashboard' | 'feed' | 'attendance' | 'students' | 'map' | 'profile'>(() => {
    const saved = sessionStorage.getItem('BUDI_UTOMO_ACTIVE_TAB');
    if (saved && ['dashboard', 'feed', 'attendance', 'students', 'map', 'profile'].includes(saved)) {
      return saved as any;
    }
    return 'dashboard';
  });

  const setActiveTab = (tab: 'dashboard' | 'feed' | 'attendance' | 'students' | 'map' | 'profile') => {
    sessionStorage.setItem('BUDI_UTOMO_ACTIVE_TAB', tab);
    setActiveTabState(tab);
  };

  const [allActivitiesRaw, setAllActivitiesRaw] = useState<any[]>([]);
  const [allStudentsRaw, setAllStudentsRaw] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherProfile, setTeacherProfile] = useState<{ full_name: string; email?: string; photo_url?: string } | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>(() => {
    return localStorage.getItem('BUDI_UTOMO_USER_ROLE') || 'guru';
  });

  const isKepsek = currentUserRole === 'kepsek';
  const isYayasan = currentUserRole === 'yayasan';
  const isReadOnly = isKepsek || isYayasan;

  const [teacherAssignedClasses, setTeacherAssignedClasses] = useState<string[]>([]);
  const [teacherSubjects, setTeacherSubjects] = useState<string>('');
  const [activeClassScope, setActiveClassScope] = useState<string>('ALL_ASSIGNED');

  // Feed Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('Semua');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'REALISASI' | 'RENCANA' | 'PENDING_EVAL'>('Semua');
  const [categoryFilter, setCategoryFilter] = useState('Semua');
  const [studentViewMode, setStudentViewMode] = useState<'all' | 'with_activities'>('all');

  // Feed Stats
  const [stats, setStats] = useState({ total: 0, realized: 0, planned: 0, evaluated: 0, pending: 0 });

  // Popup Modal for Student All Activities (Requirement 2)
  const [selectedStudentForPopup, setSelectedStudentForPopup] = useState<any>(null);
  const [isStudentPopupOpen, setIsStudentPopupOpen] = useState(false);
  const [popupFilterStatus, setPopupFilterStatus] = useState<'Semua' | 'REALISASI' | 'RENCANA' | 'PENDING'>('Semua');

  // Modal Biodata Lengkap Siswa (Requirement 1 & 4)
  const [selectedStudentForBiodata, setSelectedStudentForBiodata] = useState<any>(null);
  const [isBiodataModalOpen, setIsBiodataModalOpen] = useState(false);

  // Image Zoom Modal
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  // Evaluation Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [evaluation, setEvaluation] = useState({ rating: 0, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile Modal (Analytics)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentStats, setStudentStats] = useState<any[]>([]);

  // Map Interactive Target & Marker Refs (Requirement 2)
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number; id: string } | null>(null);
  const markerRefs = useRef<Record<string, any>>({});

  // Bulk Evaluation States
  const [isBulkEvalOpen, setIsBulkEvalOpen] = useState(false);
  const [bulkRating, setBulkRating] = useState(0);
  const [bulkComment, setBulkComment] = useState('');
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  // School Location Config & Ranking Report State (Issue 4 & Issue 6)
  const [schoolLocation, setSchoolLocation] = useState<SchoolLocationConfig>(DEFAULT_SCHOOL_CONFIG);
  const [isRankingReportOpen, setIsRankingReportOpen] = useState(false);
  const [rankingClassFilter, setRankingClassFilter] = useState('Semua');

  // Profile Form States
  const [profileForm, setProfileForm] = useState({ fullName: '', photoUrl: '', newPassword: '', confirmPassword: '' });
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{type:'success'|'error', text:string}|null>(null);
  const [passwordMsg, setPasswordMsg] = useState<{type:'success'|'error', text:string}|null>(null);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(false);

  // Data Siswa: pencarian & filter berdasarkan biodata
  const [stuSearch, setStuSearch] = useState('');
  const [stuFilters, setStuFilters] = useState({ jenjang: 'Semua', kelas: 'Semua', jurusan: 'Semua', gender: 'Semua', religion: 'Semua', suku: 'Semua', status: 'Semua' });
  const resetStuFilters = () => {
    setStuSearch('');
    setStuFilters({ jenjang: 'Semua', kelas: 'Semua', jurusan: 'Semua', gender: 'Semua', religion: 'Semua', suku: 'Semua', status: 'Semua' });
  };

  const getCurrentTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  // Attendance State
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(getCurrentTimeStr());
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, { id?: string; status: string; notes: string; time?: string }>>({});
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [attSearchTerm, setAttSearchTerm] = useState('');
  const [attFilterStatus, setAttFilterStatus] = useState('Semua');
  const [attClassFilter, setAttClassFilter] = useState('Semua');
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);

  const resetAttFilters = () => {
    setAttSearchTerm('');
    setAttFilterStatus('Semua');
    setAttClassFilter('Semua');
  };

  useEffect(() => {
    fetchData();
    loadSchoolLocationConfig().then((cfg) => {
      if (cfg) setSchoolLocation(cfg);
    });
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, dateFilter, statusFilter, categoryFilter, activities]);

  useEffect(() => {
    if (activeTab === 'attendance' || students.length > 0) {
      fetchAttendanceForDate(selectedDate);
    }
  }, [selectedDate, activeTab]);

  // Filter students & activities by the logged-in teacher's assigned classes (Requirement 4)
  useEffect(() => {
    const isRestrictedTeacher =
      currentUserRole === 'guru' &&
      teacherAssignedClasses.length > 0 &&
      !teacherAssignedClasses.includes('SEMUA_KELAS');

    let scopedStudents = allStudentsRaw;

    if (isRestrictedTeacher) {
      const targetClasses =
        activeClassScope === 'ALL_ASSIGNED'
          ? teacherAssignedClasses.map((c) => c.trim().toLowerCase())
          : [activeClassScope.trim().toLowerCase()];

      scopedStudents = allStudentsRaw.filter((s) =>
        targetClasses.includes(String(s.kelas || '').trim().toLowerCase())
      );
    } else if (activeClassScope !== 'ALL_ASSIGNED') {
      scopedStudents = allStudentsRaw.filter(
        (s) => String(s.kelas || '').trim().toLowerCase() === activeClassScope.trim().toLowerCase()
      );
    }

    const allowedStudentIds = new Set(scopedStudents.map((s) => String(s.id)));

    const scopedActivities =
      isRestrictedTeacher || activeClassScope !== 'ALL_ASSIGNED'
        ? allActivitiesRaw.filter((a) => {
            const sid = String(a.student_id || a.students?.id || '');
            return allowedStudentIds.has(sid);
          })
        : allActivitiesRaw;

    setStudents(scopedStudents);
    setActivities(scopedActivities);

    const realizedActs = scopedActivities.filter((a) => a.kaihStatus === 'REALISASI');
    const plannedActs = scopedActivities.filter((a) => a.kaihStatus === 'RENCANA');
    const evaluated = realizedActs.filter((a) => (a.evaluations || []).length > 0).length;

    setStats({
      total: scopedActivities.length,
      realized: realizedActs.length,
      planned: plannedActs.length,
      evaluated,
      pending: Math.max(0, realizedActs.length - evaluated),
    });
  }, [allStudentsRaw, allActivitiesRaw, currentUserRole, teacherAssignedClasses, activeClassScope]);

  const fetchData = async () => {
    setLoading(true);

    // 1. Fetch Logged-in Teacher Info + Assigned Classes
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [{ data: userRow }, { data: prof }] = await Promise.all([
          supabase.from('users').select('role').eq('id', user.id).maybeSingle(),
          supabase.from('user_profiles').select('id, full_name, photo_url').eq('user_id', user.id).maybeSingle(),
        ]);

        const roleStr = userRow?.role || 'guru';
        setCurrentUserRole(roleStr);
        try {
          localStorage.setItem('BUDI_UTOMO_USER_ROLE', roleStr);
        } catch {
          // ignore storage error
        }

        const defaultRoleName =
          roleStr === 'kepsek'
            ? 'Bapak/Ibu Kepala Sekolah'
            : roleStr === 'yayasan'
            ? 'Pengurus Yayasan'
            : roleStr === 'admin'
            ? 'Administrator'
            : 'Bapak/Ibu Guru';

        if (prof) {
          setTeacherProfile({ full_name: prof.full_name || defaultRoleName, email: user.email, photo_url: prof.photo_url });
          setProfileForm(prev => ({ ...prev, fullName: prof.full_name || '', photoUrl: prof.photo_url || '' }));

          if (roleStr === 'guru' && prof.id) {
            const { data: tRow } = await supabase
              .from('teachers')
              .select('subjects, position, certifications')
              .eq('profile_id', prof.id)
              .maybeSingle();

            if (tRow) {
              setTeacherSubjects(tRow.subjects || '');
              let parsedClasses: string[] = [];
              try {
                if (tRow.certifications) {
                  const parsed = JSON.parse(tRow.certifications);
                  if (Array.isArray(parsed?.assigned_classes)) {
                    parsedClasses = parsed.assigned_classes;
                  }
                }
              } catch {
                if (typeof tRow.certifications === 'string' && tRow.certifications.trim()) {
                  parsedClasses = tRow.certifications.split(',').map((s: string) => s.trim()).filter(Boolean);
                }
              }
              setTeacherAssignedClasses(parsedClasses);
            }
          }
        } else {
          setTeacherProfile({ full_name: user.email?.split('@')[0] || 'Bapak/Ibu Guru', email: user.email });
          setProfileForm(prev => ({ ...prev, fullName: user.email?.split('@')[0] || '' }));
        }
      }
    } catch (e) {
      console.error("Error fetching teacher profile:", e);
    }

    // 2. Fetch all activities with student names, photos and existing evaluations
    const { data: actData, error: actError } = await supabase
      .from('activities')
      .select(`
        *,
        students!inner(
          id,
          user_profiles(full_name, photo_url, address, latitude, longitude)
        ),
        activity_categories(name)
      `)
      .order('created_at', { ascending: false });

    // 3. Fetch evaluations
    const { data: evalData } = await supabase.from('evaluations').select('id, activity_id, rating, comment');

    if (actData) {
      const rawMerged = actData.map(act => {
        const evals = evalData?.filter(e => e.activity_id === act.id) || [];
        return { ...act, evaluations: evals };
      });
      const mergedActs = parseAndDeduplicateWebActivities(rawMerged);
      setAllActivitiesRaw(mergedActs);

      if (selectedStudentForPopup) {
        const curStudentId = selectedStudentForPopup.student?.id;
        if (curStudentId) {
          const freshActs = mergedActs.filter((a: any) => (a.students?.id || a.student_id) === curStudentId);
          if (freshActs.length > 0) {
            const evaluatedCount = freshActs.filter((a: any) => a.kaihStatus === 'REALISASI' && a.evaluations && a.evaluations.length > 0).length;
            const pendingCount = freshActs.filter((a: any) => a.kaihStatus === 'REALISASI' && (!a.evaluations || a.evaluations.length === 0)).length;
            const realizedCount = freshActs.filter((a: any) => a.kaihStatus === 'REALISASI').length;
            const plannedCount = freshActs.filter((a: any) => a.kaihStatus === 'RENCANA').length;
            setSelectedStudentForPopup((prev: any) => prev ? ({
              ...prev,
              activities: freshActs,
              evaluatedCount,
              pendingCount,
              realizedCount,
              plannedCount,
            }) : null);
          }
        }
      }
    } else if (actError) {
      console.error(actError);
    }

    // 4. Comprehensive fetch for all students with complete mobile biodata fields (Requirement 1 & 4)
    const { data: studentsTable } = await supabase
      .from('students')
      .select(`
        id,
        nis,
        nisn,
        education_level,
        hobbies,
        aspiration,
        talents,
        interests,
        extracurriculars,
        blood_type,
        health_notes,
        notes,
        profile_id,
        user_profiles (
          id,
          full_name,
          address,
          latitude,
          longitude,
          photo_url,
          gender,
          religion,
          birth_date,
          phone,
          user_id,
          users (
            id,
            email,
            role,
            is_active
          )
        )
      `);

    const { data: allUsers } = await supabase
      .from('users')
      .select(`
        id,
        email,
        role,
        is_active,
        user_profiles ( 
          id, 
          full_name, 
          photo_url, 
          address, 
          latitude, 
          longitude, 
          gender, 
          religion, 
          birth_date, 
          phone 
        )
      `);

    const studentList: any[] = [];
    const processedStudentIds = new Set<string>();
    const processedProfileIds = new Set<string>();

    if (studentsTable) {
      for (const st of studentsTable) {
        const prof = Array.isArray(st.user_profiles) ? st.user_profiles[0] : st.user_profiles;
        const name = prof?.full_name || 'Siswa';
        const photo = prof?.photo_url || null;

        const parsedNotes = parseStudentNotes(st.notes);
        const jenjangFinal = parsedNotes.jenjang || st.education_level || 'Budi Utomo';
        const isSMK = jenjangFinal.includes('SMK');
        const jurusanFinal = parsedNotes.jurusan || (isSMK ? '-' : 'Umum (SMP)');
        const kelasFinal = parsedNotes.kelas || st.education_level || 'Kelas Budi Utomo';

        studentList.push({
          id: st.id,
          profile_id: st.profile_id,
          user_id: prof?.user_id || st.id,
          name: name,
          photo_url: photo,
          nis: st.nis || '-',
          nisn: st.nisn || '-',
          education_level: jenjangFinal,
          jenjang: jenjangFinal,
          jurusan: jurusanFinal,
          kelas: kelasFinal,
          suku: parsedNotes.suku || '-',
          house_photo_url: parsedNotes.house_photo_url || null,
          hobbies: st.hobbies || '-',
          aspiration: st.aspiration || '-',
          talents: st.talents || '-',
          interests: st.interests || '-',
          extracurriculars: st.extracurriculars || '-',
          blood_type: st.blood_type || '-',
          health_notes: st.health_notes || '-',
          notes: st.notes,
          parentNotes: {
            name: parsedNotes.parentName || '-',
            phone: parsedNotes.parentPhone || '-',
            occupation: parsedNotes.parentOccupation || '-'
          },
          address: prof?.address || '-',
          latitude: prof?.latitude,
          longitude: prof?.longitude,
          gender: prof?.gender || '-',
          religion: prof?.religion || '-',
          birth_date: prof?.birth_date || '-',
          phone: prof?.phone || '-',
          email: (Array.isArray(prof?.users) ? (prof?.users[0] as any)?.email : (prof?.users as any)?.email) || '-'
        });
        processedStudentIds.add(st.id);
        if (prof?.id) processedProfileIds.add(prof.id);
      }
    }

    if (allUsers) {
      for (const u of allUsers) {
        const roleLower = (u.role || '').toLowerCase();
        if (roleLower === 'siswa') {
          const prof = Array.isArray(u.user_profiles) ? u.user_profiles[0] : u.user_profiles;
          if (prof?.id && !processedProfileIds.has(prof.id)) {
            let studentId = '';
            const { data: newSt } = await supabase
              .from('students')
              .insert({ profile_id: prof.id })
              .select('id')
              .single();

            if (newSt) {
              studentId = newSt.id;
            }

            if (studentId && !processedStudentIds.has(studentId)) {
              studentList.push({
                id: studentId,
                profile_id: prof.id,
                user_id: u.id,
                name: prof.full_name || u.email || 'Siswa',
                photo_url: prof.photo_url || null,
                nis: '-',
                nisn: '-',
                education_level: 'Budi Utomo',
                jenjang: 'Budi Utomo',
                jurusan: '-',
                kelas: 'Kelas Budi Utomo',
                suku: '-',
                house_photo_url: null,
                hobbies: '-',
                aspiration: '-',
                talents: '-',
                interests: '-',
                extracurriculars: '-',
                blood_type: '-',
                health_notes: '-',
                notes: null,
                parentNotes: { name: '-', phone: '-', occupation: '-' },
                address: prof.address || '-',
                latitude: prof.latitude,
                longitude: prof.longitude,
                gender: prof.gender || '-',
                religion: prof.religion || '-',
                birth_date: prof.birth_date || '-',
                phone: prof.phone || '-',
                email: u.email || '-'
              });
              processedStudentIds.add(studentId);
              processedProfileIds.add(prof.id);
            }
          }
        }
      }
    }

    setAllStudentsRaw(studentList);
    await fetchAttendanceForDate(selectedDate);
    setLoading(false);
  };

  const mapStatusToDb = (uiStatus: string): string => {
    if (!uiStatus) return 'hadir';
    switch (uiStatus) {
      case 'Tepat Waktu': return 'hadir';
      case 'Terlambat': return 'terlambat';
      case 'Izin': return 'izin';
      case 'Sakit': return 'sakit';
      case 'Alpha': return 'alpha';
      default: return uiStatus.toLowerCase();
    }
  };

  const mapDbToUiStatus = (dbStatus: string, notes?: string): string => {
    if (notes && notes.includes('[STATUS:Terlambat]')) return 'Terlambat';
    if (notes && notes.includes('[STATUS:Tepat Waktu]')) return 'Tepat Waktu';
    if (notes && notes.includes('[STATUS:Izin]')) return 'Izin';
    if (notes && notes.includes('[STATUS:Sakit]')) return 'Sakit';
    if (notes && notes.includes('[STATUS:Alpha]')) return 'Alpha';

    if (!dbStatus) return '';
    const lower = dbStatus.toLowerCase();
    if (lower === 'hadir' || lower === 'tepat waktu' || lower === 'tepat_waktu') return 'Tepat Waktu';
    if (lower === 'terlambat') return 'Terlambat';
    if (lower === 'izin') return 'Izin';
    if (lower === 'sakit') return 'Sakit';
    if (lower === 'alpha') return 'Alpha';
    return dbStatus;
  };

  const fetchAttendanceForDate = async (dateStr: string) => {
    let { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('attendance_date', dateStr);

    if (error && (error.message?.includes('attendance_date') || error.message?.includes('schema cache') || error.message?.includes('Could not find'))) {
      const res = await supabase
        .from('attendance')
        .select('*')
        .eq('date', dateStr);
      data = res.data;
      error = res.error;
    }

    if (error) {
      console.error("Error fetching attendance:", error);
      return;
    }

    const recordsMap: Record<string, { id?: string; status: string; notes: string; time: string }> = {};
    if (data) {
      data.forEach((item: any) => {
        let rawNotes = item.notes || '';
        let extractedTime = item.attendance_time || item.time || (item.created_at ? new Date(item.created_at).toTimeString().slice(0, 5) : '');

        const jamMatch = rawNotes.match(/\[JAM:([^\]]+)\]/);
        if (jamMatch) {
          extractedTime = jamMatch[1];
        }

        const cleanNotes = rawNotes
          .replace(/\[STATUS:[^\]]+\]\s*/g, '')
          .replace(/\[JAM:[^\]]+\]\s*/g, '')
          .trim();

        recordsMap[item.student_id] = {
          id: item.id,
          status: mapDbToUiStatus(item.status, item.notes),
          notes: cleanNotes,
          time: extractedTime || getCurrentTimeStr()
        };
      });
    }
    setAttendanceRecords(recordsMap);
  };

  const applyFilters = () => {
    let result = [...activities];

    if (searchTerm.trim() !== '') {
      const lower = searchTerm.toLowerCase();
      result = result.filter(act => {
        const prof = Array.isArray(act.students?.user_profiles) ? act.students.user_profiles[0] : act.students?.user_profiles;
        const name = prof?.full_name || '';
        return (
          name.toLowerCase().includes(lower) ||
          act.title?.toLowerCase().includes(lower) ||
          act.description?.toLowerCase().includes(lower) ||
          act.activity_categories?.name?.toLowerCase().includes(lower)
        );
      });
    }

    if (dateFilter !== 'Semua') {
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

      if (dateFilter === 'Hari Ini') {
        result = result.filter(act => act.activity_date === today);
      } else if (dateFilter === 'Kemarin') {
        result = result.filter(act => act.activity_date === yesterday);
      } else if (dateFilter === 'Besok') {
        result = result.filter(act => act.activity_date === tomorrow);
      }
    }

    if (statusFilter !== 'Semua') {
      if (statusFilter === 'PENDING_EVAL') {
        result = result.filter(act => act.kaihStatus === 'REALISASI' && (!act.evaluations || act.evaluations.length === 0));
      } else {
        result = result.filter(act => act.kaihStatus === statusFilter);
      }
    }

    if (categoryFilter !== 'Semua') {
      const lowerCat = categoryFilter.toLowerCase();
      result = result.filter(act => {
        const catName = act.activity_categories?.name || act.title || '';
        return catName.toLowerCase().includes(lowerCat);
      });
    }

    setFilteredActivities(result);
  };

  const resetAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('Semua');
    setDateFilter('Semua');
    setCategoryFilter('Semua');
    setStudentViewMode('all');
  };

  const isFilterActive = searchTerm !== '' || statusFilter !== 'Semua' || dateFilter !== 'Semua' || categoryFilter !== 'Semua' || studentViewMode !== 'all';

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const openEvaluationModal = (activity: any) => {
    if (isReadOnly) return;
    // Hanya kegiatan yang sudah realisasi yang boleh dinilai
    if (activity.kaihStatus !== 'REALISASI') {
      alert('Kegiatan yang masih berstatus rencana belum bisa dinilai. Tunggu siswa melakukan realisasi.');
      return;
    }
    setSelectedActivity(activity);
    const existing = activity.evaluations && activity.evaluations.length > 0 ? activity.evaluations[0] : null;
    setEvaluation({
      rating: existing?.rating || 0,
      comment: existing?.comment || ''
    });
    setIsModalOpen(true);
  };

  const openStudentBiodata = (student: any) => {
    setSelectedStudentForBiodata(student);
    setIsBiodataModalOpen(true);
  };

  const openStudentProfile = (student: any) => {
    const studentActs = activities.filter(a => a.students?.id === student.id && a.kaihStatus === 'REALISASI');
    const catCount: Record<string, number> = {};
    studentActs.forEach(act => {
      const cat = act.activity_categories?.name || 'Lainnya';
      catCount[cat] = (catCount[cat] || 0) + 1;
    });

    const chartData = Object.keys(catCount).map(k => ({
      name: k,
      Total: catCount[k]
    }));

    setStudentStats(chartData);
    setSelectedStudent(student);
    setIsProfileModalOpen(true);
  };

  const submitEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) {
      alert('Akun Anda dalam mode pemantauan (Read-Only) dan tidak dapat mengirim penilaian.');
      setIsModalOpen(false);
      return;
    }
    if (evaluation.rating === 0) {
      alert("Silakan pilih rating bintang terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', user?.id).single();
      let { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', profile?.id).single();
      let teacherId = teacher?.id;

      if (!teacherId && profile?.id) {
        const { data: newTeacher, error: createError } = await supabase.from('teachers').insert({ profile_id: profile.id }).select('id').single();
        if (createError) throw new Error("Gagal membuat profil guru otomatis");
        teacherId = newTeacher?.id;
      }

      if (!teacherId) throw new Error("Profil guru tidak ditemukan dan gagal dibuat");

      const existingEvalId = selectedActivity.evaluations?.[0]?.id;
      let evalErr: any = null;

      if (existingEvalId) {
        const { error } = await supabase.from('evaluations').update({
          rating: evaluation.rating,
          comment: evaluation.comment
        }).eq('id', existingEvalId);
        evalErr = error;
      } else {
        const { error } = await supabase.from('evaluations').insert({
          activity_id: selectedActivity.id,
          teacher_id: teacherId,
          rating: evaluation.rating,
          comment: evaluation.comment
        });
        evalErr = error;
      }

      if (evalErr) throw new Error(evalErr.message);

      setIsModalOpen(false);
      await fetchData();

      if (selectedStudentForPopup) {
        setSelectedStudentForPopup((prev: any) => {
          if (!prev) return prev;
          const updatedActs = (prev.activities || []).map((a: any) => {
            if (a.id === selectedActivity.id) {
              return {
                ...a,
                evaluations: [{ id: existingEvalId || 'new', rating: evaluation.rating, comment: evaluation.comment }]
              };
            }
            return a;
          });
          const evaluatedCount = updatedActs.filter((a: any) => a.kaihStatus === 'REALISASI' && a.evaluations && a.evaluations.length > 0).length;
          const pendingCount = updatedActs.filter((a: any) => a.kaihStatus === 'REALISASI' && (!a.evaluations || a.evaluations.length === 0)).length;
          const realizedCount = updatedActs.filter((a: any) => a.kaihStatus === 'REALISASI').length;
          const plannedCount = updatedActs.filter((a: any) => a.kaihStatus === 'RENCANA').length;
          return {
            ...prev,
            activities: updatedActs,
            evaluatedCount,
            pendingCount,
            realizedCount,
            plannedCount,
          };
        });
      }

      alert("🎉 Berhasil menyimpan penilaian aktivitas!");
    } catch (e: any) {
      console.error(e);
      alert("Gagal memberikan penilaian: " + (e.message || 'Error tidak diketahui'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- ATTENDANCE HANDLERS ---
  const handleStatusChange = (studentId: string, statusValue: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: statusValue,
        notes: prev[studentId]?.notes || '',
        time: prev[studentId]?.time || selectedTime
      }
    }));
  };

  const handleNotesChange = (studentId: string, notesValue: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId]?.status || 'Tepat Waktu',
        notes: notesValue,
        time: prev[studentId]?.time || selectedTime
      }
    }));
  };

  const handleTimeChange = (studentId: string, timeValue: string) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        status: prev[studentId]?.status || 'Tepat Waktu',
        notes: prev[studentId]?.notes || '',
        time: timeValue
      }
    }));
  };

  const handleMarkAllPresent = () => {
    const targetStudents = attClassFilter === 'Semua' ? students : filteredAttStudents;
    setAttendanceRecords(prev => {
      const updated = { ...prev };
      targetStudents.forEach(student => {
        updated[student.id] = {
          ...updated[student.id],
          status: 'Tepat Waktu',
          notes: updated[student.id]?.notes || '',
          time: selectedTime || getCurrentTimeStr()
        };
      });
      return updated;
    });
  };

  const handleResetAllAttendance = () => {
    if (isReadOnly) return;
    const targetStudents = attClassFilter === 'Semua' ? students : filteredAttStudents;
    const count = targetStudents.length;
    if (!window.confirm(`Reset status absensi untuk ${count} siswa menjadi 'Belum Diabsen'?`)) return;

    setAttendanceRecords(prev => {
      const updated = { ...prev };
      targetStudents.forEach(student => {
        if (updated[student.id]) {
          updated[student.id] = {
            ...updated[student.id],
            status: '',
            notes: ''
          };
        }
      });
      return updated;
    });
  };

  const safeSaveAttendanceRow = async (studentId: string, statusUi: string, rawNotes: string, existingId?: string, timeVal?: string) => {
    const mappedStatus = mapStatusToDb(statusUi);
    const activeTime = timeVal || selectedTime || getCurrentTimeStr();

    const cleanNotes = (rawNotes || '')
      .replace(/\[STATUS:[^\]]+\]\s*/g, '')
      .replace(/\[JAM:[^\]]+\]\s*/g, '')
      .trim();
    const timeTaggedNotes = `[JAM:${activeTime}] ${cleanNotes}`.trim();

    let err: any = null;
    let resData: any = null;

    if (existingId) {
      let res = await supabase.from('attendance').update({
        status: mappedStatus,
        notes: timeTaggedNotes,
        attendance_time: activeTime,
        period_number: 1
      }).eq('id', existingId);

      if (res.error && (res.error.message?.includes('attendance_time') || res.error.message?.includes('period_number'))) {
        res = await supabase.from('attendance').update({
          status: mappedStatus,
          notes: timeTaggedNotes
        }).eq('id', existingId);
      }

      if (res.error && (res.error.message?.includes('enum') || res.error.message?.includes('invalid input value'))) {
        const fallbackNotes = `[STATUS:${statusUi}] ${timeTaggedNotes}`.trim();
        res = await supabase.from('attendance').update({
          status: 'hadir',
          notes: fallbackNotes
        }).eq('id', existingId);
      }

      err = res.error;
    } else {
      const payload: any = {
        student_id: studentId,
        attendance_date: selectedDate,
        attendance_time: activeTime,
        period_number: 1,
        status: mappedStatus,
        notes: timeTaggedNotes
      };

      let res = await supabase.from('attendance').insert(payload).select('id').single();

      if (res.error && res.error.message?.includes('attendance_time')) {
        delete payload.attendance_time;
        res = await supabase.from('attendance').insert(payload).select('id').single();
      }

      if (res.error && res.error.message?.includes('period_number')) {
        delete payload.period_number;
        res = await supabase.from('attendance').insert(payload).select('id').single();
      }

      if (res.error && (res.error.message?.includes('enum') || res.error.message?.includes('invalid input value'))) {
        payload.status = 'hadir';
        payload.notes = `[STATUS:${statusUi}] ${timeTaggedNotes}`.trim();
        res = await supabase.from('attendance').insert(payload).select('id').single();
      }

      if (res.error && (res.error.message?.includes('attendance_date') || res.error.message?.includes('schema cache') || res.error.message?.includes('Could not find'))) {
        const datePayload: any = {
          student_id: studentId,
          date: selectedDate,
          period_number: 1,
          status: mappedStatus,
          notes: timeTaggedNotes
        };
        res = await supabase.from('attendance').insert(datePayload).select('id').single();

        if (res.error && res.error.message?.includes('period_number')) {
          delete datePayload.period_number;
          res = await supabase.from('attendance').insert(datePayload).select('id').single();
        }

        if (res.error && (res.error.message?.includes('enum') || res.error.message?.includes('invalid input value'))) {
          datePayload.status = 'hadir';
          datePayload.notes = `[STATUS:${statusUi}] ${timeTaggedNotes}`.trim();
          res = await supabase.from('attendance').insert(datePayload).select('id').single();
        }
      }

      err = res.error;
      resData = res.data;
    }

    if (err) throw err;
    return resData;
  };

  const saveAllAttendance = async () => {
    if (isReadOnly) return;
    setIsSavingAttendance(true);
    let successCount = 0;
    let hasRlsError = false;

    try {
      for (const student of students) {
        const rec = attendanceRecords[student.id];
        if (!rec || !rec.status) continue;

        try {
          const res = await safeSaveAttendanceRow(student.id, rec.status, rec.notes, rec.id, rec.time);
          if (res && res.id) {
            rec.id = res.id;
          }
          successCount++;
        } catch (err: any) {
          if (err.message?.includes('row-level security') || err.code === '42501') {
            hasRlsError = true;
          }
          throw err;
        }
      }

      await fetchAttendanceForDate(selectedDate);
      alert(`🎉 Berhasil menyimpan ${successCount} data absensi untuk tanggal ${selectedDate}!`);
    } catch (err: any) {
      console.error("Save attendance error:", err);
      if (hasRlsError || err.message?.includes('row-level security') || err.code === '42501') {
        alert(
          "⚠️ AKSES SIMPAN DIBLOKIR SUPABASE RLS!\n\n" +
          "Sebab: RLS aktif pada tabel 'attendance', tetapi kebijakan SIMPAN belum diberikan.\n\n" +
          "Solusi Cepat: Silakan jalankan SQL ini di Supabase Studio SQL Editor:\n" +
          "ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;"
        );
      } else {
        alert("Gagal menyimpan absensi: " + (err.message || "Error tidak diketahui"));
      }
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const saveSingleStudentAttendance = async (student: any) => {
    if (isReadOnly) return;
    const rec = attendanceRecords[student.id];
    if (!rec || !rec.status) {
      alert("Silakan pilih status absensi terlebih dahulu.");
      return;
    }

    setSavingStudentId(student.id);
    try {
      const res = await safeSaveAttendanceRow(student.id, rec.status, rec.notes, rec.id, rec.time);
      if (res && res.id) {
        rec.id = res.id;
      }
      await fetchAttendanceForDate(selectedDate);
      alert(`✅ Berhasil memperbarui absensi untuk ${student.name}!`);
    } catch (err: any) {
      console.error("Edit single attendance error:", err);
      alert("Gagal memperbarui absensi: " + (err.message || 'Error tidak diketahui'));
    } finally {
      setSavingStudentId(null);
    }
  };

  // Compute attendance stats
  const computeAttendanceStats = () => {
    let tepatWaktu = 0;
    let terlambat = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;
    let belumInput = 0;

    students.forEach(s => {
      const status = attendanceRecords[s.id]?.status;
      if (status === 'Tepat Waktu') tepatWaktu++;
      else if (status === 'Terlambat') terlambat++;
      else if (status === 'Izin') izin++;
      else if (status === 'Sakit') sakit++;
      else if (status === 'Alpha') alpha++;
      else belumInput++;
    });

    return { tepatWaktu, terlambat, izin, sakit, alpha, belumInput };
  };

  const attStats = computeAttendanceStats();

  const availableAttClasses = useMemo(() => {
    return Array.from(new Set(students.map(s => s.kelas || s.education_level).filter(Boolean))).sort();
  }, [students]);

  const filteredAttStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(attSearchTerm.toLowerCase());
    const recStatus = attendanceRecords[s.id]?.status;
    let matchesStatus = true;
    if (attFilterStatus === 'Belum Diabsen') {
      matchesStatus = !recStatus;
    } else if (attFilterStatus !== 'Semua') {
      matchesStatus = recStatus === attFilterStatus;
    }
    let matchesClass = true;
    if (attClassFilter !== 'Semua') {
      const cls = s.kelas || s.education_level || '';
      matchesClass = cls === attClassFilter;
    }
    return matchesSearch && matchesStatus && matchesClass;
  });

  const getActivityImageUrl = (act: any) => {
    if (act.photo_url && act.photo_url.startsWith('http')) {
      return act.photo_url;
    }
    const catName = act.activity_categories?.name || act.title || '';
    if (DEFAULT_CATEGORY_IMAGES[catName]) {
      return DEFAULT_CATEGORY_IMAGES[catName];
    }
    for (const [key, url] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
      if (catName.toLowerCase().includes(key.toLowerCase())) {
        return url;
      }
    }
    return 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80';
  };

  // Group activities per student for the Feed overview
  const studentActivityCards = useMemo(() => {
    const map: Record<string, {
      student: any;
      activities: any[];
      realizedCount: number;
      plannedCount: number;
      evaluatedCount: number;
      pendingCount: number;
      latestDate: string;
      latestActivity: any;
    }> = {};

    students.forEach(st => {
      map[st.id] = {
        student: st,
        activities: [],
        realizedCount: 0,
        plannedCount: 0,
        evaluatedCount: 0,
        pendingCount: 0,
        latestDate: '',
        latestActivity: null
      };
    });

    filteredActivities.forEach(act => {
      const studentId = act.students?.id;
      if (!studentId) return;

      if (!map[studentId]) {
        const profData = Array.isArray(act.students?.user_profiles) 
          ? act.students.user_profiles[0] 
          : act.students?.user_profiles;
        map[studentId] = {
          student: {
            id: studentId,
            name: profData?.full_name || 'Siswa',
            photo_url: profData?.photo_url || null,
            education_level: 'Budi Utomo',
            jenjang: 'Budi Utomo',
            jurusan: '-',
            kelas: 'Kelas Budi Utomo',
            nis: '-',
            nisn: '-'
          },
          activities: [],
          realizedCount: 0,
          plannedCount: 0,
          evaluatedCount: 0,
          pendingCount: 0,
          latestDate: '',
          latestActivity: null
        };
      }

      map[studentId].activities.push(act);
      if (act.kaihStatus === 'REALISASI') {
        map[studentId].realizedCount++;
        if (act.evaluations && act.evaluations.length > 0) {
          map[studentId].evaluatedCount++;
        } else {
          map[studentId].pendingCount++;
        }
      } else if (act.kaihStatus === 'RENCANA') {
        map[studentId].plannedCount++;
      }

      const curDateStr = act.activity_date || '';
      if (!map[studentId].latestDate || curDateStr > map[studentId].latestDate) {
        map[studentId].latestDate = curDateStr;
        map[studentId].latestActivity = act;
      }
    });

    let list = Object.values(map);

    if (studentViewMode === 'with_activities') {
      list = list.filter(item => item.activities.length > 0);
    }

    list.sort((a, b) => {
      if (b.latestDate !== a.latestDate) {
        return b.latestDate.localeCompare(a.latestDate);
      }
      return a.student.name.localeCompare(b.student.name);
    });

    return list;
  }, [filteredActivities, students, studentViewMode]);

  // Group studentActivityCards by Class with A-Z sorting (Issue 2)
  const groupedStudentCards = useMemo(() => {
    const groups: Record<string, typeof studentActivityCards> = {};
    studentActivityCards.forEach((card) => {
      const cls = card.student.kelas || card.student.education_level || 'Kelas Budi Utomo';
      if (!groups[cls]) groups[cls] = [];
      groups[cls].push(card);
    });

    // Urutkan siswa di setiap kelas berdasarkan abjad nama dari A ke Z
    Object.keys(groups).forEach((cls) => {
      groups[cls].sort((a, b) => (a.student.name || '').localeCompare(b.student.name || '', 'id'));
    });

    // Urutkan nama kelas
    return Object.keys(groups).sort().map((className) => ({
      className,
      cards: groups[className],
    }));
  }, [studentActivityCards]);

  // Sort attendance students by class and A-Z by name (Issue 2)
  const sortedAttStudents = useMemo(() => {
    return [...filteredAttStudents].sort((a, b) => {
      const classA = a.kelas || a.education_level || 'Kelas Budi Utomo';
      const classB = b.kelas || b.education_level || 'Kelas Budi Utomo';
      if (classA !== classB) {
        return classA.localeCompare(classB, 'id');
      }
      return (a.name || '').localeCompare(b.name || '', 'id');
    });
  }, [filteredAttStudents]);

  // Ranking & Character Analysis Calculation (Issue 6)
  const rankingData = useMemo(() => {
    return students.map((s) => {
      const studentActs = activities.filter((a) => (a.students?.id || a.student_id) === s.id);
      const realizedCount = studentActs.filter((a) => a.kaihStatus === 'REALISASI').length;

      const ratings = studentActs
        .filter((a) => a.evaluations && a.evaluations.length > 0)
        .map((a) => Number(a.evaluations[0].rating) || 0);
      const avgRating = ratings.length > 0 ? (ratings.reduce((acc, r) => acc + r, 0) / ratings.length) : 0;

      const rec = attendanceRecords[s.id];
      let attScore = 75;
      if (rec?.status === 'Tepat Waktu') attScore = 100;
      else if (rec?.status === 'Terlambat') attScore = 80;
      else if (rec?.status === 'Izin') attScore = 70;
      else if (rec?.status === 'Sakit') attScore = 70;
      else if (rec?.status === 'Alpha') attScore = 0;

      const kaihScore = Math.min(100, Math.round((realizedCount / 7) * 100));
      const ratingScore = Math.round((avgRating / 5) * 100);
      const finalScore = Math.round((kaihScore * 0.4) + (ratingScore * 0.4) + (attScore * 0.2));

      let predicate = 'Cukup';
      if (finalScore >= 85) predicate = 'Sangat Unggul 🌟';
      else if (finalScore >= 75) predicate = 'Unggul ⭐';
      else if (finalScore >= 60) predicate = 'Baik 👍';
      else predicate = 'Perlu Bimbingan ⚠️';

      return {
        student: s,
        realizedCount,
        avgRating: avgRating.toFixed(1),
        ratingsCount: ratings.length,
        attendanceStatus: rec?.status || 'Belum Diabsen',
        attScore,
        kaihScore,
        ratingScore,
        finalScore,
        predicate,
      };
    })
    .filter((item) => {
      if (rankingClassFilter === 'Semua') return true;
      const cls = item.student.kelas || item.student.education_level || '';
      return cls === rankingClassFilter;
    })
    .sort((a, b) => {
      if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
      if (b.realizedCount !== a.realizedCount) return b.realizedCount - a.realizedCount;
      return (a.student.name || '').localeCompare(b.student.name || '', 'id');
    });
  }, [students, activities, attendanceRecords, rankingClassFilter]);

  // Activities to display inside popup
  const popupActivities = useMemo(() => {
    if (!selectedStudentForPopup) return [];
    let list = selectedStudentForPopup.activities || [];

    if (popupFilterStatus === 'REALISASI') {
      list = list.filter((a: any) => a.kaihStatus === 'REALISASI');
    } else if (popupFilterStatus === 'RENCANA') {
      list = list.filter((a: any) => a.kaihStatus === 'RENCANA');
    } else if (popupFilterStatus === 'PENDING') {
      list = list.filter((a: any) => a.kaihStatus === 'REALISASI' && (!a.evaluations || a.evaluations.length === 0));
    }

    return list;
  }, [selectedStudentForPopup, popupFilterStatus]);

  // Kelompokkan aktivitas popup per tanggal (terbaru dulu), diurutkan per jam di dalam hari
  const popupGroups = useMemo(() => {
    const getTime = (a: any) =>
      (a.kaihStatus === 'REALISASI' ? a.realizedTime : a.plannedTime) || a.activity_time || '';
    const groups: Record<string, any[]> = {};
    popupActivities.forEach((a: any) => {
      const key = a.activity_date || 'Tanpa Tanggal';
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    });
    return Object.entries(groups)
      .sort(([da], [db]) => db.localeCompare(da))
      .map(([date, acts]) => ({
        date,
        acts: [...acts].sort((x, y) => (getTime(x) || '99:99').localeCompare(getTime(y) || '99:99')),
        getTime
      }));
  }, [popupActivities]);

  // Data Siswa: opsi filter dari biodata & hasil pencarian
  const stuOptions = useMemo(() => {
    const uniq = (key: string) =>
      Array.from(new Set(students.map((s: any) => s[key]).filter((v: any) => v && v !== '-'))).sort() as string[];
    return {
      jenjang: uniq('jenjang'),
      kelas: uniq('kelas'),
      jurusan: uniq('jurusan'),
      gender: uniq('gender'),
      religion: uniq('religion'),
      suku: uniq('suku')
    };
  }, [students]);

  const filteredStudentList = useMemo(() => {
    const q = stuSearch.trim().toLowerCase();
    return students.filter((s: any) => {
      if (q) {
        const hay = [s.name, s.nis, s.nisn, s.email, s.phone, s.address, s.kelas, s.jurusan, s.jenjang, s.suku, s.religion, s.hobbies, s.talents, s.interests]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const f = stuFilters;
      if (f.jenjang !== 'Semua' && s.jenjang !== f.jenjang) return false;
      if (f.kelas !== 'Semua' && s.kelas !== f.kelas) return false;
      if (f.jurusan !== 'Semua' && s.jurusan !== f.jurusan) return false;
      if (f.gender !== 'Semua' && s.gender !== f.gender) return false;
      if (f.religion !== 'Semua' && s.religion !== f.religion) return false;
      if (f.suku !== 'Semua' && s.suku !== f.suku) return false;
      if (f.status !== 'Semua') {
        const acts = activities.filter(a => a.students?.id === s.id);
        const realized = acts.filter(a => a.kaihStatus === 'REALISASI');
        const pending = realized.filter(a => !a.evaluations || a.evaluations.length === 0);
        if (f.status === 'BELUM_INPUT' && acts.length > 0) return false;
        if (f.status === 'AKTIF' && realized.length === 0) return false;
        if (f.status === 'PERLU_NILAI' && pending.length === 0) return false;
      }
      return true;
    });
  }, [students, activities, stuSearch, stuFilters]);
  const isStuFilterActive = stuSearch !== '' || Object.values(stuFilters).some(v => v !== 'Semua');

  // Latest locations of students for Map (Requirement 2 & 5)
  const studentLatestLocations = useMemo(() => {
    const list: any[] = [];

    students.forEach((st) => {
      // Find latest activity with valid GPS coordinates
      const studentActsWithGps = activities
        .filter((a) => a.students?.id === st.id && a.latitude && a.longitude && !isNaN(Number(a.latitude)) && !isNaN(Number(a.longitude)))
        .sort((a, b) => new Date(b.created_at || b.activity_date).getTime() - new Date(a.created_at || a.activity_date).getTime());

      if (studentActsWithGps.length > 0) {
        const latest = studentActsWithGps[0];
        list.push({
          student: st,
          studentId: st.id,
          studentName: st.name,
          photoUrl: st.photo_url,
          latitude: Number(latest.latitude),
          longitude: Number(latest.longitude),
          locationName: latest.location_name || 'Lokasi Aktivitas Siswa',
          lastUpdated: `${latest.activity_date ? formatIndonesianDate(latest.activity_date) : ''} ${latest.realizedTime || latest.activity_time || ''}`.trim(),
          activityTitle: latest.title || latest.activity_categories?.name || 'Aktivitas KAIH',
          source: 'Aktivitas Terkini (Online)'
        });
      } else if (st.latitude && st.longitude && !isNaN(Number(st.latitude)) && !isNaN(Number(st.longitude))) {
        list.push({
          student: st,
          studentId: st.id,
          studentName: st.name,
          photoUrl: st.photo_url,
          latitude: Number(st.latitude),
          longitude: Number(st.longitude),
          locationName: st.address || 'Alamat Terdaftar Siswa',
          lastUpdated: 'Dari Profil Akun',
          activityTitle: 'Titik Lokasi Profil',
          source: 'Biodata Profil'
        });
      }
    });

    return list;
  }, [students, activities]);

  // Group detected student locations by Jenjang / Kelas (Requirement 2)
  const groupedStudentLocations = useMemo(() => {
    const groups: Record<string, any[]> = {};
    studentLatestLocations.forEach((loc) => {
      const groupKey = loc.student.kelas && loc.student.kelas !== '-' 
        ? `${loc.student.jenjang || 'Budi Utomo'} • ${loc.student.kelas}` 
        : (loc.student.jenjang || 'Kelas Terdaftar');

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(loc);
    });
    return groups;
  }, [studentLatestLocations]);

  // Custom DivIcon for Leaflet with Student Photo & Name (Requirement 2)
  const getStudentDivIcon = (studentName: string, photoUrl?: string) => {
    const initials = getInitials(studentName);
    const firstName = studentName.split(' ')[0];

    const html = `
      <div class="clay-student-pin">
        <div class="pin-avatar-wrap">
          <div class="pin-avatar ${!photoUrl ? 'pin-initials' : ''}">
            ${photoUrl 
              ? `<img src="${photoUrl}" alt="${studentName}" onerror="this.style.display='none'" />` 
              : `<span>${initials}</span>`
            }
          </div>
          <div class="pin-status-dot"></div>
        </div>
        <div class="pin-label">${firstName}</div>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-student-div-icon',
      html: html,
      iconSize: [44, 52],
      iconAnchor: [22, 50],
      popupAnchor: [0, -48]
    });
  };

  // Custom DivIcon for Standout School Marker (Requirement 2)
  const getSchoolDivIcon = () => {
    const html = `
      <div class="clay-school-pin">
        <div class="school-pin-badge">
          <span style="font-size: 24px;">🏫</span>
        </div>
        <div class="school-pin-label">🏫 Budi Utomo Standby</div>
      </div>
    `;

    return L.divIcon({
      className: 'leaflet-school-div-icon',
      html: html,
      iconSize: [60, 68],
      iconAnchor: [30, 64],
      popupAnchor: [0, -60]
    });
  };

  // Handle clicking student card below map: Zoom & Pan into marker + open popup (Requirement 2)
  const handleSelectStudentLocation = (loc: any) => {
    setFlyTarget({ lat: loc.latitude, lng: loc.longitude, id: loc.studentId });
    const mapElement = document.getElementById('map-view-container');
    if (mapElement) {
      mapElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      if (markerRefs.current[loc.studentId]) {
        markerRefs.current[loc.studentId].openPopup();
      }
    }, 450);
  };

  const openStudentActivitiesPopup = (cardData: any) => {
    setSelectedStudentForPopup(cardData);
    setPopupFilterStatus('Semua');
    setIsStudentPopupOpen(true);
  };

  const handleBulkEvaluate = async () => {
    if (isReadOnly) return;
    if (bulkRating === 0) { alert('Silakan pilih rating bintang terlebih dahulu.'); return; }
    setIsBulkSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', user?.id).single();
      let { data: teacher } = await supabase.from('teachers').select('id').eq('profile_id', profile?.id).single();
      let teacherId = teacher?.id;
      if (!teacherId && profile?.id) {
        const { data: newTeacher } = await supabase.from('teachers').insert({ profile_id: profile.id }).select('id').single();
        teacherId = newTeacher?.id;
      }
      if (!teacherId) throw new Error('Profil guru tidak ditemukan');

      const pendingActs = (selectedStudentForPopup?.activities || []).filter((a: any) =>
        a.kaihStatus === 'REALISASI' && (!a.evaluations || a.evaluations.length === 0)
      );
      for (const act of pendingActs) {
        await supabase.from('evaluations').insert({
          activity_id: act.id,
          teacher_id: teacherId,
          rating: bulkRating,
          comment: bulkComment
        });
      }
      setIsBulkEvalOpen(false);
      setBulkRating(0);
      setBulkComment('');

      // Instantly sync the popup counters in state
      if (selectedStudentForPopup) {
        setSelectedStudentForPopup((prev: any) => {
          if (!prev) return prev;
          const updatedActs = (prev.activities || []).map((a: any) => {
            const isPending = a.kaihStatus === 'REALISASI' && (!a.evaluations || a.evaluations.length === 0);
            if (isPending) {
              return {
                ...a,
                evaluations: [{ id: 'bulk-' + Date.now(), rating: bulkRating, comment: bulkComment }]
              };
            }
            return a;
          });
          const evaluatedCount = updatedActs.filter((a: any) => a.kaihStatus === 'REALISASI' && a.evaluations && a.evaluations.length > 0).length;
          const pendingCount = 0;
          const realizedCount = updatedActs.filter((a: any) => a.kaihStatus === 'REALISASI').length;
          const plannedCount = updatedActs.filter((a: any) => a.kaihStatus === 'RENCANA').length;
          return {
            ...prev,
            activities: updatedActs,
            evaluatedCount,
            pendingCount,
            realizedCount,
            plannedCount,
          };
        });
      }

      await fetchData();
      alert(`🎉 Berhasil menilai ${pendingActs.length} aktivitas sekaligus!`);
    } catch (e: any) {
      alert('Gagal: ' + (e.message || 'Error'));
    } finally {
      setIsBulkSubmitting(false);
    }
  };

  // Simpan nama & foto saja (tidak menyentuh password)
  const handleSaveProfile = async () => {
    if (!profileForm.fullName.trim()) {
      setProfileMsg({ type: 'error', text: 'Nama lengkap tidak boleh kosong' });
      return;
    }
    setIsProfileSaving(true);
    setProfileMsg(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sesi tidak ditemukan');

      const { error: updErr } = await supabase.from('user_profiles').update({
        full_name: profileForm.fullName.trim(),
        photo_url: profileForm.photoUrl.trim() || null
      }).eq('user_id', user.id);
      if (updErr) throw updErr;

      setTeacherProfile(prev => prev ? {
        ...prev,
        full_name: profileForm.fullName.trim(),
        photo_url: profileForm.photoUrl.trim() || undefined
      } : prev);
      setProfileMsg({ type: 'success', text: 'Profil berhasil diperbarui!' });
    } catch (e: any) {
      setProfileMsg({ type: 'error', text: e.message || 'Gagal menyimpan profil' });
    } finally {
      setIsProfileSaving(false);
    }
  };

  // Ganti password (tombol khusus, terpisah dari profil)
  const handleChangePassword = async () => {
    setPasswordMsg(null);
    if (profileForm.newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'Password baru minimal 6 karakter' });
      return;
    }
    if (profileForm.newPassword !== profileForm.confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' });
      return;
    }
    setIsPasswordSaving(true);
    try {
      const { error: pwErr } = await supabase.auth.updateUser({ password: profileForm.newPassword });
      if (pwErr) throw pwErr;
      setProfileForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' }));
      setPasswordMsg({ type: 'success', text: 'Password berhasil diganti!' });
      setShowPasswordForm(false);
    } catch (e: any) {
      setPasswordMsg({ type: 'error', text: e.message || 'Gagal mengganti password' });
    } finally {
      setIsPasswordSaving(false);
    }
  };

  // Ganti foto profil dari file (otomatis diperkecil, lalu diunggah ke storage; cadangan: data URL)
  const handlePhotoFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setProfileMsg({ type: 'error', text: 'File harus berupa gambar' });
      return;
    }
    setIsPhotoUploading(true);
    setProfileMsg(null);
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal membaca file'));
        reader.readAsDataURL(file);
      });
      const img: HTMLImageElement = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = () => reject(new Error('Gambar tidak valid'));
        im.src = dataUrl;
      });
      const MAX = 400;
      const ratio = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const resized = canvas.toDataURL('image/jpeg', 0.85);

      let finalUrl = resized;
      try {
        const blob: Blob = await new Promise((resolve, reject) =>
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.85)
        );
        const { data: { user } } = await supabase.auth.getUser();
        const path = `profile_photos/${user?.id || 'guru'}_${Date.now()}.jpg`;
        for (const bucket of ['avatars', 'public_assets']) {
          const { error: upErr } = await supabase.storage.from(bucket).upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true
          });
          if (!upErr) {
            finalUrl = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
            break;
          }
        }
      } catch {
        // gunakan data URL sebagai cadangan
      }

      setPhotoError(false);
      setProfileForm(prev => ({ ...prev, photoUrl: finalUrl }));
      setProfileMsg({ type: 'success', text: 'Foto dipilih. Klik "Simpan Profil" untuk menyimpan.' });
    } catch (e: any) {
      setProfileMsg({ type: 'error', text: e.message || 'Gagal memproses foto' });
    } finally {
      setIsPhotoUploading(false);
    }
  };

  const handlePrintBiodata = () => {
    const s = selectedStudentForBiodata;
    if (!s) return;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) return;
    printWindow.document.write(`
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Biodata Siswa - ${s.name}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 0; padding: 24px 32px; }
    .kop { text-align: center; border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 16px; }
    .kop h1 { font-size: 16px; font-weight: bold; margin: 0 0 2px; }
    .kop p { margin: 1px 0; font-size: 11px; }
    .title { text-align: center; font-size: 14px; font-weight: bold; text-decoration: underline; margin: 14px 0 16px; text-transform: uppercase; }
    .photo-section { text-align: center; margin-bottom: 14px; }
    .photo-section img { width: 90px; height: 110px; object-fit: cover; border: 1px solid #aaa; }
    .photo-placeholder { width: 90px; height: 110px; border: 1px solid #aaa; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; color: #999; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    table td { padding: 5px 8px; border: 1px solid #ccc; vertical-align: top; }
    table td:first-child { font-weight: bold; width: 35%; background: #f5f5f5; }
    .ttd-section { margin-top: 30px; display: flex; justify-content: flex-end; }
    .ttd-box { text-align: center; }
    .ttd-box p { margin: 0; }
    .ttd-line { margin-top: 60px; border-top: 1px solid #333; width: 160px; padding-top: 4px; font-weight: bold; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="kop">
    <h1>PERGURUAN BUDI UTOMO BINJAI</h1>
    <p>Jl. S. Hasanuddin No. 35, Binjai, Sumatera Utara</p>
    <p>Telp. (061) 882-xxxx | Email: budutomo@example.com</p>
  </div>
  <div class="title">KETERANGAN BIODATA SISWA</div>
  <div class="photo-section">
    ${s.photo_url ? `<img src="${s.photo_url}" alt="Foto Siswa" />` : '<div class="photo-placeholder">Foto Tidak Tersedia</div>'}
  </div>
  <table>
    <tr><td>Nama Lengkap</td><td>${s.name || '-'}</td></tr>
    <tr><td>NISN</td><td>${s.nisn || '-'}</td></tr>
    <tr><td>NIS</td><td>${s.nis || '-'}</td></tr>
    <tr><td>Jenjang Pendidikan</td><td>${s.jenjang || '-'}</td></tr>
    <tr><td>Kelas / Rombel</td><td>${s.kelas || '-'}</td></tr>
    <tr><td>Jurusan</td><td>${s.jurusan || '-'}</td></tr>
    <tr><td>Jenis Kelamin</td><td>${s.gender || '-'}</td></tr>
    <tr><td>Agama</td><td>${s.religion || '-'}</td></tr>
    <tr><td>Suku / Etnis</td><td>${s.suku || '-'}</td></tr>
    <tr><td>Tanggal Lahir</td><td>${s.birth_date || '-'}</td></tr>
    <tr><td>No. HP / WhatsApp</td><td>${s.phone || '-'}</td></tr>
    <tr><td>Email Akun</td><td>${s.email || '-'}</td></tr>
    <tr><td>Alamat Lengkap</td><td>${s.address || '-'}</td></tr>
    <tr><td>Golongan Darah</td><td>${s.blood_type || '-'}</td></tr>
    <tr><td>Catatan Kesehatan</td><td>${s.health_notes || '-'}</td></tr>
    <tr><td>Hobi</td><td>${s.hobbies || '-'}</td></tr>
    <tr><td>Bakat / Keahlian</td><td>${s.talents || '-'}</td></tr>
    <tr><td>Minat Khusus</td><td>${s.interests || '-'}</td></tr>
    <tr><td>Cita-cita</td><td>${s.aspiration || '-'}</td></tr>
    <tr><td>Ekstrakurikuler</td><td>${s.extracurriculars || '-'}</td></tr>
    <tr><td>Nama Orang Tua / Wali</td><td>${s.parentNotes?.name || '-'}</td></tr>
    <tr><td>No. Telepon Wali</td><td>${s.parentNotes?.phone || '-'}</td></tr>
    <tr><td>Pekerjaan Wali</td><td>${s.parentNotes?.occupation || '-'}</td></tr>
  </table>
  <div class="ttd-section">
    <div class="ttd-box">
      <p>Binjai, ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <p>Guru Wali Kelas,</p>
      <div class="ttd-line">${(teacherProfile?.full_name || 'Guru Wali Kelas')}</div>
      <p style="font-size:10px;color:#555;">Wali Kelas / Guru Pembimbing</p>
    </div>
  </div>
</body>
</html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  const handlePrintRankingReport = () => {
    const printWindow = window.open('', '_blank', 'width=950,height=1000');
    if (!printWindow) return;

    const todayStr = new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const rowsHtml = rankingData.map((item, idx) => {
      const rankBadge = idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`;
      return `
        <tr>
          <td style="text-align: center; font-weight: bold;">${rankBadge}</td>
          <td style="text-align: center;">${item.student.nisn || item.student.nis || '-'}</td>
          <td><b>${item.student.name}</b></td>
          <td style="text-align: center;">${item.student.kelas || item.student.education_level || '-'}</td>
          <td style="text-align: center; font-weight: bold; color: #047857;">${item.realizedCount} / 7</td>
          <td style="text-align: center; color: #b45309; font-weight: bold;">⭐ ${item.avgRating}</td>
          <td style="text-align: center;">${item.attendanceStatus}</td>
          <td style="text-align: center; font-weight: bold; font-size: 13px;">${item.finalScore}</td>
          <td style="text-align: center; font-weight: bold;">${item.predicate}</td>
        </tr>
      `;
    }).join('');

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>Laporan Resmi Analisis Karakter 7 KAIH & Perangkingan Siswa</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body { font-family: 'Times New Roman', serif; font-size: 11pt; color: #111; line-height: 1.3; }
    .kop { display: flex; align-items: center; justify-content: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 12px; }
    .kop-text { text-align: center; flex: 1; }
    .kop-text h2 { margin: 0; font-size: 15pt; text-transform: uppercase; letter-spacing: 0.5px; }
    .kop-text h3 { margin: 2px 0; font-size: 13pt; text-transform: uppercase; }
    .kop-text p { margin: 1px 0; font-size: 9pt; }
    .title-doc { text-align: center; margin: 14px 0 10px 0; }
    .title-doc h4 { margin: 0; font-size: 12pt; text-decoration: underline; text-transform: uppercase; }
    .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
    .meta-table td { padding: 2px 4px; }
    table.data-table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 9.5pt; }
    table.data-table th, table.data-table td { border: 1px solid #333; padding: 6px 8px; }
    table.data-table th { background-color: #f2f2f2; font-weight: bold; text-align: center; }
    .ttd-container { margin-top: 35px; display: flex; justify-content: space-between; page-break-inside: avoid; font-size: 10pt; }
    .ttd-box { width: 220px; text-align: center; }
    .ttd-line { margin-top: 65px; border-top: 1px solid #333; font-weight: bold; padding-top: 4px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="kop">
    <div class="kop-text">
      <h2>${schoolLocation.name.toUpperCase()}</h2>
      <h3>LAPORAN EVALUASI & REKAPITULASI KARAKTER 7 KAIH</h3>
      <p>${schoolLocation.address} ${schoolLocation.phone ? '| Telp: ' + schoolLocation.phone : ''}</p>
    </div>
  </div>

  <div class="title-doc">
    <h4>LAPORAN ANALISIS PRESTASI KARAKTER & PERANGKINGAN SISWA</h4>
  </div>

  <table class="meta-table">
    <tr>
      <td width="20%"><b>Filter Kelas</b></td>
      <td width="30%">: ${rankingClassFilter === 'Semua' ? 'Seluruh Kelas' : rankingClassFilter}</td>
      <td width="20%"><b>Tanggal Cetak</b></td>
      <td width="30%">: ${todayStr}</td>
    </tr>
    <tr>
      <td><b>Total Siswa</b></td>
      <td>: ${rankingData.length} Orang</td>
      <td><b>Bobot Evaluasi</b></td>
      <td>: 7 KAIH (40%) + Bintang Guru (40%) + Presensi (20%)</td>
    </tr>
  </table>

  <table class="data-table">
    <thead>
      <tr>
        <th width="8%">Rank</th>
        <th width="12%">NISN</th>
        <th width="24%">Nama Siswa</th>
        <th width="12%">Kelas</th>
        <th width="10%">7 KAIH</th>
        <th width="10%">Guru ⭐</th>
        <th width="10%">Presensi</th>
        <th width="8%">Skor</th>
        <th width="16%">Predikat</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="ttd-container">
    <div class="ttd-box">
      <p>Mengetahui,</p>
      <p><b>Kepala Sekolah</b></p>
      <div class="ttd-line">Drs. H. Syahrul, M.Pd</div>
      <p style="font-size: 8.5pt; margin-top: 2px;">NIP. 19680512 199303 1 004</p>
    </div>

    <div class="ttd-box">
      <p>Binjai, ${todayStr}</p>
      <p><b>Koordinator Karakter 7 KAIH</b></p>
      <div class="ttd-line">${teacherProfile?.full_name || 'Pembina Karakter Siswa'}</div>
      <p style="font-size: 8.5pt; margin-top: 2px;">Guru Pembina / Wali Kelas</p>
    </div>
  </div>
</body>
</html>`);

    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  if (loading) {
    return (
      <KaihLoadingScreen
        message={
          isKepsek
            ? 'Menyiapkan Portal Kepala Sekolah (Monitoring)...'
            : isYayasan
            ? 'Menyiapkan Portal Yayasan (Executive Monitoring)...'
            : 'Menyiapkan Portal Guru Budi Utomo...'
        }
        subMessage="Sinkronisasi data aktivitas 7 KAIH & absensi siswa"
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-slate-800 font-sans flex flex-col lg:flex-row antialiased text-xs sm:text-sm selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* ================= LEFT SIDEBAR (STICKY CLAY MORPHISM - REQUIREMENT 2 & 3) ================= */}
      <aside className="w-full lg:w-60 xl:w-64 shrink-0 p-3 lg:p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto">
        <div className="clay-sidebar p-4 flex flex-col justify-between h-full gap-4">
          
          <div className="space-y-4">
            {/* Teacher Profile Widget in Sidebar */}
            <div className="flex flex-col items-center text-center p-2">
              <div className="relative mb-2">
                {teacherProfile?.photo_url ? (
                  <img 
                    src={teacherProfile.photo_url} 
                    alt="Guru" 
                    className="w-13 h-13 rounded-full object-cover border-3 border-white shadow-md"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 text-white flex items-center justify-center text-lg font-black border-3 border-white shadow-md">
                    {getInitials(teacherProfile?.full_name || (isKepsek ? 'Kepala Sekolah' : isYayasan ? 'Yayasan' : 'Guru'))}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" title="Online"></span>
              </div>
              
              <h2 className="font-bold text-slate-900 text-sm leading-tight line-clamp-1">
                Hi, {teacherProfile?.full_name || (isKepsek ? 'Kepala Sekolah' : isYayasan ? 'Pengurus Yayasan' : 'Bapak/Ibu Guru')} ☀️
              </h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                {currentUserRole === 'admin'
                  ? 'Super Administrator (Akses Semua Kelas)'
                  : currentUserRole === 'kepsek'
                  ? 'Kepala Sekolah (Executive Monitoring)'
                  : currentUserRole === 'yayasan'
                  ? 'Pengurus Yayasan (Executive Monitoring)'
                  : teacherSubjects
                  ? `Pengajar: ${teacherSubjects}`
                  : 'Guru Wali Kelas & Pengajar'}
              </p>
              {isReadOnly && (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  <span className="text-[9px] font-extrabold bg-sky-100 text-sky-800 px-2 py-0.5 rounded-full border border-sky-200">
                    Mode Pemantauan (Hanya Lihat)
                  </span>
                  <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                    Akses Seluruh Kelas
                  </span>
                </div>
              )}
              {currentUserRole === 'guru' && (
                <div className="mt-1.5 flex flex-wrap justify-center gap-1">
                  {teacherAssignedClasses.length === 0 || teacherAssignedClasses.includes('SEMUA_KELAS') ? (
                    <span className="text-[9px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                      Kelas Ajar: Semua Kelas
                    </span>
                  ) : (
                    teacherAssignedClasses.map((cls) => (
                      <span
                        key={cls}
                        className="text-[9px] font-extrabold bg-teal-100 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200"
                      >
                        {cls}
                      </span>
                    ))
                  )}
                </div>
              )}
              {currentUserRole === 'admin' && (
                <a
                  href="/admin"
                  className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold shadow-xs transition-colors"
                >
                  <span>🛡️ Kembali ke Panel Admin</span>
                </a>
              )}
            </div>

            {/* Navigation Menu (Puffy Clay Pills) */}
            <nav className="flex flex-col space-y-1.5">
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'dashboard' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <LayoutDashboard size={15} />
                </div>
                <span className="flex-1">Dashboard</span>
              </button>

              <button
                onClick={() => setActiveTab('feed')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'feed'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'feed' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <ActivityIcon size={15} />
                </div>
                <span className="flex-1">Aktivitas Siswa</span>
                {stats.pending > 0 && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-1.5 py-0.5 rounded-full shadow-2xs">
                    {stats.pending}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab('attendance')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'attendance' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <UserCheck size={15} />
                </div>
                <span className="flex-1">Absensi Siswa</span>
                <span className="text-[10px] font-semibold text-slate-400">
                  {students.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('students')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'students'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'students' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <Users size={15} />
                </div>
                <span className="flex-1">Data Siswa</span>
              </button>

              <button
                onClick={() => setActiveTab('map')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'map'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'map' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <MapLocationIcon size={15} />
                </div>
                <span className="flex-1">Peta Sebaran</span>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded-md">
                  {studentLatestLocations.length}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center px-3.5 py-2.5 rounded-2xl font-bold text-xs transition-all text-left cursor-pointer ${
                  activeTab === 'profile'
                    ? 'clay-pill-active text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <div className={`p-1.5 rounded-xl mr-2.5 ${activeTab === 'profile' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/60 text-slate-600'}`}>
                  <Settings size={15} />
                </div>
                <span className="flex-1">Profil Saya</span>
              </button>
            </nav>
          </div>

          {/* Bottom Actions */}
          <div className="pt-3 border-t border-[#D5E5DA]">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center py-2 px-3 bg-white/80 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-xl font-bold text-xs border border-white transition-all cursor-pointer shadow-2xs"
            >
              <LogOut size={13} className="mr-1.5" /> Keluar Akun
            </button>
          </div>
        </div>
      </aside>

      {/* ================= MAIN CONTENT (3D CLAY THEME - REQUIREMENT 3) ================= */}
      <main className="flex-1 min-w-0 p-3 sm:p-4 lg:p-5 flex flex-col space-y-4">
        
        {/* Top Header Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <img src="/kaih_logo.png" alt="7 KAIH" className="w-7 h-7 object-contain" />
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' ? 'Dashboard'
                : activeTab === 'feed' ? 'Aktivitas Siswa'
                : activeTab === 'attendance' ? 'Absensi Siswa'
                : activeTab === 'students' ? 'Data Siswa'
                : activeTab === 'map' ? 'Peta Sebaran'
                : 'Profil Saya'}
            </h1>
            <span className={`font-black text-[10px] px-2.5 py-0.5 rounded-full border shadow-2xs uppercase tracking-wide ${
              currentUserRole === 'admin'
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : currentUserRole === 'kepsek'
                ? 'bg-sky-100 text-sky-800 border-sky-200'
                : currentUserRole === 'yayasan'
                ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                : 'bg-[#FEF5D1] text-[#9A7314] border-[#FBE69B]'
            }`}>
              {currentUserRole === 'admin'
                ? 'SUPER ADMIN'
                : currentUserRole === 'kepsek'
                ? 'KEPALA SEKOLAH (MONITORING)'
                : currentUserRole === 'yayasan'
                ? 'YAYASAN (EXECUTIVE MONITORING)'
                : 'GURU KELAS'}
            </span>

            {/* Class Filter Switcher for Guru's Assigned Classes */}
            {(() => {
              const availableScopeClasses =
                currentUserRole === 'guru' &&
                teacherAssignedClasses.length > 0 &&
                !teacherAssignedClasses.includes('SEMUA_KELAS')
                  ? teacherAssignedClasses
                  : Array.from(new Set(allStudentsRaw.map((s) => s.kelas).filter(Boolean)));

              return (
                <div className="flex items-center gap-1.5 flex-wrap ml-1">
                  <button
                    type="button"
                    onClick={() => setActiveClassScope('ALL_ASSIGNED')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                      activeClassScope === 'ALL_ASSIGNED'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-emerald-50'
                    }`}
                  >
                    {currentUserRole === 'guru' &&
                    teacherAssignedClasses.length > 0 &&
                    !teacherAssignedClasses.includes('SEMUA_KELAS')
                      ? `Semua Kelas Ajar Saya (${teacherAssignedClasses.length})`
                      : `Semua Kelas (${allStudentsRaw.length} Siswa)`}
                  </button>
                  {availableScopeClasses.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setActiveClassScope(cls)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                        activeClassScope === cls
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-teal-50'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              );
            })()}

            {/* Tombol Laporan Analisa & Perangkingan Siswa (Issue 6) */}
            <button
              type="button"
              onClick={() => setIsRankingReportOpen(true)}
              className="clay-btn-coral px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
              title="Buka Laporan Analisa & Perangkingan Karakter Siswa Lengkap"
            >
              <Award size={14} />
              <span>Laporan Analisa & Ranking</span>
            </button>
          </div>

          {/* Mobile Tab Pill Scroller */}
          <div className="flex lg:hidden overflow-x-auto w-full gap-1.5 py-1 scrollbar-none">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'dashboard' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('feed')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'feed' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Aktivitas
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'attendance' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Absensi
            </button>
            <button
              onClick={() => setActiveTab('students')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'students' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Data Siswa
            </button>
            <button
              onClick={() => setActiveTab('map')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'map' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Peta ({studentLatestLocations.length})
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 ${activeTab === 'profile' ? 'clay-btn-coral' : 'clay-btn-white'}`}
            >
              Profil
            </button>
          </div>
        </header>

        {/* Supabase RLS Fix Alert Banner for Monitoring Accounts (Issue 5) */}
        {allActivitiesRaw.length === 0 && students.length > 0 && isReadOnly && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h4 className="text-xs sm:text-sm font-bold text-amber-950">
                  Data Aktivitas/Absensi Tampil Nol (0) untuk Peran {currentUserRole.toUpperCase()}
                </h4>
                <p className="text-[11px] text-amber-800">
                  Supabase Row Level Security (RLS) pada server membatasi akses query hanya untuk guru. Jalankan skrip perbaikan SQL di Supabase SQL Editor agar Yayasan & Kepsek dapat melihat seluruh data.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;\nALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;\nALTER TABLE public.evaluations DISABLE ROW LEVEL SECURITY;`);
                alert("✅ Skrip SQL Perbaikan RLS telah disalin! Paste dan jalankan di Supabase Studio SQL Editor.");
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0 cursor-pointer shadow-xs"
            >
              📋 Salin Skrip Perbaikan SQL
            </button>
          </div>
        )}

        {/* ================= TAB 0: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (() => {
          // Leaderboard: top 10 students by realisasi count
          const leaderboardData = [...studentActivityCards]
            .filter(c => c.realizedCount > 0)
            .sort((a, b) => b.realizedCount - a.realizedCount)
            .slice(0, 10)
            .map(c => ({ name: c.student.name.split(' ')[0], Realisasi: c.realizedCount }));

          // Attendance donut
          const attValues = Object.values(attendanceRecords);
          const attPieData = [
            { name: 'Tepat Waktu', value: attValues.filter(r => r.status === 'Tepat Waktu').length, color: '#10b981' },
            { name: 'Terlambat', value: attValues.filter(r => r.status === 'Terlambat').length, color: '#f59e0b' },
            { name: 'Alpha', value: attValues.filter(r => r.status === 'Alpha').length, color: '#f43f5e' },
            { name: 'Izin', value: attValues.filter(r => r.status === 'Izin').length, color: '#3b82f6' },
            { name: 'Sakit', value: attValues.filter(r => r.status === 'Sakit').length, color: '#a855f7' },
          ].filter(d => d.value > 0);

          // Kelas breakdown
          const kelasMap: Record<string, number> = {};
          students.forEach(s => {
            const k = s.kelas || 'Lainnya';
            kelasMap[k] = (kelasMap[k] || 0) + 1;
          });
          const kelasData = Object.entries(kelasMap).map(([name, Siswa]) => ({ name, Siswa }));

          // KAIH category distribution
          const kaihMap: Record<string, number> = {};
          activities.filter(a => a.kaihStatus === 'REALISASI').forEach(a => {
            const cat = a.activity_categories?.name || 'Lainnya';
            kaihMap[cat] = (kaihMap[cat] || 0) + 1;
          });
          const kaihData = Object.entries(kaihMap).map(([name, Total]) => ({ name, Total }));

          return (
            <section className="space-y-4">
              {/* Hero Welcome Banner */}
              <div className="clay-banner-peach p-4 sm:p-5 flex flex-col md:flex-row justify-between items-center gap-4 relative overflow-hidden">
                <div className="space-y-2 min-w-0 flex-1 text-center md:text-left">
                  <div className="inline-flex items-center gap-1.5 bg-white/90 backdrop-blur-xs text-orange-950 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-orange-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Semester Genap • Tahun Ajaran Aktif 2026/2027
                  </div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                    {isReadOnly ? 'Selamat Datang' : 'Selamat Mengajar'}, {teacherProfile?.full_name || (isKepsek ? 'Kepala Sekolah' : isYayasan ? 'Pengurus Yayasan' : 'Bapak/Ibu Guru')}! ☀️
                  </h2>
                  <p className="text-[11px] md:text-[clamp(9px,0.95vw,12px)] md:whitespace-nowrap text-slate-700 leading-relaxed font-medium">
                    {isReadOnly
                      ? 'Pantau rekapitulasi rencana & realisasi 7 KAIH siswa, tinjau absensi harian kelas, serta pantau statistik perkembangan karakter secara realtime (Mode Pemantauan).'
                      : 'Pantau rencana & realisasi 7 KAIH siswa, kelola absensi harian, dan berikan penilaian evaluasi kegiatan dengan lebih hangat dan menyenangkan hari ini.'}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1 justify-center md:justify-start">
                    <button
                      onClick={() => setActiveTab('feed')}
                      className="clay-btn-coral px-3.5 py-1.5 font-bold text-xs rounded-2xl flex items-center cursor-pointer"
                    >
                      <ActivityIcon size={13} className="mr-1.5" /> Aktivitas Siswa
                    </button>
                    <button
                      onClick={() => setActiveTab('attendance')}
                      className="clay-btn-white px-3.5 py-1.5 font-bold text-xs rounded-2xl flex items-center cursor-pointer"
                    >
                      <UserCheck size={13} className="mr-1.5 text-orange-600" /> Absensi Siswa
                    </button>
                    <button
                      onClick={() => setActiveTab('students')}
                      className="clay-btn-white px-3.5 py-1.5 font-bold text-xs rounded-2xl flex items-center cursor-pointer"
                    >
                      <Users size={13} className="mr-1.5 text-orange-600" /> Data Siswa
                    </button>
                    <button
                      onClick={() => setActiveTab('map')}
                      className="clay-btn-white px-3.5 py-1.5 font-bold text-xs rounded-2xl flex items-center cursor-pointer"
                    >
                      <MapLocationIcon size={13} className="mr-1.5 text-orange-600" /> Peta Sebaran
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="clay-btn-white px-3.5 py-1.5 font-bold text-xs rounded-2xl flex items-center cursor-pointer"
                    >
                      <Settings size={13} className="mr-1.5 text-orange-600" /> Profil Saya
                    </button>
                  </div>
                </div>
                <div className="shrink-0 hidden md:flex items-center justify-center">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/80 border-3 border-white shadow-md flex items-center justify-center text-2xl sm:text-3xl">
                    🎓
                  </div>
                </div>
              </div>

              {/* 4 Clay Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="clay-metric-mint p-3 sm:p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">Realisasi Ceklis</p>
                    <p className="text-xl sm:text-2xl font-black text-[#1E4D38] mt-0.5">{stats.realized}</p>
                    <p className="text-[10px] text-[#2D6A4F]/80 font-medium">Aktivitas selesai</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#D5EADF] text-[#2D6A4F] flex items-center justify-center shadow-xs">
                    <CheckCircle size={18} />
                  </div>
                </div>
                <div className="clay-metric-peach p-3 sm:p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A64539]">Rencana 7 KAIH</p>
                    <p className="text-xl sm:text-2xl font-black text-[#873429] mt-0.5">{stats.planned}</p>
                    <p className="text-[10px] text-[#A64539]/80 font-medium">Menunggu realisasi</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#FCDDD3] text-[#A64539] flex items-center justify-center shadow-xs">
                    <ClipboardList size={18} />
                  </div>
                </div>
                <div className="clay-metric-honey p-3 sm:p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#9E6914]">Telah Dinilai</p>
                    <p className="text-xl sm:text-2xl font-black text-[#7D520D] mt-0.5">{stats.evaluated}</p>
                    <p className="text-[10px] text-[#9E6914]/80 font-medium">Diberi bintang & catatan</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#FBEAC4] text-[#9E6914] flex items-center justify-center shadow-xs">
                    <Star size={18} className="fill-amber-400 text-amber-500" />
                  </div>
                </div>
                <div className="clay-metric-blue p-3 sm:p-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#29569B]">Perlu Penilaian</p>
                    <p className="text-xl sm:text-2xl font-black text-[#1C3E73] mt-0.5">{stats.pending}</p>
                    <p className="text-[10px] text-[#29569B]/80 font-medium">Menunggu respon guru</p>
                  </div>
                  <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#D3E3FD] text-[#29569B] flex items-center justify-center shadow-xs">
                    <Sparkles size={18} />
                  </div>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Leaderboard Bar Chart */}
                <div className="clay-box p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-emerald-600" /> Top 10 Siswa Teraktif
                  </h3>
                  {leaderboardData.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada data aktivitas.</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={leaderboardData} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 10 }} />
                          <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                          <Bar dataKey="Realisasi" fill="#059669" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Attendance Donut */}
                <div className="clay-box p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <UserCheck size={16} className="text-emerald-600" /> Ringkasan Absensi Hari Ini
                  </h3>
                  {attPieData.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada data absensi hari ini.</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={attPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                            {attPieData.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Kelas/Jurusan Bar Chart */}
                <div className="clay-box p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <Users size={16} className="text-emerald-600" /> Persebaran per Kelas
                  </h3>
                  {kelasData.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada data kelas.</p>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kelasData} margin={{ top: 4, right: 10, left: -10, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-20} textAnchor="end" />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="Siswa" fill="#6366f1" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* KAIH Category Distribution */}
                <div className="clay-box p-4 space-y-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <ActivityIcon size={16} className="text-emerald-600" /> Distribusi Kategori KAIH
                  </h3>
                  {kaihData.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Belum ada realisasi aktivitas.</p>
                  ) : (
                    <div className="h-48">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={kaihData} margin={{ top: 4, right: 10, left: -10, bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 8 }} angle={-30} textAnchor="end" />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Bar dataKey="Total" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {/* ================= TAB 1: FEED & DAFTAR SISWA ================= */}
        {activeTab === 'feed' && (
          <section className="space-y-4">

            {/* 4 Metric Cards (feed tab) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
              <div className="clay-metric-mint p-3 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#2D6A4F]">Realisasi Ceklis</p>
                  <p className="text-xl sm:text-2xl font-black text-[#1E4D38] mt-0.5">{stats.realized}</p>
                  <p className="text-[10px] text-[#2D6A4F]/80 font-medium">Aktivitas selesai</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#D5EADF] text-[#2D6A4F] flex items-center justify-center shadow-xs">
                  <CheckCircle size={18} />
                </div>
              </div>
              <div className="clay-metric-peach p-3 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#A64539]">Rencana 7 KAIH</p>
                  <p className="text-xl sm:text-2xl font-black text-[#873429] mt-0.5">{stats.planned}</p>
                  <p className="text-[10px] text-[#A64539]/80 font-medium">Menunggu realisasi</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#FCDDD3] text-[#A64539] flex items-center justify-center shadow-xs">
                  <ClipboardList size={18} />
                </div>
              </div>
              <div className="clay-metric-honey p-3 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#9E6914]">Telah Dinilai</p>
                  <p className="text-xl sm:text-2xl font-black text-[#7D520D] mt-0.5">{stats.evaluated}</p>
                  <p className="text-[10px] text-[#9E6914]/80 font-medium">Diberi bintang & catatan</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#FBEAC4] text-[#9E6914] flex items-center justify-center shadow-xs">
                  <Star size={18} className="fill-amber-400 text-amber-500" />
                </div>
              </div>
              <div className="clay-metric-blue p-3 sm:p-3.5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#29569B]">Perlu Penilaian</p>
                  <p className="text-xl sm:text-2xl font-black text-[#1C3E73] mt-0.5">{stats.pending}</p>
                  <p className="text-[10px] text-[#29569B]/80 font-medium">Menunggu respon guru</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-white/90 border border-[#D3E3FD] text-[#29569B] flex items-center justify-center shadow-xs">
                  <Sparkles size={18} />
                </div>
              </div>
            </div>
            {/* Filter & Dedicated Search Toolbar */}
            <div className="clay-box p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2.5">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <ActivityIcon size={16} className="text-emerald-600" />
                    Aktivitas Siswa & Ringkasan Harian
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isReadOnly
                      ? 'Klik kartu siswa untuk melihat rincian aktivitas dan riwayat evaluasi (Mode Pemantauan).'
                      : 'Klik kartu siswa untuk membuka jendela penilaian aktivitasnya.'}
                  </p>
                </div>

                {/* View toggle */}
                <div className="bg-[#F4F1EA] p-1 rounded-xl flex items-center text-[11px] font-bold border border-[#E8E3D8]">
                  <button
                    onClick={() => setStudentViewMode('all')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      studentViewMode === 'all' ? 'clay-btn-white' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Semua Siswa ({students.length})
                  </button>
                  <button
                    onClick={() => setStudentViewMode('with_activities')}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                      studentViewMode === 'with_activities' ? 'clay-btn-white text-emerald-800' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Hanya yang Beraktivitas
                  </button>
                </div>
              </div>

              {/* Search Bar + Filters + Reset Button Row */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
                <div className="relative flex-1 min-w-[200px] sm:min-w-[240px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Cari nama siswa, kegiatan, atau catatan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-7 py-1.5 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:bg-white"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X size={12} />
                    </button>
                  )}
                </div>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="bg-white border border-[#E5E0D5] text-slate-700 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-2xs"
                >
                  <option value="Semua">Semua Status</option>
                  <option value="REALISASI">✅ Realisasi Selesai</option>
                  <option value="RENCANA">📅 Rencana Belum Ceklis</option>
                  <option value="PENDING_EVAL">⭐ Menunggu Penilaian</option>
                </select>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-[#E5E0D5] text-slate-700 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-2xs"
                >
                  <option value="Semua">Semua 7 KAIH</option>
                  {KAIH_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="bg-white border border-[#E5E0D5] text-slate-700 text-xs font-semibold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-2xs"
                >
                  <option value="Semua">Semua Waktu</option>
                  <option value="Hari Ini">Hari Ini</option>
                  <option value="Kemarin">Kemarin</option>
                  <option value="Besok">Besok (Rencana)</option>
                </select>

                <button
                  onClick={resetAllFilters}
                  disabled={!isFilterActive}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center cursor-pointer ${
                    isFilterActive
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 shadow-2xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  }`}
                  title="Kembalikan semua filter ke awal"
                >
                  <RotateCcw size={12} className="mr-1.5" />
                  Reset Filter
                </button>
              </div>
            </div>

            {/* Student Cards Grid Grouped By Class with A-Z sorting (Issue 2 & Issue 3) */}
            {studentActivityCards.length === 0 ? (
              <div className="clay-box p-10 text-center border-dashed">
                <Search size={32} className="mx-auto text-slate-300 mb-2" />
                <h4 className="font-bold text-slate-700 text-sm">Tidak Ada Data Siswa Ditemukan</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Coba gunakan tombol Reset Filter untuk menampilkan seluruh siswa kembali.</p>
                <button onClick={resetAllFilters} className="mt-3 px-3.5 py-1.5 clay-btn-coral font-bold text-xs rounded-xl">
                  Reset Filter Sekarang
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedStudentCards.map(({ className, cards }) => (
                  <div key={className} className="space-y-2.5">
                    {/* Pembatas Antar Kelas */}
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-xs px-3.5 py-2 rounded-2xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm">
                          🏫 Kelas: {className}
                        </h3>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {cards.length} Siswa
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">Urutan Nama A - Z</span>
                    </div>

                    {/* 4 Kolom Grid Responsif */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-4 gap-2.5">
                      {cards.map((card) => {
                        const hasActs = card.activities.length > 0;
                        const studentName = card.student.name || 'Siswa';
                        const studentPhoto = card.student.photo_url || null;

                        return (
                          <div
                            key={card.student.id}
                            onClick={() => openStudentActivitiesPopup(card)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openStudentActivitiesPopup(card); } }}
                            title="Klik untuk membuka penilaian aktivitas"
                            className="clay-box p-2.5 hover:-translate-y-0.5 transition-all flex items-center gap-2.5 group cursor-pointer"
                          >
                            {/* Foto siswa ringkas agar 4 kolom muat pas */}
                            <div className="relative shrink-0">
                              {studentPhoto ? (
                                <img
                                  src={studentPhoto}
                                  alt={studentName}
                                  className="w-12 h-12 rounded-2xl object-cover border-2 border-white shadow-2xs ring-2 ring-emerald-100"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-white font-black text-sm flex items-center justify-center border-2 border-white shadow-2xs ring-2 ring-emerald-100">
                                  {getInitials(studentName)}
                                </div>
                              )}
                              {card.pendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 min-w-4.5 h-4.5 px-1 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                                  {card.pendingCount}
                                </span>
                              )}
                            </div>

                            {/* Info ringkas */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-bold text-slate-900 text-xs leading-snug group-hover:text-emerald-700 transition-colors truncate">
                                  {studentName}
                                </h4>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                {card.student.kelas || card.student.education_level || 'Kelas Budi Utomo'}
                              </p>
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {hasActs ? (
                                  <>
                                    <span className="text-[9px] font-bold bg-[#E7F3EC] text-[#245D43] px-1.5 py-0.5 rounded-md border border-[#D5EADF]">
                                      ✅ {card.realizedCount}
                                    </span>
                                    <span className="text-[9px] font-bold bg-[#FEEFEA] text-[#A64539] px-1.5 py-0.5 rounded-md border border-[#FCDDD3]">
                                      📅 {card.plannedCount}
                                    </span>
                                    {card.pendingCount > 0 ? (
                                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded-md">
                                        Perlu Nilai
                                      </span>
                                    ) : card.realizedCount > 0 ? (
                                      <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded-md">
                                        Dinilai
                                      </span>
                                    ) : null}
                                  </>
                                ) : (
                                  <span className="text-[9px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                    Belum ada aktivitas
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================= TAB 2: INPUT ABSENSI SISWA ================= */}
        {activeTab === 'attendance' && (
          <section className="clay-box p-4 sm:p-5 space-y-4">
            
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                  <UserCheck size={18} className="text-emerald-600" />
                  Presensi & Absensi Siswa
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {isReadOnly
                    ? 'Tinjau rekapitulasi kehadiran siswa harian secara realtime (Mode Pemantauan Eksekutif).'
                    : 'Input kehadiran harian kelas untuk tanggal yang dipilih secara real-time.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-2.5 py-1.5 rounded-xl border border-[#EDE8E0] shadow-2xs">
                  <Calendar size={14} className="text-emerald-600" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                  />
                </div>

                {!isReadOnly && (
                  <div className="flex items-center gap-1.5 bg-[#FAF8F5] px-2.5 py-1.5 rounded-xl border border-[#EDE8E0] shadow-2xs">
                    <Clock size={14} className="text-amber-600" />
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none"
                    />
                  </div>
                )}

                {isReadOnly ? (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 text-sky-800 border border-sky-200 text-xs font-bold">
                    <span>👁️ Mode Pemantauan (Hanya Lihat)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={handleMarkAllPresent}
                      className="clay-btn-white px-3 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer text-emerald-800 flex items-center gap-1 shadow-2xs"
                      title="Setel semua siswa menjadi Tepat Waktu"
                    >
                      <CheckCircle size={13} />
                      <span>Semua Tepat Waktu</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetAllAttendance}
                      className="clay-btn-white px-3 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer text-slate-600 hover:text-rose-600 flex items-center gap-1 shadow-2xs"
                      title="Kembalikan status presensi menjadi Belum Diabsen"
                    >
                      <RotateCcw size={13} />
                      <span>Reset Pilihan</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Attendance Status Pills Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="clay-metric-mint p-2.5 text-center">
                <span className="text-[9px] font-bold text-emerald-800 uppercase">Tepat Waktu</span>
                <p className="text-lg font-black text-emerald-700">{attStats.tepatWaktu}</p>
              </div>
              <div className="clay-metric-peach p-2.5 text-center">
                <span className="text-[9px] font-bold text-amber-800 uppercase">Terlambat</span>
                <p className="text-lg font-black text-amber-700">{attStats.terlambat}</p>
              </div>
              <div className="clay-metric-blue p-2.5 text-center">
                <span className="text-[9px] font-bold text-blue-800 uppercase">Izin</span>
                <p className="text-lg font-black text-blue-700">{attStats.izin}</p>
              </div>
              <div className="clay-box-sm p-2.5 text-center bg-purple-50/70 border-purple-200">
                <span className="text-[9px] font-bold text-purple-800 uppercase">Sakit</span>
                <p className="text-lg font-black text-purple-700">{attStats.sakit}</p>
              </div>
              <div className="clay-box-sm p-2.5 text-center bg-rose-50/70 border-rose-200">
                <span className="text-[9px] font-bold text-rose-800 uppercase">Alpha</span>
                <p className="text-lg font-black text-rose-700">{attStats.alpha}</p>
              </div>
              <div className="clay-box-sm p-2.5 text-center bg-slate-50/70 border-slate-200">
                <span className="text-[9px] font-bold text-slate-600 uppercase">Belum Diabsen</span>
                <p className="text-lg font-black text-slate-700">{attStats.belumInput}</p>
              </div>
            </div>

            {/* Attendance Table */}
            <div className="clay-box-sm overflow-hidden">
              <div className="p-2.5 bg-[#FAF8F5] border-b border-[#ECE7DE] flex flex-wrap justify-between items-center gap-2">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <input
                    type="text"
                    placeholder="Cari siswa di absensi..."
                    value={attSearchTerm}
                    onChange={(e) => setAttSearchTerm(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-[#E0DCD3] rounded-xl text-xs font-medium w-full sm:w-52 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />

                  {/* Filter Per-Kelas untuk menentukan kelas mana yang mau diabsen (Issue 1) */}
                  <div className="flex items-center gap-1.5 bg-white border border-[#E0DCD3] rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500">🏫 Kelas:</span>
                    <select
                      value={attClassFilter}
                      onChange={(e) => setAttClassFilter(e.target.value)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                    >
                      <option value="Semua">Semua Kelas ({students.length} Siswa)</option>
                      {availableAttClasses.map((cls) => (
                        <option key={cls} value={cls}>
                          Kelas {cls}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tombol Reset Filter untuk filter absensi (Issue 1) */}
                  {(attSearchTerm !== '' || attFilterStatus !== 'Semua' || attClassFilter !== 'Semua') && (
                    <button
                      type="button"
                      onClick={resetAttFilters}
                      className="clay-btn-white px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                      title="Reset semua pencarian & filter absensi"
                    >
                      <RotateCcw size={12} />
                      <span>Reset Filter</span>
                    </button>
                  )}
                </div>

                <select
                  value={attFilterStatus}
                  onChange={(e) => setAttFilterStatus(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-[#E0DCD3] rounded-xl text-xs font-semibold text-slate-700 focus:outline-none shrink-0"
                >
                  <option value="Semua">Semua Status Siswa</option>
                  <option value="Belum Diabsen">Belum Diabsen</option>
                  <option value="Tepat Waktu">Tepat Waktu</option>
                  <option value="Terlambat">Terlambat</option>
                  <option value="Izin">Izin</option>
                  <option value="Sakit">Sakit</option>
                  <option value="Alpha">Alpha</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#FAF8F5] border-b border-[#ECE7DE] text-slate-500 uppercase font-bold text-[9px]">
                    <tr>
                      <th className="px-4 py-2.5">Siswa</th>
                      <th className="px-4 py-2.5">Status Kehadiran</th>
                      <th className="px-4 py-2.5">Jam Masuk</th>
                      <th className="px-4 py-2.5">Catatan</th>
                      {!isReadOnly && <th className="px-4 py-2.5 text-right">Aksi</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {sortedAttStudents.map((s, idx) => {
                      const rec = attendanceRecords[s.id] || { status: '', notes: '', time: selectedTime };
                      const currentClass = s.kelas || s.education_level || 'Kelas Budi Utomo';
                      const prevStudent = idx > 0 ? sortedAttStudents[idx - 1] : null;
                      const prevClass = prevStudent ? (prevStudent.kelas || prevStudent.education_level || 'Kelas Budi Utomo') : null;
                      const isNewClass = idx === 0 || currentClass !== prevClass;
                      const classStudentsCount = sortedAttStudents.filter((st) => (st.kelas || st.education_level || 'Kelas Budi Utomo') === currentClass).length;

                      return (
                        <React.Fragment key={s.id}>
                          {isNewClass && (
                            <tr className="bg-gradient-to-r from-emerald-100/90 via-teal-50 to-slate-50 border-y-2 border-emerald-300">
                              <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                                    <span className="font-extrabold text-emerald-950 text-xs sm:text-[13px] tracking-wide">
                                      🏫 Kelas: {currentClass}
                                    </span>
                                    <span className="text-[10px] font-bold text-emerald-800 bg-white/90 px-2 py-0.5 rounded-md border border-emerald-200">
                                      {classStudentsCount} Siswa
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 font-medium">Urutan Nama A - Z</span>
                                </div>
                              </td>
                            </tr>
                          )}
                          <tr className="hover:bg-[#FAF8F5]/80 transition-colors">
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2.5">
                                {s.photo_url ? (
                                  <img src={s.photo_url} alt={s.name} className="w-7 h-7 rounded-full object-cover border border-slate-200" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px] flex items-center justify-center">
                                    {getInitials(s.name)}
                                  </div>
                                )}
                                <span className="font-bold text-slate-800 text-xs">{s.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {isReadOnly ? (
                                <span className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold ${
                                  rec.status === 'Tepat Waktu' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                  rec.status === 'Terlambat' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                  rec.status === 'Izin' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                                  rec.status === 'Sakit' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                                  rec.status === 'Alpha' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                                  'bg-slate-100 text-slate-500'
                                }`}>
                                  {rec.status || 'Belum Diabsen'}
                                </span>
                              ) : (
                                <div className="flex flex-wrap gap-1">
                                  {ATTENDANCE_STATUSES.map(st => (
                                    <button
                                      key={st.value}
                                      type="button"
                                      onClick={() => handleStatusChange(s.id, st.value)}
                                      className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all cursor-pointer ${
                                        rec.status === st.value
                                          ? `${st.color} shadow-xs scale-105`
                                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                      }`}
                                    >
                                      {st.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isReadOnly ? (
                                <span className="text-xs font-mono font-bold text-slate-700">{rec.time || '--:--'}</span>
                              ) : (
                                <input
                                  type="time"
                                  value={rec.time || selectedTime}
                                  onChange={(e) => handleTimeChange(s.id, e.target.value)}
                                  className="px-1.5 py-0.5 bg-[#FAF8F5] border border-slate-200 rounded text-xs font-bold focus:outline-none"
                                />
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {isReadOnly ? (
                                <span className="text-xs text-slate-600 italic">{rec.notes || '-'}</span>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Catatan..."
                                  value={rec.notes || ''}
                                  onChange={(e) => handleNotesChange(s.id, e.target.value)}
                                  className="w-full px-2 py-0.5 bg-white border border-slate-200 rounded text-xs focus:outline-none"
                                />
                              )}
                            </td>
                            {!isReadOnly && (
                              <td className="px-4 py-2.5 text-right">
                                <button
                                  onClick={() => saveSingleStudentAttendance(s)}
                                  disabled={savingStudentId === s.id}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded-lg shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                                >
                                  {savingStudentId === s.id ? 'Menyimpan...' : 'Simpan'}
                                </button>
                              </td>
                            )}
                          </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Attendance Footer */}
              <div className="p-3 bg-[#FAF8F5] border-t border-[#ECE7DE] flex justify-between items-center">
                <span className="text-[11px] text-slate-500 font-medium">
                  Menampilkan {filteredAttStudents.length} dari {students.length} Siswa
                </span>

                {isReadOnly ? (
                  <span className="text-xs font-bold text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                    <span>🔒</span> Mode Pemantauan (Data Absensi Hanya-Dapat-Dilihat)
                  </span>
                ) : (
                  <button
                    onClick={saveAllAttendance}
                    disabled={isSavingAttendance || students.length === 0}
                    className="clay-btn-coral px-5 py-2 font-bold text-xs rounded-2xl flex items-center cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} className="mr-1.5" />
                    {isSavingAttendance ? 'Menyimpan...' : `Simpan Seluruh Absensi (${selectedDate})`}
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ================= TAB 3: DAFTAR SISWA ================= */}
        {activeTab === 'students' && (
          <section className="clay-box p-4 sm:p-5 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                  <Users size={18} className="text-emerald-600" />
                  Data Siswa & Biodata Lengkap
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Daftar siswa terdaftar, riwayat aktivitas 7 KAIH, serta akses biodata yang diinput siswa pada aplikasi mobile.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
                {filteredStudentList.length} / {students.length} siswa
              </span>
            </div>

            {/* Pencarian & Filter Biodata */}
            <div className="space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Cari nama, NIS/NISN, email, alamat, kelas, jurusan, suku, hobi..."
                  value={stuSearch}
                  onChange={(e) => setStuSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:bg-white"
                />
                {stuSearch && (
                  <button onClick={() => setStuSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X size={12} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {([
                  ['jenjang', 'Semua Jenjang', stuOptions.jenjang],
                  ['kelas', 'Semua Kelas', stuOptions.kelas],
                  ['jurusan', 'Semua Jurusan', stuOptions.jurusan],
                  ['gender', 'Jenis Kelamin', stuOptions.gender],
                  ['religion', 'Semua Agama', stuOptions.religion],
                  ['suku', 'Semua Suku', stuOptions.suku]
                ] as [keyof typeof stuFilters, string, string[]][]).map(([key, label, opts]) => (
                  <select
                    key={key}
                    value={stuFilters[key]}
                    onChange={(e) => setStuFilters(prev => ({ ...prev, [key]: e.target.value }))}
                    className={`bg-white border text-xs font-semibold rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-2xs max-w-[170px] ${
                      stuFilters[key] !== 'Semua' ? 'border-emerald-400 text-emerald-800' : 'border-[#E5E0D5] text-slate-700'
                    }`}
                  >
                    <option value="Semua">{label}</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
                <select
                  value={stuFilters.status}
                  onChange={(e) => setStuFilters(prev => ({ ...prev, status: e.target.value }))}
                  className={`bg-white border text-xs font-semibold rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-2xs ${
                    stuFilters.status !== 'Semua' ? 'border-emerald-400 text-emerald-800' : 'border-[#E5E0D5] text-slate-700'
                  }`}
                >
                  <option value="Semua">Semua Status Aktivitas</option>
                  <option value="AKTIF">Sudah Ada Realisasi</option>
                  <option value="PERLU_NILAI">Perlu Dinilai</option>
                  <option value="BELUM_INPUT">Belum Input Aktivitas</option>
                </select>
                <button
                  onClick={resetStuFilters}
                  disabled={!isStuFilterActive}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center cursor-pointer ${
                    isStuFilterActive
                      ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 shadow-2xs'
                      : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                  }`}
                >
                  <RotateCcw size={12} className="mr-1.5" /> Reset
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF8F5] text-slate-500 uppercase font-bold text-[9px] border-b border-[#ECE7DE]">
                  <tr>
                    <th className="px-4 py-2.5">Siswa</th>
                    <th className="px-4 py-2.5">Kelas & Jurusan</th>
                    <th className="px-4 py-2.5">NIS / NISN</th>
                    <th className="px-4 py-2.5">Realisasi Selesai</th>
                    <th className="px-4 py-2.5">Rencana Belum Ceklis</th>
                    <th className="px-4 py-2.5">Telah Dinilai</th>
                    <th className="px-4 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredStudentList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                        <Search size={26} className="mx-auto text-slate-300 mb-1.5" />
                        <p className="font-bold text-slate-600 text-xs">Tidak ada siswa yang cocok</p>
                        <button onClick={resetStuFilters} className="mt-2 px-3 py-1 clay-btn-coral font-bold text-[11px] rounded-xl cursor-pointer">
                          Reset Pencarian & Filter
                        </button>
                      </td>
                    </tr>
                  )}
                  {filteredStudentList.map((student) => {
                    const studentActs = activities.filter(a => a.students?.id === student.id);
                    const realizedActs = studentActs.filter(a => a.kaihStatus === 'REALISASI');
                    const plannedActs = studentActs.filter(a => a.kaihStatus === 'RENCANA');
                    const evalActs = realizedActs.filter(a => a.evaluations.length > 0);

                    return (
                      <tr key={student.id} className="hover:bg-[#FAF8F5]/80 transition-colors">
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2.5">
                            {student.photo_url ? (
                              <img src={student.photo_url} alt={student.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                                {getInitials(student.name)}
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-slate-900 text-xs">{student.name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{student.jenjang}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-bold text-slate-800 text-xs">{student.kelas}</p>
                          <p className="text-[10px] text-slate-400">{student.jurusan}</p>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 font-mono text-[11px]">
                          {student.nisn !== '-' ? student.nisn : student.nis}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100 text-[10px]">
                            {realizedActs.length} Selesai
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 text-[10px]">
                            {plannedActs.length} Rencana
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-slate-600 font-semibold text-[11px]">
                            {evalActs.length} Dinilai
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => openStudentBiodata(student)}
                              className="clay-btn-white px-2.5 py-1 font-bold text-[10px] rounded-xl inline-flex items-center cursor-pointer text-emerald-800"
                              title="Lihat Biodata Lengkap"
                            >
                              <User size={12} className="mr-1 text-emerald-600" /> Biodata
                            </button>

                            <button
                              onClick={() => openStudentProfile(student)}
                              className="clay-btn-white px-2.5 py-1 font-bold text-[10px] rounded-xl inline-flex items-center cursor-pointer text-slate-600"
                              title="Grafik Analisis"
                            >
                              <BarChart2 size={12} className="mr-1 text-slate-500" /> Grafik
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ================= TAB 4: PETA SEBARAN (REQUIREMENT 2) ================= */}
        {activeTab === 'map' && (
          <section className="clay-box p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                  <MapLocationIcon size={18} className="text-emerald-600" />
                  Peta Sebaran Lokasi Terkini Siswa
                </h3>
                <p className="text-[11px] text-slate-500">
                  Titik-titik di peta menampilkan foto dan nama siswa, serta titik sekolah Budi Utomo standby mencolok.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-[#FEF6E1] text-[#9E6914] font-bold text-xs px-3 py-1 rounded-full border border-[#FBEAC4] shadow-2xs flex items-center">
                  🏫 Titik Sekolah Aktif
                </span>
                <span className="bg-emerald-50 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full border border-emerald-200 shadow-2xs flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
                  {studentLatestLocations.length} Siswa Terdeteksi
                </span>
              </div>
            </div>

            {/* Peta (kiri) + Daftar titik siswa (kanan) berdampingan */}
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_330px] gap-4 items-start">
            {/* Map Container */}
            <div id="map-view-container" className="h-[420px] lg:h-[calc(100vh-190px)] lg:min-h-[480px] w-full rounded-2xl overflow-hidden border border-[#ECE7DE] relative z-0 shadow-sm">
              <MapContainer 
                center={[schoolLocation.latitude, schoolLocation.longitude]} 
                zoom={12} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <FlyToLocation targetLoc={flyTarget ? { lat: flyTarget.lat, lng: flyTarget.lng } : null} />
                
                {/* 1. STANDBY SCHOOL PIN (REQUIREMENT 2 & 4) */}
                <Marker 
                  position={[schoolLocation.latitude, schoolLocation.longitude]}
                  icon={getSchoolDivIcon()}
                  zIndexOffset={1000}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px] font-sans">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-amber-100">
                        <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center text-lg shadow-sm">
                          🏫
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-xs leading-tight">{schoolLocation.name}</p>
                          <span className="text-[9px] text-purple-800 font-bold bg-purple-100 px-1.5 py-0.5 rounded">
                            ● {schoolLocation.level || 'Pusat Kampus'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-700 font-medium leading-snug">
                        📍 {schoolLocation.address}
                      </p>
                      {schoolLocation.phone && (
                        <p className="text-[10px] text-slate-600 mt-1">
                          📞 {schoolLocation.phone}
                        </p>
                      )}
                      <p className="text-[10px] text-slate-500 mt-1">
                        Koordinat: {schoolLocation.latitude}, {schoolLocation.longitude}
                      </p>
                    </div>
                  </Popup>
                </Marker>

                {/* 2. STUDENT PINS WITH PHOTO & NAME (REQUIREMENT 2) */}
                {studentLatestLocations.map((loc) => (
                  <Marker 
                    key={loc.studentId} 
                    position={[loc.latitude, loc.longitude]}
                    icon={getStudentDivIcon(loc.studentName, loc.photoUrl)}
                    ref={(el) => { if (el) markerRefs.current[loc.studentId] = el; }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[220px] font-sans">
                        <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                          {loc.photoUrl ? (
                            <img src={loc.photoUrl} alt={loc.studentName} className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-400 shrink-0" />
                          ) : (
                            <div className="w-16 h-16 rounded-xl bg-emerald-100 text-emerald-800 font-bold text-sm flex items-center justify-center shrink-0">
                              {getInitials(loc.studentName)}
                            </div>
                          )}
                          <div>
                            <p className="font-bold text-slate-900 text-xs leading-tight">{loc.studentName}</p>
                            {loc.student.kelas && loc.student.kelas !== '-' && (
                              <p className="text-[10px] text-slate-600 font-semibold">{loc.student.kelas}</p>
                            )}
                            {loc.student.jurusan && loc.student.jurusan !== '-' && (
                              <p className="text-[10px] text-slate-500">{loc.student.jurusan}</p>
                            )}
                            <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                              ● {loc.source}
                            </span>
                          </div>
                        </div>

                        <p className="text-[11px] text-slate-700 font-medium leading-snug">
                          📍 {loc.locationName}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          🕒 Update: {loc.lastUpdated}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          GPS: {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                        </p>

                        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => openStudentBiodata(loc.student)}
                              className="flex-1 py-1 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] rounded text-center cursor-pointer shadow-2xs"
                            >
                              Buka Biodata
                            </button>
                            <button
                              onClick={() => {
                                const card = studentActivityCards.find(c => c.student.id === loc.studentId);
                                if (card) openStudentActivitiesPopup(card);
                              }}
                              className="flex-1 py-1 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded text-center cursor-pointer"
                            >
                              Aktivitas
                            </button>
                          </div>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-1 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[10px] rounded text-center cursor-pointer border border-blue-200 flex items-center justify-center gap-1"
                          >
                            🗺️ Buka Google Maps
                          </a>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* 3. DAFTAR TITIK TERDETEKSI PER GRUP / KELAS (di sisi kanan peta) */}
            <div className="space-y-2.5 lg:h-[calc(100vh-190px)] lg:min-h-[480px] lg:overflow-y-auto lg:pr-1">
              <div className="space-y-0.5">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <GraduationCap size={15} className="text-emerald-600" />
                  Daftar Titik Siswa Terdeteksi
                </h4>
                <span className="text-[10px] text-slate-400 font-medium block">
                  Dikelompokkan per kelas. Klik siswa untuk menandai & zoom pada peta.
                </span>
              </div>

              {Object.keys(groupedStudentLocations).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-4 bg-[#FAF8F5] rounded-xl">Belum ada siswa dengan lokasi terdeteksi.</p>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(groupedStudentLocations).map(([classGroup, locs]: [string, any[]]) => (
                    <div key={classGroup} className="clay-box-sm p-3.5 space-y-2.5">
                      {/* Group Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                          <h5 className="font-bold text-slate-900 text-xs sm:text-sm">{classGroup}</h5>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {locs.length} Siswa Terdeteksi
                        </span>
                      </div>

                      {/* Student Cards in this Group */}
                      <div className="grid grid-cols-1 gap-2">
                        {locs.map((loc) => (
                          <div 
                            key={loc.studentId}
                            onClick={() => handleSelectStudentLocation(loc)}
                            className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer group ${
                              flyTarget?.id === loc.studentId
                                ? 'bg-emerald-50/90 border-emerald-400 shadow-xs ring-2 ring-emerald-200'
                                : 'bg-[#FAF8F5] hover:bg-white border-slate-200 hover:border-emerald-300 hover:shadow-2xs'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {loc.photoUrl ? (
                                <img src={loc.photoUrl} alt={loc.studentName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {getInitials(loc.studentName)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700">{loc.studentName}</p>
                                <p className="text-[10px] text-slate-400 truncate">📍 {loc.locationName}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <span className="p-1.5 rounded-lg bg-emerald-100/70 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-all text-[10px] font-bold" title="Tandai di Peta">
                                <MapPin size={12} />
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openStudentBiodata(loc.student);
                                }}
                                className="clay-btn-white px-2 py-1 text-[9px] font-bold rounded-lg"
                                title="Buka Biodata"
                              >
                                Biodata
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </section>
        )}

        {/* ================= TAB 5: PROFIL GURU ================= */}
        {activeTab === 'profile' && (
          <section className="space-y-4 max-w-2xl mx-auto">
            {/* Kartu 1: Profil (nama & foto) - password tidak wajib */}
            <div className="clay-box p-5 space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-1.5">
                <Settings size={18} className="text-emerald-600" />
                Pengaturan Profil
              </h3>

              {profileMsg && (
                <div className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {profileMsg.type === 'success' ? '✅ ' : '❌ '}{profileMsg.text}
                </div>
              )}

              {/* Foto */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-4 border-b border-slate-100">
                {profileForm.photoUrl && !photoError ? (
                  <img
                    src={profileForm.photoUrl}
                    alt="Foto Profil"
                    onError={() => setPhotoError(true)}
                    className="w-20 h-20 rounded-full object-cover border-3 border-white ring-2 ring-emerald-200 shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white font-black text-2xl flex items-center justify-center border-3 border-white ring-2 ring-emerald-200 shadow-sm shrink-0">
                    {getInitials(profileForm.fullName || 'Guru')}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div>
                    <p className="font-bold text-slate-900 text-sm truncate">{profileForm.fullName || teacherProfile?.full_name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{teacherProfile?.email}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className={`clay-btn-white px-3 py-1.5 font-bold text-[11px] rounded-xl inline-flex items-center gap-1.5 cursor-pointer ${isPhotoUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                      <Camera size={12} className="text-emerald-600" />
                      {isPhotoUploading ? 'Memproses...' : 'Ganti Foto'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => { handlePhotoFile(e.target.files?.[0]); e.target.value = ''; }}
                      />
                    </label>
                    {profileForm.photoUrl && (
                      <button
                        type="button"
                        onClick={() => { setProfileForm(prev => ({ ...prev, photoUrl: '' })); setPhotoError(false); }}
                        className="px-3 py-1.5 font-bold text-[11px] rounded-xl text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 cursor-pointer"
                      >
                        Hapus Foto
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">Pilih gambar dari perangkat (otomatis diperkecil).</p>
                </div>
              </div>

              {/* Nama */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  autoComplete="off"
                  value={profileForm.fullName}
                  onChange={e => setProfileForm(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:bg-white"
                  placeholder="Nama lengkap..."
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveProfile}
                  disabled={isProfileSaving || isPhotoUploading}
                  className="clay-btn-coral px-6 py-2 font-bold text-xs rounded-2xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  {isProfileSaving ? 'Menyimpan...' : 'Simpan Profil'}
                </button>
              </div>
            </div>

            {/* Kartu 2: Keamanan - ganti password (tombol khusus) */}
            <div className="clay-box p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <KeyRound size={16} className="text-amber-600" />
                    Keamanan Akun
                  </h3>
                  <p className="text-[11px] text-slate-500">Ganti password hanya jika diperlukan.</p>
                </div>
                {!showPasswordForm && (
                  <button
                    onClick={() => { setShowPasswordForm(true); setPasswordMsg(null); }}
                    className="clay-btn-white px-4 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer text-amber-800 shrink-0"
                  >
                    <KeyRound size={13} /> Ubah Password
                  </button>
                )}
              </div>

              {passwordMsg && (
                <div className={`px-4 py-2.5 rounded-xl text-xs font-bold border ${
                  passwordMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  {passwordMsg.type === 'success' ? '✅ ' : '❌ '}{passwordMsg.text}
                </div>
              )}

              {showPasswordForm && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Password Baru</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={profileForm.newPassword}
                      onChange={e => setProfileForm(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:bg-white"
                      placeholder="Minimal 6 karakter"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Konfirmasi Password Baru</label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={profileForm.confirmPassword}
                      onChange={e => setProfileForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      className="w-full px-3 py-2 bg-[#FAF8F5] border border-[#E5E0D5] rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-400 focus:bg-white"
                      placeholder="Ulangi password baru..."
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setShowPasswordForm(false); setPasswordMsg(null); setProfileForm(prev => ({ ...prev, newPassword: '', confirmPassword: '' })); }}
                      disabled={isPasswordSaving}
                      className="clay-btn-white px-4 py-1.5 font-bold text-xs rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={handleChangePassword}
                      disabled={isPasswordSaving}
                      className="clay-btn-coral px-5 py-1.5 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <KeyRound size={13} />
                      {isPasswordSaving ? 'Menyimpan...' : 'Simpan Password Baru'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      {/* ================= MODAL BIODATA LENGKAP SISWA (REQUIREMENT 1) ================= */}
      {isBiodataModalOpen && selectedStudentForBiodata && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => setIsBiodataModalOpen(false)}></div>

          <div className="relative clay-box max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#E5EFE9] via-[#E0ECE3] to-[#D8E8DC] p-4 sm:p-5 border-b border-[#D5E5DA] flex justify-between items-start gap-3">
              <div className="flex items-center gap-3.5">
                {selectedStudentForBiodata.photo_url ? (
                  <img
                    src={selectedStudentForBiodata.photo_url}
                    alt={selectedStudentForBiodata.name}
                    className="w-14 h-14 rounded-full object-cover border-3 border-white shadow-md ring-2 ring-emerald-200"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white font-black text-xl flex items-center justify-center border-3 border-white shadow-md ring-2 ring-emerald-200">
                    {getInitials(selectedStudentForBiodata.name)}
                  </div>
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {selectedStudentForBiodata.name}
                    </h3>
                    <span className="text-[10px] font-bold bg-white/90 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      Siswa Aktif
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-semibold mt-0.5">
                    {selectedStudentForBiodata.jenjang} • {selectedStudentForBiodata.kelas}
                    {selectedStudentForBiodata.jurusan && selectedStudentForBiodata.jurusan !== '-' && ` • ${selectedStudentForBiodata.jurusan}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsBiodataModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-2xs transition-all border border-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Complete Fields Analysis (Requirement 1) */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
              
              {/* Card 1: Data Akademik & Sekolah (Kelas, Jurusan, NISN, NIS) */}
              <div className="clay-box-sm p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <School size={15} className="text-purple-600" />
                  Data Akademik & Sekolah
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Jenjang Pendidikan</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedStudentForBiodata.jenjang || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Rombel / Kelas</span>
                    <p className="font-bold text-emerald-700 mt-0.5">{selectedStudentForBiodata.kelas || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Jurusan / Konsentrasi</span>
                    <p className="font-bold text-amber-700 mt-0.5">{selectedStudentForBiodata.jurusan || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">NISN</span>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.nisn || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">NIS</span>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.nis || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Email Akun</span>
                    <p className="font-semibold text-slate-800 mt-0.5 truncate">{selectedStudentForBiodata.email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Card 2: Identitas Pribadi Siswa */}
              <div className="clay-box-sm p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <User size={15} className="text-emerald-600" />
                  Identitas Pribadi & Alamat
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Jenis Kelamin</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.gender || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Agama</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.religion || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Suku / Etnis</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.suku || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Tanggal Lahir</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.birth_date ? formatIndonesianDate(selectedStudentForBiodata.birth_date) : '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">No. WhatsApp / HP Siswa</span>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1">
                      <Phone size={12} className="text-emerald-600" /> {selectedStudentForBiodata.phone || '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Titik Koordinat GPS Rumah</span>
                    <p className="font-mono text-[11px] text-slate-700 mt-0.5">
                      {selectedStudentForBiodata.latitude && selectedStudentForBiodata.longitude 
                        ? `${Number(selectedStudentForBiodata.latitude).toFixed(5)}, ${Number(selectedStudentForBiodata.longitude).toFixed(5)}`
                        : 'Belum terdeteksi'}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Alamat Tempat Tinggal Lengkap</span>
                    <p className="font-semibold text-slate-800 mt-0.5 flex items-start gap-1">
                      <MapPin size={13} className="text-rose-500 shrink-0 mt-0.5" />
                      {selectedStudentForBiodata.address || '-'}
                    </p>
                  </div>

                  {/* Foto Rumah Siswa jika ada */}
                  {selectedStudentForBiodata.house_photo_url && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase text-slate-400 flex items-center gap-1 mb-1.5">
                        <Home size={12} className="text-emerald-600" /> Foto Tampak Depan Rumah Siswa
                      </span>
                      <div className="relative rounded-xl overflow-hidden border border-slate-200 aspect-video max-h-48">
                        <img 
                          src={selectedStudentForBiodata.house_photo_url} 
                          alt="Foto Rumah" 
                          className="w-full h-full object-cover cursor-pointer hover:opacity-95"
                          onClick={() => setZoomedImage(selectedStudentForBiodata.house_photo_url)}
                        />
                        <button 
                          onClick={() => setZoomedImage(selectedStudentForBiodata.house_photo_url)}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 text-white rounded-lg text-[10px] flex items-center gap-1"
                        >
                          <ZoomIn size={12} /> Perbesar Foto
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Minat, Bakat & Ekstrakurikuler */}
              <div className="clay-box-sm p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Award size={15} className="text-amber-600" />
                  Minat, Bakat & Ekstrakurikuler
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Cita-Cita</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.aspiration || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Hobi</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.hobbies || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Bakat / Keahlian</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.talents || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Minat Khusus</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.interests || '-'}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">Kegiatan Ekstrakurikuler</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.extracurriculars || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Card 4: Fisik & Kesehatan */}
              <div className="clay-box-sm p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <HeartPulse size={15} className="text-rose-600" />
                  Fisik & Catatan Kesehatan
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Golongan Darah</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.blood_type || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Catatan Khusus Kesehatan</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.health_notes || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Card 5: Data Orang Tua / Wali */}
              <div className="clay-box-sm p-4 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5 pb-2 border-b border-slate-100">
                  <Briefcase size={15} className="text-blue-600" />
                  Data Orang Tua / Wali
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-700">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Nama Orang Tua / Wali</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.parentNotes?.name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">No. Telepon Wali</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.parentNotes?.phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400">Pekerjaan Wali</span>
                    <p className="font-semibold text-slate-800 mt-0.5">{selectedStudentForBiodata.parentNotes?.occupation || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-white border-t border-[#ECE7DE] flex justify-end gap-2">
              <button
                onClick={handlePrintBiodata}
                className="clay-btn-coral px-5 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
              >
                🖨️ Cetak PDF
              </button>
              <button
                onClick={() => setIsBiodataModalOpen(false)}
                className="clay-btn-white px-5 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tutup Biodata
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= JENDELA POPUP SELURUH AKTIVITAS SISWA ================= */}
      {isStudentPopupOpen && selectedStudentForPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => setIsStudentPopupOpen(false)}></div>
          
          <div className="relative clay-box max-w-3xl w-full max-h-[88vh] flex flex-col overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Top Header (Clay Pastel) */}
            <div className="bg-gradient-to-r from-[#E5EFE9] via-[#E2EBE4] to-[#DDEBE0] p-4 sm:p-5 border-b border-[#D5E5DA] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-3">
                {selectedStudentForPopup.student.photo_url ? (
                  <img
                    src={selectedStudentForPopup.student.photo_url}
                    alt={selectedStudentForPopup.student.name}
                    className="w-13 h-13 rounded-full object-cover border-3 border-white shadow-sm ring-2 ring-emerald-200"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-full bg-gradient-to-br from-teal-400 to-emerald-600 text-white font-black text-lg flex items-center justify-center border-3 border-white shadow-sm ring-2 ring-emerald-200">
                    {getInitials(selectedStudentForPopup.student.name)}
                  </div>
                )}

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                      {selectedStudentForPopup.student.name}
                    </h3>
                    <span className="text-[10px] font-bold bg-white/80 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 shadow-2xs">
                      Siswa
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="text-[11px] font-bold text-emerald-800 bg-white/70 px-2 py-0.5 rounded-md border border-white">
                      ✅ {selectedStudentForPopup.realizedCount} Realisasi
                    </span>
                    <span className="text-[11px] font-bold text-amber-800 bg-white/70 px-2 py-0.5 rounded-md border border-white">
                      📅 {selectedStudentForPopup.plannedCount} Rencana
                    </span>
                    <span className="text-[11px] font-bold text-blue-800 bg-white/70 px-2 py-0.5 rounded-md border border-white">
                      ⭐ {selectedStudentForPopup.evaluatedCount} Telah Dinilai
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsStudentPopupOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 flex items-center justify-center shadow-2xs transition-all border border-white cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Pills inside Modal */}
            <div className="px-4 sm:px-5 py-2.5 bg-white border-b border-[#ECE7DE] flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-1">
                <button
                  onClick={() => setPopupFilterStatus('Semua')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    popupFilterStatus === 'Semua'
                      ? 'clay-btn-coral'
                      : 'clay-btn-white'
                  }`}
                >
                  Semua ({selectedStudentForPopup.activities.length})
                </button>
                <button
                  onClick={() => setPopupFilterStatus('REALISASI')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    popupFilterStatus === 'REALISASI'
                      ? 'clay-btn-coral'
                      : 'clay-btn-white text-emerald-700'
                  }`}
                >
                  ✅ Realisasi ({selectedStudentForPopup.realizedCount})
                </button>
                <button
                  onClick={() => setPopupFilterStatus('RENCANA')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    popupFilterStatus === 'RENCANA'
                      ? 'clay-btn-coral'
                      : 'clay-btn-white text-amber-700'
                  }`}
                >
                  📅 Rencana ({selectedStudentForPopup.plannedCount})
                </button>
                <button
                  onClick={() => setPopupFilterStatus('PENDING')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    popupFilterStatus === 'PENDING'
                      ? 'clay-btn-coral'
                      : 'clay-btn-white text-orange-700'
                  }`}
                >
                  ⭐ Belum Dinilai ({selectedStudentForPopup.pendingCount})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isReadOnly && (
                  <button
                    onClick={() => { setBulkRating(0); setBulkComment(''); setIsBulkEvalOpen(true); }}
                    disabled={selectedStudentForPopup.pendingCount === 0}
                    className="clay-btn-coral px-2.5 py-1 rounded-lg text-xs font-bold flex items-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    title="Beri nilai sekaligus untuk semua kegiatan yang belum dinilai"
                  >
                    <Star size={12} className="mr-1 fill-white" /> Nilai Semua ({selectedStudentForPopup.pendingCount})
                  </button>
                )}
                {isReadOnly && (
                  <span className="text-[10px] font-bold text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                    👁️ Mode Monitoring
                  </span>
                )}
                <span className="text-[11px] text-slate-400 font-medium">
                  {popupActivities.length} kegiatan
                </span>
              </div>
            </div>

            {/* Modal Body: daftar ringkas, dikelompokkan per tanggal & diurutkan per jam */}
            <div className="overflow-y-auto flex-1 px-3 sm:px-4 pb-3 space-y-3">
              {popupGroups.length === 0 ? (
                <div className="py-12 mt-3 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                  <Search size={28} className="mx-auto text-slate-300 mb-1.5" />
                  <p className="font-bold text-slate-600 text-xs">Tidak ada kegiatan untuk filter ini</p>
                </div>
              ) : (
                popupGroups.map((group) => (
                  <div key={group.date}>
                    <div className="flex items-center justify-between sticky top-0 z-[1] bg-white py-1.5">
                      <h5 className="text-[11px] font-black text-slate-700 flex items-center gap-1.5">
                        <Calendar size={12} className="text-emerald-600" />
                        {formatIndonesianDate(group.date) || group.date}
                      </h5>
                      <span className="text-[10px] text-slate-400 font-semibold">{group.acts.length} kegiatan</span>
                    </div>

                    <div className="clay-box-sm divide-y divide-slate-100 overflow-hidden">
                      {group.acts.map((act: any) => {
                        const isRealized = act.kaihStatus === 'REALISASI';
                        const hasEvaluated = act.evaluations && act.evaluations.length > 0;
                        const evalData = hasEvaluated ? act.evaluations[0] : null;
                        const imgUrl = getActivityImageUrl(act);
                        const time = group.getTime(act);

                        return (
                          <div key={act.id} className="flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-[#FAF8F5] transition-colors">
                            <span className={`w-11 shrink-0 text-[10px] font-mono font-bold ${isRealized ? 'text-emerald-700' : 'text-amber-700'}`}>
                              {time || '--:--'}
                            </span>

                            <button
                              type="button"
                              onClick={() => setZoomedImage(imgUrl)}
                              className="shrink-0 cursor-zoom-in"
                              title="Perbesar gambar"
                            >
                              <img src={imgUrl} alt={act.title} className="w-9 h-9 rounded-lg object-cover bg-slate-100 border border-slate-100" />
                            </button>

                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">{act.title}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                <span className="font-bold text-emerald-700">{act.activity_categories?.name || '7 KAIH'}</span>
                                {act.description ? ` • ${act.description}` : ''}
                                {act.location_name ? ` • 📍 ${act.location_name}` : ''}
                              </p>
                              {evalData?.comment && (
                                <p className="text-[10px] text-amber-800 italic truncate" title={evalData.comment}>"{evalData.comment}"</p>
                              )}
                            </div>

                            <div className="shrink-0 flex items-center gap-2">
                              {isRealized ? (
                                <>
                                  {hasEvaluated ? (
                                    <div className="flex items-center gap-1.5">
                                      <div className="hidden sm:flex">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star
                                            key={star}
                                            size={11}
                                            className={star <= evalData.rating ? 'text-amber-500 fill-amber-400' : 'text-slate-200'}
                                          />
                                        ))}
                                      </div>
                                      {!isReadOnly && (
                                        <button
                                          onClick={() => openEvaluationModal(act)}
                                          className="clay-btn-white px-2 py-1 text-[10px] font-bold rounded-lg flex items-center cursor-pointer text-emerald-800"
                                          title="Ubah penilaian"
                                        >
                                          <Star size={10} className="mr-1 fill-amber-400 text-amber-500" />
                                          Ubah
                                        </button>
                                      )}
                                    </div>
                                  ) : isReadOnly ? (
                                    <span className="text-[9px] font-bold text-slate-400 bg-slate-50 border border-slate-200 px-1.5 py-0.5 rounded-md">
                                      Belum dinilai guru
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => openEvaluationModal(act)}
                                      className="clay-btn-white px-2 py-1 text-[10px] font-bold rounded-lg flex items-center cursor-pointer text-emerald-800"
                                      title="Beri penilaian"
                                    >
                                      <Star size={10} className="mr-1 fill-amber-400 text-amber-500" />
                                      Nilai
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span
                                  className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md"
                                  title="Kegiatan yang masih rencana belum bisa dinilai"
                                >
                                  📅 Rencana
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Bottom Footer */}
            <div className="p-3 bg-white border-t border-[#ECE7DE] flex justify-end">
              <button
                onClick={() => setIsStudentPopupOpen(false)}
                className="clay-btn-white px-5 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL NILAI SEMUA (BULK) ================= */}
      {isBulkEvalOpen && selectedStudentForPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-slate-900/70 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => !isBulkSubmitting && setIsBulkEvalOpen(false)}></div>
          <div className="relative clay-box w-full max-w-sm overflow-hidden z-10">
            <div className="p-3.5 border-b border-slate-100 bg-[#FAF8F5] flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-slate-900">Nilai Semua Kegiatan</h3>
                <p className="text-[10px] text-slate-500">
                  {selectedStudentForPopup.pendingCount} kegiatan {selectedStudentForPopup.student.name} akan diberi nilai yang sama.
                </p>
              </div>
              <button onClick={() => !isBulkSubmitting && setIsBulkEvalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setBulkRating(star)}
                    className={`p-1 transition-transform cursor-pointer ${bulkRating >= star ? 'scale-110 text-amber-500' : 'text-slate-300 hover:scale-105'}`}
                  >
                    <Star size={28} fill={bulkRating >= star ? '#f59e0b' : 'none'} />
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                placeholder="Catatan untuk semua kegiatan (opsional)..."
                value={bulkComment}
                onChange={(e) => setBulkComment(e.target.value)}
                className="w-full border border-slate-300 rounded-xl p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkEvalOpen(false)}
                  disabled={isBulkSubmitting}
                  className="clay-btn-white px-3 py-1.5 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleBulkEvaluate}
                  disabled={isBulkSubmitting}
                  className="clay-btn-coral px-4 py-1.5 font-bold text-xs rounded-xl disabled:opacity-50 cursor-pointer"
                >
                  {isBulkSubmitting ? 'Menyimpan...' : 'Nilai Semua'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL PENILAIAN GURU ================= */}
      {isModalOpen && selectedActivity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          
          <div className="relative clay-box w-full max-w-md overflow-hidden flex flex-col z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-[#FAF8F5]">
              <div>
                <h3 className="text-base font-black text-slate-900">Penilaian Aktivitas</h3>
                <p className="text-[11px] text-slate-500">Berikan rating bintang dan umpan balik edukatif.</p>
              </div>
              <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitEvaluation} className="p-4 space-y-4">
              <div className="bg-[#FAF8F5] p-3 rounded-xl border border-slate-200">
                <h4 className="font-bold text-xs text-slate-900 leading-snug">{selectedActivity.title}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{selectedActivity.description || 'Tidak ada deskripsi.'}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 text-center mb-1.5 uppercase tracking-wider">
                  Rating Bintang
                </label>
                <div className="flex justify-center space-x-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setEvaluation({ ...evaluation, rating: star })}
                      className={`p-1.5 transition-transform cursor-pointer ${
                        evaluation.rating >= star ? 'scale-115 text-amber-500' : 'text-slate-300 hover:scale-110'
                      }`}
                    >
                      <Star size={30} fill={evaluation.rating >= star ? "#f59e0b" : "none"} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  Catatan / Komentar Guru
                </label>
                <textarea
                  rows={3}
                  placeholder="Bagus sekali, terus pertahankan kedisiplinannya ya..."
                  value={evaluation.comment}
                  onChange={(e) => setEvaluation({ ...evaluation, comment: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="clay-btn-white px-3.5 py-1.5 font-bold text-xs rounded-xl transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="clay-btn-coral px-4 py-1.5 font-bold text-xs rounded-xl transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Menyimpan...' : 'Kirim Penilaian'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PROFILE ANALYTICS ================= */}
      {isProfileModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="absolute inset-0" onClick={() => setIsProfileModalOpen(false)}></div>
          
          <div className="relative clay-box w-full max-w-lg overflow-hidden flex flex-col z-10">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-4 sm:p-5 text-white flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-full bg-white text-emerald-800 font-black text-lg flex items-center justify-center">
                  {getInitials(selectedStudent.name)}
                </div>
                <div>
                  <h3 className="text-base font-bold">{selectedStudent.name}</h3>
                  <p className="text-emerald-100 text-[10px]">Statistik Realisasi 7 KAIH</p>
                </div>
              </div>
              <button onClick={() => setIsProfileModalOpen(false)} className="text-white hover:text-emerald-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <h4 className="font-bold text-slate-800 text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-600" />
                Distribusi Kategori Kegiatan Siswa
              </h4>

              <div className="h-56 w-full bg-[#FAF8F5] p-3 rounded-xl border border-slate-200">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentStats} layout="vertical" margin={{ top: 5, right: 25, left: 15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Bar dataKey="Total" fill="#059669" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={() => setIsProfileModalOpen(false)}
                  className="clay-btn-white px-4 py-1.5 font-bold text-xs rounded-xl"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LAPORAN ANALISA SISWA & PERANGKINGAN (Issue 6) ================= */}
      {isRankingReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-5 sm:p-7 shadow-2xl border border-slate-100 my-6 max-h-[92vh] overflow-y-auto space-y-5">
            {/* Modal Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center font-black shadow-md">
                  <Award size={26} />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-black text-slate-900">
                    Laporan Analisis Karakter & Perangkingan Siswa
                  </h2>
                  <p className="text-xs text-slate-500">
                    Perangkingan komprehensif berdasarkan 7 KAIH (40%), Penilaian Guru (40%), dan Presensi (20%)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handlePrintRankingReport}
                  className="clay-btn-coral px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Printer size={15} />
                  <span>Cetak Dokumen PDF Resmi</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRankingReportOpen(false)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Filter Kelas & Ringkasan Metrik */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700">Filter Kelas:</span>
                <select
                  value={rankingClassFilter}
                  onChange={(e) => setRankingClassFilter(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="Semua">Semua Kelas ({students.length} Siswa)</option>
                  {Array.from(new Set(students.map((s) => s.kelas).filter(Boolean))).map((cls) => (
                    <option key={cls} value={cls}>Kelas {cls}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <span className="font-bold text-slate-600">
                  Total: <b className="text-emerald-700 font-black">{rankingData.length}</b> Siswa Teranalisis
                </span>
                <span className="text-slate-300">•</span>
                <span className="font-bold text-slate-600">
                  Rata-rata Skor: <b className="text-blue-700 font-black">{Math.round(rankingData.reduce((acc, r) => acc + r.finalScore, 0) / (rankingData.length || 1))}</b> / 100
                </span>
              </div>
            </div>

            {/* Podium 3 Besar Juara Karakter */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Juara 2 (Perak) */}
              {rankingData[1] && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-100 via-slate-50 to-white border-2 border-slate-300 shadow-xs flex flex-col items-center text-center relative order-2 md:order-1">
                  <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-slate-400 text-white font-black text-xs shadow-xs">
                    🥈 JUARA 2
                  </span>
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-300 shadow-xs mt-2 mb-2">
                    {rankingData[1].student.photo_url ? (
                      <img src={rankingData[1].student.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-slate-300 text-slate-700 font-black flex items-center justify-center">
                        {getInitials(rankingData[1].student.name)}
                      </div>
                    )}
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-full">{rankingData[1].student.name}</h4>
                  <p className="text-[11px] text-slate-500">{rankingData[1].student.kelas || 'Siswa'}</p>
                  <div className="mt-2 text-xs font-black text-slate-700 bg-slate-200/80 px-3 py-1 rounded-xl">
                    Skor: {rankingData[1].finalScore} / 100
                  </div>
                </div>
              )}

              {/* Juara 1 (Emas) */}
              {rankingData[0] && (
                <div className="p-5 rounded-2xl bg-gradient-to-b from-amber-100 via-amber-50 to-white border-2 border-amber-400 shadow-md flex flex-col items-center text-center relative order-1 md:order-2 scale-105">
                  <span className="absolute -top-3.5 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black text-xs shadow-xs">
                    🥇 JUARA 1 UTAMA
                  </span>
                  <div className="w-20 h-20 rounded-full overflow-hidden border-3 border-amber-400 shadow-md mt-2 mb-2 ring-4 ring-amber-200">
                    {rankingData[0].student.photo_url ? (
                      <img src={rankingData[0].student.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-amber-400 text-amber-900 font-black text-xl flex items-center justify-center">
                        {getInitials(rankingData[0].student.name)}
                      </div>
                    )}
                  </div>
                  <h4 className="font-black text-slate-900 text-base truncate max-w-full">{rankingData[0].student.name}</h4>
                  <p className="text-xs font-bold text-amber-800">{rankingData[0].student.kelas || 'Siswa'}</p>
                  <div className="mt-2 text-sm font-black text-amber-900 bg-amber-200/90 px-4 py-1.5 rounded-2xl border border-amber-300">
                    Skor Tertinggi: {rankingData[0].finalScore} / 100
                  </div>
                </div>
              )}

              {/* Juara 3 (Perunggu) */}
              {rankingData[2] && (
                <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/60 via-orange-50/30 to-white border-2 border-amber-600/40 shadow-xs flex flex-col items-center text-center relative order-3">
                  <span className="absolute -top-3 px-3 py-0.5 rounded-full bg-amber-700 text-white font-black text-xs shadow-xs">
                    🥉 JUARA 3
                  </span>
                  <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-600/50 shadow-xs mt-2 mb-2">
                    {rankingData[2].student.photo_url ? (
                      <img src={rankingData[2].student.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-amber-700/20 text-amber-900 font-black flex items-center justify-center">
                        {getInitials(rankingData[2].student.name)}
                      </div>
                    )}
                  </div>
                  <h4 className="font-extrabold text-slate-900 text-sm truncate max-w-full">{rankingData[2].student.name}</h4>
                  <p className="text-[11px] text-slate-500">{rankingData[2].student.kelas || 'Siswa'}</p>
                  <div className="mt-2 text-xs font-black text-amber-800 bg-amber-100/80 px-3 py-1 rounded-xl">
                    Skor: {rankingData[2].finalScore} / 100
                  </div>
                </div>
              )}
            </div>

            {/* Grafik Top 10 Siswa */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
              <h4 className="text-xs font-extrabold text-slate-900">
                📊 Grafik Perbandingan Skor Karakter Top 10 Siswa
              </h4>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rankingData.slice(0, 10).map((r) => ({ name: r.student.name.split(' ')[0], skor: r.finalScore, realisasi: r.realizedCount }))}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} stroke="#64748B" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#64748B" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="skor" name="Skor Karakter" fill="#F59E0B" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Tabel Peringkat Lengkap */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-600 font-extrabold sticky top-0">
                    <tr>
                      <th className="px-3.5 py-2.5 text-center">Rank</th>
                      <th className="px-3.5 py-2.5">Siswa</th>
                      <th className="px-3.5 py-2.5">Kelas</th>
                      <th className="px-3.5 py-2.5 text-center">7 KAIH</th>
                      <th className="px-3.5 py-2.5 text-center">Guru ⭐</th>
                      <th className="px-3.5 py-2.5 text-center">Presensi</th>
                      <th className="px-3.5 py-2.5 text-center">Skor Akhir</th>
                      <th className="px-3.5 py-2.5 text-center">Predikat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rankingData.map((item, idx) => (
                      <tr key={item.student.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-3.5 py-2.5 text-center font-black">
                          {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                        </td>
                        <td className="px-3.5 py-2.5">
                          <div className="flex items-center gap-2">
                            {item.student.photo_url ? (
                              <img src={item.student.photo_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center">
                                {getInitials(item.student.name)}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 block">{item.student.name}</span>
                              <span className="text-[10px] text-slate-400">NISN: {item.student.nisn || '-'}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-700">{item.student.kelas || '-'}</td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-emerald-700">
                          {item.realizedCount} / 7
                        </td>
                        <td className="px-3.5 py-2.5 text-center font-bold text-amber-700">
                          ⭐ {item.avgRating}
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                            {item.attendanceStatus}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                            {item.finalScore}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            {item.predicate}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL IMAGE ZOOM ================= */}
      {zoomedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setZoomedImage(null)}></div>
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl z-10 shadow-2xl">
            <button
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-black text-white rounded-full transition-all cursor-pointer"
            >
              <X size={18} />
            </button>
            <img src={zoomedImage} alt="Foto Zoom" className="w-full h-full object-contain max-h-[85vh] rounded-2xl" />
          </div>
        </div>
      )}

    </div>
  );
}
