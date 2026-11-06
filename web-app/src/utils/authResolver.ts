import { supabase } from './supabase';

/**
 * Normalizes input and resolves an identifier (Email, NISN, or NIK)
 * to the actual registered authentication email in Supabase.
 */
export async function resolveLoginIdentifier(
  rawInput: string,
  preferredRole?: 'siswa' | 'guru'
): Promise<string> {
  const clean = (rawInput || '').trim();
  if (!clean) return '';

  // 1. If user typed an email (contains '@'), return lowercase
  if (clean.includes('@')) {
    return clean.toLowerCase();
  }

  // 2. Clean digits (remove spaces, dots, dashes)
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

    // 4. Search in teachers table by NIK, NUPTK, or NIP
    const { data: teaList } = await supabase
      .from('teachers')
      .select('nik, nuptk, nip, user_profiles(user_id, users(email))')
      .or(`nik.eq.${digitsOnly},nuptk.eq.${digitsOnly},nip.eq.${digitsOnly}`)
      .limit(1);

    if (teaList && teaList.length > 0) {
      const email = (teaList[0].user_profiles as any)?.users?.email;
      if (email) return String(email).toLowerCase().trim();
    }

    // 5. Check if student has NISN stored in notes JSON
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
    console.warn('Gagal mencari akun melalui NISN/NIK:', err);
  }

  // 6. Fallback virtual alias if record not found in query (e.g. direct virtual accounts)
  if (preferredRole === 'siswa') {
    return `${digitsOnly}@siswa.budiutomo.id`;
  }
  if (preferredRole === 'guru') {
    return `${digitsOnly}@guru.budiutomo.id`;
  }

  // Default fallback for portal login
  return `${digitsOnly}@budiutomo.sch.id`;
}

/**
 * Checks if an email is an auto-generated virtual email for users without private emails.
 */
export function isVirtualEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.toLowerCase();
  return (
    lower.endsWith('@siswa.budiutomo.id') ||
    lower.endsWith('@guru.budiutomo.id') ||
    lower.endsWith('@budiutomo.sch.id')
  );
}

/**
 * Formats virtual emails for clean display in UI (extracting NISN or NIK).
 */
export function formatDisplayIdentifier(email?: string | null): string {
  if (!email) return '-';
  if (isVirtualEmail(email)) {
    const prefix = email.split('@')[0];
    return prefix;
  }
  return email;
}
