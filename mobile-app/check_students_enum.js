const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zshxtebkopkvhdthavhb.supabase.co';
const supabaseKey = 'sb_publishable_BWHkngZK_Qym3GwhsJfTYQ___iWtw-n';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testEnums() {
  const tests = ['SD', 'SMP', 'SMA', 'SMK', 'SMK Budi Utomo'];
  for (const t of tests) {
    try {
      const { error } = await supabase
        .from('students')
        .update({ education_level: t })
        .eq('id', '978673a3-858f-489d-ab2e-cfd75e5e9146');
      console.log(`Value "${t}":`, error ? error.message : 'SUCCESS');
    } catch (e) {
      console.log(`Value "${t}": FETCH EXCEPTION -`, e.message);
    }
  }
}

testEnums();
