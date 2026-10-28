import { supabase } from './supabase';

export interface KaihSlideConfig {
  id: string;
  order: number;
  title: string;
  habit: string;
  image: string;
  quote: string;
}

export interface LandingPageConfig {
  heroTitle: string;
  heroSubtitle: string;
  feature1: string;
  feature2: string;
  feature3: string;
  logoKaihUrl: string;
  logoYaspenUrl: string;
  slides: KaihSlideConfig[];
}

export interface MasterDataConfig {
  jenjang: string[];
  kelas: string[];
  jurusan: string[];
  agama: string[];
  suku: string[];
}

export const DEFAULT_SLIDES: KaihSlideConfig[] = [
  {
    id: 'slide-1',
    order: 1,
    title: 'Gemar Belajar & Kolaborasi Kelas',
    habit: 'Kebiasaan 5: Gemar Belajar',
    image: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=1400&q=80',
    quote: 'Data akurat, evaluasi tepat, membentuk generasi Indonesia hebat yang berkarakter.',
  },
  {
    id: 'slide-2',
    order: 2,
    title: 'Bangun Pagi & Semangat Disiplin Sekolah',
    habit: 'Kebiasaan 1: Bangun Pagi',
    image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1400&q=80',
    quote: 'Kedisiplinan dimulai sejak pagi hari untuk meraih cita-cita masa depan yang gemilang.',
  },
  {
    id: 'slide-3',
    order: 3,
    title: 'Berolahraga & Kesehatan Fisik Siswa',
    habit: 'Kebiasaan 3: Berolahraga',
    image: 'https://images.unsplash.com/photo-1526676037777-05a232554f77?auto=format&fit=crop&w=1400&q=80',
    quote: 'Di dalam tubuh yang sehat terdapat jiwa dan pikiran yang tangguh serta berprestasi.',
  },
  {
    id: 'slide-4',
    order: 4,
    title: 'Makan Sehat, Bergizi & Beribadah',
    habit: 'Kebiasaan 2 & 4: Beribadah & Sehat',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1400&q=80',
    quote: 'Keseimbangan spiritual, akhlak mulia, dan gizi seimbang menjadi fondasi siswa unggul.',
  },
  {
    id: 'slide-5',
    order: 5,
    title: 'Bermasyarakat & Gotong Royong Positif',
    habit: 'Kebiasaan 6 & 7: Bermasyarakat & Tidur Cepat',
    image: 'https://images.unsplash.com/photo-1529390079861-591de354faf5?auto=format&fit=crop&w=1400&q=80',
    quote: 'Kolaborasi hangat antara guru, siswa, dan orang tua demi pendidikan berdaya saing.',
  },
];

export const DEFAULT_LANDING_CONFIG: LandingPageConfig = {
  heroTitle: 'Selamat Datang di AKTIVITASKU 👋',
  heroSubtitle:
    'Perguruan Budi Utomo — Sistem Informasi Pemantauan & Evaluasi Gerakan 7 Kebiasaan Anak Indonesia Hebat (7 KAIH), Absensi Terpadu, dan Pemetaan Karakter Siswa.',
  feature1: 'Data Siswa & Kelas Terintegrasi',
  feature2: 'Mendukung Karakter 7 KAIH Siswa',
  feature3: 'Transparan dan Akuntabel',
  logoKaihUrl: '/kaih_logo.png',
  logoYaspenUrl: '',
  slides: DEFAULT_SLIDES,
};

export const DEFAULT_MASTER_DATA: MasterDataConfig = {
  jenjang: ['SMK Budi Utomo', 'SMP Budi Utomo', 'SD Budi Utomo'],
  kelas: [
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
  ],
  jurusan: [
    'Umum (SMP)',
    'Bisnis Digital',
    'Manajemen Perkantoran',
    'Teknik Sepeda Motor (TSM)',
    'Akuntansi',
    'Teknik Komputer dan Jaringan (TKJ)',
    'Rekayasa Perangkat Lunak',
  ],
  agama: ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Konghucu'],
  suku: [
    'Jawa',
    'Batak',
    'Melayu',
    'Karo',
    'Mandailing',
    'Minang',
    'Aceh',
    'Sunda',
    'Tionghoa',
    'Nias',
    'Lainnya',
  ],
};

const STORAGE_KEY_MASTER = 'BUDI_UTOMO_MASTER_DATA_V2';
const STORAGE_KEY_LANDING = 'BUDI_UTOMO_LANDING_CONFIG_V2';

// We use the Super Admin's user profile (or any admin) to sync JSON settings to Supabase
const KNOWN_ADMIN_ID = '6d106817-03c9-4bc2-a98f-6eb8b6973774';

interface AppGlobalPayload {
  masterData?: MasterDataConfig;
  landingConfig?: LandingPageConfig;
  updated_at?: string;
}

/**
 * Loads master data from Supabase (with localStorage and default fallbacks)
 */
