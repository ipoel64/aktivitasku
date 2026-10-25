import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function register() {
  const { data, error } = await supabase.auth.signUp({
    email: 'siswa1@budiutomo.com',
    password: 'siswa123',
    options: {
      data: {
        role: 'student',
        full_name: 'Budi Santoso'
      }
    }
  });

  if (error) {
    console.error('Registration failed:', error.message);
  } else {
    console.log('User registered successfully:', data.user?.email);
    
    // Check if the user is in the public.users table (trigger handles this usually)
    const { data: userRow } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single();
      
    console.log('Public user record:', userRow);
  }
}

register();
