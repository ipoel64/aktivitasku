import { supabase } from './supabase';

export interface UserCacheData {
  user: any;
  profile: any;
  student: any;
}

let cachedData: UserCacheData | null = null;
let fetchPromise: Promise<UserCacheData | null> | null = null;

export function getCachedUserStudentProfile(): UserCacheData | null {
  return cachedData;
}

/**
 * Sinkronkan cache langsung dari state profileData di halaman Profil
 * agar pengecekan kelengkapan profil di TabLayout & Dashboard selalu instan & akurat.
 */
export function syncUserCacheFromProfileData(profileData: any) {
  if (!profileData) return;
  const rawStudent = profileData.students;
  const student = (Array.isArray(rawStudent) ? rawStudent[0] : rawStudent) || cachedData?.student || null;
  cachedData = {
    user: cachedData?.user || { id: profileData.user_id || profileData.id },
    profile: {
      id: profileData.id,
      full_name: profileData.full_name,
      photo_url: profileData.photo_url,
      phone: profileData.phone,
      address: profileData.address,
      latitude: profileData.latitude,
      longitude: profileData.longitude,
      gender: profileData.gender,
      religion: profileData.religion,
      birth_date: profileData.birth_date,
    },
    student,
  };
}

export async function getUserStudentProfile(forceRefresh = false): Promise<UserCacheData | null> {
  if (cachedData && cachedData.student && isProfileComplete(cachedData) && !forceRefresh) {
    return cachedData;
  }

  if (fetchPromise && !forceRefresh) {
    return fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));

      const queryPromise = (async (): Promise<UserCacheData | null> => {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData?.user;
        if (!user) return null;

        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id, full_name, photo_url, phone, address, latitude, longitude, gender, religion, birth_date')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile) return { user, profile: null, student: null };

        let student = null;
        const { data: st1 } = await supabase
          .from('students')
          .select('*')
          .eq('profile_id', profile.id)
          .maybeSingle();

        student = st1;
        return { user, profile, student };
      })();

      const result = await Promise.race([queryPromise, timeoutPromise]);
      if (result) {
        cachedData = result;
      }
      return cachedData;
    } catch (e) {
      console.error('Error fetching user student profile:', e);
      return cachedData;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function isProfileComplete(userCacheData: UserCacheData | null): boolean {
  if (!userCacheData || !userCacheData.user || !userCacheData.profile) {
    return false;
  }
  const p = userCacheData.profile;
  const rawS = userCacheData.student;
  const s = Array.isArray(rawS) ? rawS[0] : rawS;

  const hasName = Boolean(p.full_name && String(p.full_name).trim());
  const hasPhone = Boolean(p.phone && String(p.phone).trim());
  const hasAddress = Boolean(p.address && String(p.address).trim());

  if (!hasName || !hasPhone || !hasAddress) return false;
  if (!s) return false;

  const hasNisnOrNis = Boolean((s.nisn && String(s.nisn).trim()) || (s.nis && String(s.nis).trim()));

  let notesObj: any = {};
  try { if (s.notes) notesObj = typeof s.notes === 'string' ? JSON.parse(s.notes) : s.notes; } catch (e) {}

  const hasEduLevel = Boolean(
    (s.education_level && String(s.education_level).trim()) ||
    (notesObj.jenjang && String(notesObj.jenjang).trim())
  );
  const hasKelas = Boolean(notesObj.kelas && String(notesObj.kelas).trim());

  if (!hasNisnOrNis || !hasEduLevel || !hasKelas) return false;

  return true;
}

export function clearUserCache() {
  cachedData = null;
  fetchPromise = null;
}