export async function loadMasterData(): Promise<MasterDataConfig> {
  try {
    const local = localStorage.getItem(STORAGE_KEY_MASTER);
    let current: MasterDataConfig = local ? JSON.parse(local) : DEFAULT_MASTER_DATA;

    // Fetch from Supabase
    const { data } = await supabase
      .from('user_profiles')
      .select('address')
      .eq('user_id', KNOWN_ADMIN_ID)
      .maybeSingle();

    if (data?.address && data.address.startsWith('{')) {
      try {
        const parsed: AppGlobalPayload = JSON.parse(data.address);
        if (parsed.masterData) {
          current = {
            jenjang: parsed.masterData.jenjang?.length ? parsed.masterData.jenjang : DEFAULT_MASTER_DATA.jenjang,
            kelas: parsed.masterData.kelas?.length ? parsed.masterData.kelas : DEFAULT_MASTER_DATA.kelas,
            jurusan: parsed.masterData.jurusan?.length ? parsed.masterData.jurusan : DEFAULT_MASTER_DATA.jurusan,
            agama: parsed.masterData.agama?.length ? parsed.masterData.agama : DEFAULT_MASTER_DATA.agama,
            suku: parsed.masterData.suku?.length ? parsed.masterData.suku : DEFAULT_MASTER_DATA.suku,
          };
          localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(current));
        }
      } catch {
        // use local
      }
    }
    return current;
  } catch (err) {
    console.warn('Error loading master data from Supabase, using local fallback:', err);
    const local = localStorage.getItem(STORAGE_KEY_MASTER);
    return local ? JSON.parse(local) : DEFAULT_MASTER_DATA;
  }
}

/**
 * Loads landing page configuration from Supabase
 */
export async function loadLandingConfig(): Promise<LandingPageConfig> {
  try {
    const local = localStorage.getItem(STORAGE_KEY_LANDING);
    let current: LandingPageConfig = local ? JSON.parse(local) : DEFAULT_LANDING_CONFIG;

    const { data } = await supabase
      .from('user_profiles')
      .select('address')
      .eq('user_id', KNOWN_ADMIN_ID)
      .maybeSingle();

    if (data?.address && data.address.startsWith('{')) {
      try {
        const parsed: AppGlobalPayload = JSON.parse(data.address);
        if (parsed.landingConfig) {
          current = {
            heroTitle: parsed.landingConfig.heroTitle || DEFAULT_LANDING_CONFIG.heroTitle,
            heroSubtitle: parsed.landingConfig.heroSubtitle || DEFAULT_LANDING_CONFIG.heroSubtitle,
            feature1: parsed.landingConfig.feature1 || DEFAULT_LANDING_CONFIG.feature1,
            feature2: parsed.landingConfig.feature2 || DEFAULT_LANDING_CONFIG.feature2,
            feature3: parsed.landingConfig.feature3 || DEFAULT_LANDING_CONFIG.feature3,
            logoKaihUrl: parsed.landingConfig.logoKaihUrl || DEFAULT_LANDING_CONFIG.logoKaihUrl,
            logoYaspenUrl: parsed.landingConfig.logoYaspenUrl || DEFAULT_LANDING_CONFIG.logoYaspenUrl,
            slides: parsed.landingConfig.slides?.length ? parsed.landingConfig.slides : DEFAULT_SLIDES,
          };
          localStorage.setItem(STORAGE_KEY_LANDING, JSON.stringify(current));
        }
      } catch {
        // use local
      }
    }
    return current;
  } catch (err) {
    console.warn('Error loading landing config from Supabase, using local fallback:', err);
    const local = localStorage.getItem(STORAGE_KEY_LANDING);
    return local ? JSON.parse(local) : DEFAULT_LANDING_CONFIG;
  }
}

/**
 * Saves both master data and landing page configuration to Supabase + localStorage
 */
export async function saveAppConfig(params: {
  masterData?: MasterDataConfig;
  landingConfig?: LandingPageConfig;
}): Promise<void> {
  // Read existing
  const [existingMaster, existingLanding] = await Promise.all([
    loadMasterData(),
    loadLandingConfig(),
  ]);

  const updatedMaster = params.masterData || existingMaster;
  const updatedLanding = params.landingConfig || existingLanding;

  // 1. Save to local storage
  if (params.masterData) {
    localStorage.setItem(STORAGE_KEY_MASTER, JSON.stringify(updatedMaster));
  }
  if (params.landingConfig) {
    localStorage.setItem(STORAGE_KEY_LANDING, JSON.stringify(updatedLanding));
  }

  // 2. Save combined payload into admin profile's address column in Supabase
  const payload: AppGlobalPayload = {
    masterData: updatedMaster,
    landingConfig: updatedLanding,
    updated_at: new Date().toISOString(),
  };

  const payloadStr = JSON.stringify(payload);

  const { error } = await supabase
    .from('user_profiles')
    .update({ address: payloadStr })
    .eq('user_id', KNOWN_ADMIN_ID);

  if (error) {
    console.error('Failed to sync config to Supabase:', error);
    throw new Error('Gagal menyimpan ke server Supabase: ' + error.message);
  }
}
