import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function login() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'siswa1@budiutomo.com',
    password: 'siswa123'
  });

  if (error) {
    console.error('Login failed:', error.message);
  } else {
    console.log('Login successful:', data.user?.email);
  }
}

login();
