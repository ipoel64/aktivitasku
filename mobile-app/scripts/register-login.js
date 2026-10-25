import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function registerAndLogin() {
  const email = 'siswa5@budiutomo.com';
  const password = 'password123';

  console.log(`Registering ${email}...`);
  const { data: regData, error: regError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'student',
        full_name: 'Siswa Lima'
      }
    }
  });

  if (regError) {
    console.error('Registration failed:', regError.message);
  } else {
    console.log('User registered successfully');
    
    // Now try to login immediately to check if email confirmation is required
    console.log('Attempting login...');
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (loginError) {
      console.error('Login failed:', loginError.message);
    } else {
      console.log('Login successful:', loginData.user?.email);
    }
  }
}

registerAndLogin();
