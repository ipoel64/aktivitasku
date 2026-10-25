const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: 'postgresql://postgres.zshxtebkopkvhdthavhb:Budiutomo123%21@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
  });
  
  try {
    await client.connect();
    
    // Check evaluations
    const evals = await client.query('SELECT * FROM evaluations');
    console.log('Evaluations Data:', evals.rows);
    
    // Check policies
    const policies = await client.query("SELECT tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'evaluations'");
    console.log('Evaluations Policies:', policies.rows);
    
  } catch (e) {
    console.error(e);
  } finally {
    await client.end();
  }
}

run();
