const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zshxtebkopkvhdthavhb.supabase.co';
const supabaseKey = 'sb_publishable_BWHkngZK_Qym3GwhsJfTYQ___iWtw-n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfileAutoCreate() {
  const { data: users, error: uErr } = await supabase.auth.admin.listUsers().catch(() => ({ data: null }));
  
  const { data: profiles } = await supabase.from('user_profiles').select('id, user_id, full_name');
  console.log('Total user_profiles in DB:', profiles?.length, profiles);
}

testProfileAutoCreate();
