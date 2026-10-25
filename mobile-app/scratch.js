const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .ilike('full_name', '%siswa5%');

  if (error) {
    console.error('Error finding profile:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found profile:', data[0].id);
    const { error: delError } = await supabase
      .from('user_profiles')
      .delete()
      .eq('id', data[0].id);
      
    if (delError) {
      console.error('Failed to delete:', delError);
    } else {
      console.log('Successfully deleted profile for siswa5.');
    }
  } else {
    console.log('Profile for siswa5 not found.');
  }
}

run();
