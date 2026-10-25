import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://zshxtebkopkvhdthavhb.supabase.co';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_BWHkngZK_Qym3GwhsJfTYQ___iWtw-n';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkDb() {
  console.log("Authenticating as admin...");
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'syaifulkhalifah@gmail.com',
    password: 'password123' // I don't know the password...
  });
  
  // I can't authenticate without the password.
}

checkDb();
