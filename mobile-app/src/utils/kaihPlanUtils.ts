export interface KaihCategoryDef {
  id: string;
  key: string;
  name: string;
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

export const KAIH_CATEGORIES_LIST: KaihCategoryDef[] = [
  { id: '1', key: 'Bangun Pagi', name: 'Bangun Pagi', label: 'Bangun Pagi', icon: '☀️', color: '#0284c7', bgColor: '#e0f2fe' },
  { id: '2', key: 'Beribadah', name: 'Beribadah', label: 'Beribadah', icon: '🤲', color: '#16a34a', bgColor: '#dcfce7' },
  { id: '3', key: 'Berolahraga', name: 'Berolahraga', label: 'Berolahraga', icon: '🏃', color: '#db2777', bgColor: '#fce7f3' },
  { id: '4', key: 'Makan Sehat dan Bergizi', name: 'Makan Sehat dan Bergizi', label: 'Makan Sehat', icon: '🥗', color: '#d97706', bgColor: '#fef3c7' },
  { id: '5', key: 'Gemar Belajar', name: 'Gemar Belajar', label: 'Gemar Belajar', icon: '📚', color: '#9333ea', bgColor: '#f3e8ff' },
  { id: '6', key: 'Bermasyarakat', name: 'Bermasyarakat', label: 'Bermasyarakat', icon: '🤝', color: '#0284c7', bgColor: '#e0f2fe' },
  { id: '7', key: 'Tidur Cepat', name: 'Tidur Cepat', label: 'Tidur Cepat', icon: '🌙', color: '#4f46e5', bgColor: '#e0e7ff' },
];

export const DEFAULT_CATEGORY_IMAGES: Record<string, string> = {
  'Bangun Pagi': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_bangun_pagi.jpg',
  'Beribadah': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_beribadah_v2.jpg',
  'Berolahraga': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_berolahraga.jpg',
  'Makan Sehat dan Bergizi': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_makan_sehat.jpg',
  'Gemar Belajar': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_gemar_belajar.jpg',
  'Bermasyarakat': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_bermasyarakat_v2.jpg',
  'Tidur Cepat': 'https://zshxtebkopkvhdthavhb.supabase.co/storage/v1/object/public/public_assets/default_kaih/kaih_tidur_cepat_v2.jpg',
};

export const KAIH_CATEGORY_ICON_CONFIG: Record<string, { icon: string; color: string }> = {
  'Bangun Pagi': { icon: '☀️', color: '#0284c7' },
  'Beribadah': { icon: '🤲', color: '#16a34a' },
  'Berolahraga': { icon: '🏃', color: '#db2777' },
  'Makan Sehat dan Bergizi': { icon: '🥗', color: '#d97706' },
  'Gemar Belajar': { icon: '📚', color: '#9333ea' },
  'Bermasyarakat': { icon: '🤝', color: '#0284c7' },
  'Tidur Cepat': { icon: '🌙', color: '#4f46e5' },
};

export const DEFAULT_KAIH_LOCAL_ASSETS: Record<string, any> = {};

export interface ActivityPreset {
  label: string;
  timeRange: string;
  defaultTime: string; // HH:mm format
  shortLabel?: string; // Nama ringkas untuk rincian progres
  icon?: string; // Emoji untuk rincian progres
}

// Data Referensi Tabel 7 KAIH
export const PRESET_ACTIVITIES_BY_CATEGORY: Record<string, ActivityPreset[]> = {
  'Bangun Pagi': [
    { label: 'Bangun tidur, mandi pagi, wudu, dzikir persiapan tahajud', timeRange: '03.00 - 03.15', defaultTime: '03:00', shortLabel: 'Bangun Dini Hari (Persiapan Tahajud)', icon: '🌌' },
    { label: 'Bangun pagi pukul 04.30, merapikan tempat tidur & mandi pagi', timeRange: '04.30 - 05.00', defaultTime: '04:30', shortLabel: 'Bangun Pagi 04.30 & Mandi', icon: '☀️' },
  ],
  'Beribadah': [
    { label: 'Tahajud, witir, doa, tilawah, dzikir, muhasabah diri', timeRange: '03.15 - 05.00', defaultTime: '03:15' },
    { label: 'Shalat Subuh, dzikir pagi, motivasi diri', timeRange: '05.00 - 06.00', defaultTime: '05:00' },
    { label: 'Shalat Zuhur', timeRange: '12.00 - 13.30', defaultTime: '12:00' },
    { label: 'Shalat Ashar', timeRange: '15.30 - 16.30', defaultTime: '15:30' },
    { label: "Shalat Maghrib, tilawah Al-Qur'an", timeRange: '18.30 - 19.30', defaultTime: '18:30' },
    { label: 'Shalat Isya, evaluasi diri', timeRange: '19.30 - 21.00', defaultTime: '19:30' },
  ],
  'Berolahraga': [
    { label: 'Olahraga pagi, peregangan / senam ringan sebelum persiapan sekolah', timeRange: '06.00 - 06.45', defaultTime: '06:00', shortLabel: 'Olahraga Pagi & Peregangan', icon: '🤸' },
    { label: 'Olahraga Ringan, Sepak Bola / Jogging Sore', timeRange: '17.00 - 18.00', defaultTime: '17:00', shortLabel: 'Olahraga Sore (Jogging / Bola)', icon: '⚽' },
  ],
  'Makan Sehat dan Bergizi': [
    { label: 'Sarapan Sehat Bergizi sebelum berangkat sekolah', timeRange: '06.30 - 07.15', defaultTime: '06:30', shortLabel: 'Sarapan Sehat Bergizi', icon: '🍳' },
    { label: 'Makan Siang Bergizi (4 Sehat 5 Sempurna)', timeRange: '12.30 - 13.30', defaultTime: '12:30', shortLabel: 'Makan Siang Bergizi', icon: '🍛' },
  ],
  'Gemar Belajar': [
    { label: 'Belajar aktif di sekolah & menyimak pelajaran guru', timeRange: '07.30 - 12.00', defaultTime: '07:30', shortLabel: 'Belajar Aktif di Sekolah', icon: '🏫' },
    { label: 'Praktik, proyek, mengerjakan tugas & diskusi kelompok', timeRange: '13.30 - 15.30', defaultTime: '13:30', shortLabel: 'Praktik, Tugas & Diskusi', icon: '🧪' },
    { label: 'Belajar mandiri di rumah & persiapan materi esok hari', timeRange: '19.30 - 21.00', defaultTime: '19:30', shortLabel: 'Belajar Mandiri di Rumah', icon: '📖' },
  ],
  'Bermasyarakat': [
    { label: 'Membantu orang tua di rumah, kegiatan sosial, gotong royong', timeRange: '17.00 - 18.30', defaultTime: '17:00', shortLabel: 'Membantu Orang Tua & Gotong Royong', icon: '🏡' },
    { label: 'Menjaga kebersihan lingkungan & berbuat baik kepada sesama', timeRange: '16.00 - 17.30', defaultTime: '16:30', shortLabel: 'Menjaga Kebersihan & Berbuat Baik', icon: '🧹' },
  ],
  'Tidur Cepat': [
    { label: 'Tidur malam tepat waktu maksimal pukul 21.00 WIB', timeRange: '21.00 - 03.00', defaultTime: '21:00', shortLabel: 'Tidur Malam Tepat Waktu', icon: '🌙' },
  ],
};

export interface ParsedActivity {
  id: string;
  student_id: string;
  activity_date: string;
  activity_time: string;
  title: string;
  description: string; // clean description without metadata tags
  raw_description: string;
  photo_url: string;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  created_at: string;
  evaluations?: any;
  kaihStatus: 'RENCANA' | 'REALISASI';
  plannedTime: string; // HH:mm
  realizedTime: string | null; // HH:mm if realized
  realizationNote: string | null;
  planId: string | null;
  [key: string]: any;
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns today's and tomorrow's Date and YYYY-MM-DD strings.
 */
export function getTodayAndTomorrowDates() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  return {
    today,
    tomorrow,
    todayStr: toLocalDateKey(today),
    tomorrowStr: toLocalDateKey(tomorrow),
  };
}

/**
 * Builds the tagged description string for saving a RENCANA (Plan) row.
 */
export function buildPlanDescription(cleanDesc: string, plannedTimeHHMM: string): string {
  const clean = (cleanDesc || '').trim();
  const timeTag = plannedTimeHHMM ? `[JAM_RENCANA:${plannedTimeHHMM.slice(0, 5)}]` : '';
  return `[STATUS:RENCANA]${timeTag} ${clean}`.trim();
}

/**
 * Builds the tagged description string for saving a REALISASI (Realized) row.
 */
export function buildRealizedDescription(
  cleanDesc: string,
  plannedTimeHHMM?: string,
  planId?: string,
  realizationNote?: string
): string {
  const clean = (cleanDesc || '').trim();
  const timeTag = plannedTimeHHMM ? `[JAM_RENCANA:${plannedTimeHHMM.slice(0, 5)}]` : '';
  const planIdTag = planId ? `[PLAN_ID:${planId}]` : '';
  const notePart = realizationNote && realizationNote.trim() && realizationNote.trim() !== clean
    ? ` | Catatan Realisasi: ${realizationNote.trim()}`
    : '';
  return `[STATUS:REALISASI]${timeTag}${planIdTag} ${clean}${notePart}`.trim();
}

/**
 * Parses a single activity row from Supabase and extracts plan/realization metadata.
 */
export function parseSingleActivity(raw: any): ParsedActivity {
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

  const rawTime = raw?.activity_time ? String(raw.activity_time).slice(0, 5) : '06:00';
  const plannedTime = jamRencanaMatch ? jamRencanaMatch[1] : rawTime;
  const realizedTime = kaihStatus === 'REALISASI' ? rawTime : null;

  return {
    ...raw,
    description: cleanDesc,
    raw_description: rawDesc,
    kaihStatus,
    plannedTime,
    realizedTime,
    realizationNote: null,
    planId: planIdMatch ? planIdMatch[1] : null,
  };
}

/**
 * Parses and deduplicates an array of activities.
 * If a RENCANA row was realized via INSERT fallback (linked by PLAN_ID or matching student+date+title+description),
 * the REALISASI row supersedes the RENCANA row so there are never duplicate entries.
 */
export function parseAndDeduplicateActivities(rawList: any[]): ParsedActivity[] {
  if (!Array.isArray(rawList)) return [];

  const parsed = rawList.map(parseSingleActivity);

  // Collect IDs of RENCANA rows that have been superseded by a REALISASI row
  const supersededPlanIds = new Set<string>();
  const realizedKeys = new Set<string>();

  for (const item of parsed) {
    if (item.kaihStatus === 'REALISASI') {
      if (item.planId) {
        supersededPlanIds.add(String(item.planId));
      }
      const baseDesc = item.description.split(' | Catatan Realisasi:')[0].trim().toLowerCase();
      const key = `${item.student_id || ''}_${item.activity_date || ''}_${(item.title || '').toLowerCase()}_${baseDesc}`;
      realizedKeys.add(key);
    }
  }

  return parsed.filter((item) => {
    if (item.kaihStatus === 'RENCANA') {
      if (supersededPlanIds.has(String(item.id))) {
        return false;
      }
      const baseDesc = item.description.trim().toLowerCase();
      const key = `${item.student_id || ''}_${item.activity_date || ''}_${(item.title || '').toLowerCase()}_${baseDesc}`;
      if (realizedKeys.has(key)) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Matches a title/category string to one of the 7 KAIH canonical category keys.
 */
export function matchKaihCategoryKey(titleOrCategory?: string): string | null {
  if (!titleOrCategory) return null;
  const str = titleOrCategory.trim();
  const exact = KAIH_CATEGORIES_LIST.find(c => c.key === str || c.label === str);
  if (exact) return exact.key;

  const lower = str.toLowerCase();
  const fuzzy = KAIH_CATEGORIES_LIST.find(
    c =>
      c.key.toLowerCase().includes(lower) ||
      lower.includes(c.key.toLowerCase()) ||
      c.label.toLowerCase().includes(lower) ||
      lower.includes(c.label.toLowerCase())
  );
  return fuzzy ? fuzzy.key : null;
}


// ═══════════════════════════════════════════════════════════════════════════
//  BATAS WAKTU CEKLIS, URUTAN JAM MULAI, DAN PROGRES HARIAN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Batas mundur pengerjaan ceklis realisasi.
 * 1 = ceklis hanya bisa dikerjakan untuk HARI INI dan KEMARIN (H-1).
 * Rencana yang tanggalnya lebih lama dari itu terkunci dan tidak bisa diceklis lagi.
 */
export const MAX_REALIZE_BACKDATE_DAYS = 1;

/**
 * Menambah/mengurangi hari pada kunci tanggal YYYY-MM-DD (waktu lokal).
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const parts = String(dateKey || '').split('-');
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  d.setDate(d.getDate() + days);
  return toLocalDateKey(d);
}

/**
 * Jendela tanggal yang masih boleh diceklis: dari `oldestStr` (kemarin) sampai `todayStr` (hari ini).
 */
export function getRealizationWindow(now: Date = new Date()) {
  const todayStr = toLocalDateKey(now);
  return {
    todayStr,
    yesterdayStr: addDaysToDateKey(todayStr, -1),
    oldestStr: addDaysToDateKey(todayStr, -MAX_REALIZE_BACKDATE_DAYS),
  };
}

export type RealizationEligibility = 'ok' | 'too_old' | 'future';

/**
 * Mengecek apakah rencana pada tanggal tertentu masih boleh diceklis.
 *  - 'too_old' : sudah lewat batas (lebih lama dari kemarin)
 *  - 'future'  : tanggal rencana belum tiba (misal rencana besok)
 */
export function getRealizationEligibility(
  activityDate?: string | null,
  now: Date = new Date()
): RealizationEligibility {
  if (!activityDate) return 'ok';
  const { todayStr, oldestStr } = getRealizationWindow(now);
  const dateKey = String(activityDate).slice(0, 10);
  if (dateKey > todayStr) return 'future';
  if (dateKey < oldestStr) return 'too_old';
  return 'ok';
}

export function getRealizationBlockedMessage(eligibility: RealizationEligibility): string {
  if (eligibility === 'too_old') {
    return 'Batas waktu ceklis sudah lewat. Ceklis realisasi hanya dapat dikerjakan untuk kegiatan hari ini dan kemarin.';
  }
  if (eligibility === 'future') {
    return 'Rencana ini untuk hari berikutnya. Ceklis realisasi baru dapat dikerjakan pada hari pelaksanaannya.';
  }
  return '';
}

/**
 * Menghapus catatan realisasi yang ditempel di akhir deskripsi, menyisakan teks kegiatan aslinya.
 */
export function getBaseDescription(desc?: string | null): string {
  return String(desc || '').split(' | Catatan Realisasi:')[0].trim();
}

/**
 * Jam mulai kegiatan (HH:mm). Memakai jam rencana jika ada, jika tidak memakai jam aktivitas.
 */
export function getActivityStartTime(a: any): string {
  const t = a?.plannedTime || (a?.activity_time ? String(a.activity_time).slice(0, 5) : '') || '00:00';
  return String(t).slice(0, 5);
}

/**
 * Pembanding urutan: jam mulai paling awal (dini hari) lebih dulu sampai paling akhir (malam hari).
 */
export function compareByStartTime(a: any, b: any): number {
  const diff = getActivityStartTime(a).localeCompare(getActivityStartTime(b));
  if (diff !== 0) return diff;
  return String(a?.title || '').localeCompare(String(b?.title || ''));
}

export interface CategoryProgress {
  total: number;
  done: number;
  complete: boolean;
}

export interface DayProgress {
  total: number;
  done: number;
  categories: Record<string, CategoryProgress>;
  completedCategoryCount: number;
  isAllDone: boolean;
}

/**
 * Menghitung progres satu hari. Sebuah kategori dianggap tuntas hanya jika SEMUA kegiatan
 * yang direncanakan pada kategori itu sudah diceklis. Hari dianggap tuntas jika seluruh
 * 7 kategori KAIH sudah tuntas.
 */
export function getDayProgress(activities: ParsedActivity[], dateStr: string): DayProgress {
  const categories: Record<string, CategoryProgress> = {};
  KAIH_CATEGORIES_LIST.forEach((c) => {
    categories[c.key] = { total: 0, done: 0, complete: false };
  });

  let total = 0;
  let done = 0;

  (activities || [])
    .filter((a) => a.activity_date === dateStr)
    .forEach((a) => {
      const key = matchKaihCategoryKey(a.title);
      total += 1;
      const isDone = a.kaihStatus === 'REALISASI';
      if (isDone) done += 1;
      if (key && categories[key]) {
        categories[key].total += 1;
        if (isDone) categories[key].done += 1;
      }
    });

  let completedCategoryCount = 0;
  KAIH_CATEGORIES_LIST.forEach((c) => {
    const cp = categories[c.key];
    cp.complete = cp.total > 0 && cp.done === cp.total;
    if (cp.complete) completedCategoryCount += 1;
  });

  return {
    total,
    done,
    categories,
    completedCategoryCount,
    isAllDone: total > 0 && done === total && completedCategoryCount === KAIH_CATEGORIES_LIST.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  RINCIAN SUB-KEGIATAN PER KATEGORI (UNTUK PROGRES 7 KAIH)
// ═══════════════════════════════════════════════════════════════════════════

export interface KaihSubActivityDef {
  label: string;
  icon: string;
  matchers: string[];
}

/**
 * Rincian sub-kegiatan untuk kategori selain Beribadah, diturunkan dari daftar preset kegiatan.
 * Pencocokan memakai teks kegiatan lengkap (huruf kecil) agar tiap butir tidak saling tertukar.
 */
export function getPresetSubActivityDefs(catKey: string): KaihSubActivityDef[] {
  const cat = KAIH_CATEGORIES_LIST.find((c) => c.key === catKey);
  return (PRESET_ACTIVITIES_BY_CATEGORY[catKey] || []).map((p) => ({
    label: p.shortLabel || p.label,
    icon: p.icon || cat?.icon || '✅',
    matchers: [p.label.toLowerCase()],
  }));
}
