import { supabase } from './supabase';

/**
 * Resolves an identifier (Email or NISN) for mobile app students
 * to the actual registered authentication email in Supabase.
 */
export async function resolveStudentLoginIdentifier(rawInput: string): Promise<string> {
  const clean = (rawInput || '').trim();
  if (!clean) return '';

  // 1. If it's already an email, return lowercase
  if (clean.includes('@')) {
    return clean.toLowerCase();
  }

  // 2. Normalize digits
  const digitsOnly = clean.replace(/[\s.-]/g, '');

  try {
    // 3. Search in students table by NISN
    const { data: stuList } = await supabase
      .from('students')
      .select('nisn, user_profiles(user_id, users(email))')
      .eq('nisn', digitsOnly)
      .limit(1);

    if (stuList && stuList.length > 0) {
      const email = (stuList[0].user_profiles as any)?.users?.email;
      if (email) return String(email).toLowerCase().trim();
    }

    // 4. Check notes JSON fallback
    const { data: notesStuList } = await supabase
      .from('students')
      .select('notes, user_profiles(user_id, users(email))')
      .ilike('notes', `%"nisn":"${digitsOnly}"%`)
      .limit(1);

    if (notesStuList && notesStuList.length > 0) {
      const email = (notesStuList[0].user_profiles as any)?.users?.email;
      if (email) return String(email).toLowerCase().trim();
    }
  } catch (err) {
    console.warn('Gagal mencari akun siswa melalui NISN:', err);
  }

  // 5. Fallback virtual alias for students without personal email
  return `${digitsOnly}@siswa.budiutomo.id`;
}

/**
 * Generates an internal virtual email for a student using their NISN.
 */
export function generateStudentVirtualEmail(nisn: string): string {
  const clean = nisn.replace(/[\s.-]/g, '').trim();
  return `${clean}@siswa.budiutomo.id`;
}
