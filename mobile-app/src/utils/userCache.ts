import { supabase } from './supabase';

export interface UserCacheData {
  user: any;
  profile: any;
  student: any;
}

let cachedData: UserCacheData | null = null;
let fetchPromise: Promise<UserCacheData | null> | null = null;

export async function getUserStudentProfile(forceRefresh = false): Promise<UserCacheData | null> {
  if (cachedData && cachedData.student && !forceRefresh) {
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
  const s = userCacheData.student;

  const hasName = Boolean(p.full_name && p.full_name.trim());
  const hasPhone = Boolean(p.phone && p.phone.trim());
  const hasAddress = Boolean(p.address && p.address.trim());

  if (!hasName || !hasPhone || !hasAddress) return false;
  if (!s) return false;

  const hasNisnOrNis = Boolean((s.nisn && s.nisn.trim()) || (s.nis && s.nis.trim()));
  const hasEduLevel = Boolean(s.education_level && s.education_level.trim());

  let notesObj: any = {};
  try { if (s.notes) notesObj = JSON.parse(s.notes); } catch (e) {}
  const hasKelas = Boolean(notesObj.kelas && notesObj.kelas.trim());

  if (!hasNisnOrNis || !hasEduLevel || !hasKelas) return false;

  return true;
}

export function clearUserCache() {
  cachedData = null;
  fetchPromise = null;
}
