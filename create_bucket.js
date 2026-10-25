const { Client } = require('pg');

async function run() {
  const client = new Client({
    connectionString: "postgresql://postgres.zshxtebkopkvhdthavhb:Budiutomo123%21@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL");
    const res = await client.query("INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;");
    console.log("Bucket creation successful:", res.rowCount);
    
    // Also create RLS policies for storage.objects so anyone can upload/select/update
    // First check if policy exists, if not, create it
    const policyQuery = `
      -- Allow public access to avatars bucket
      DO $$
      BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND policyname = 'Public Access for Avatars'
        ) THEN
            CREATE POLICY "Public Access for Avatars" ON storage.objects FOR ALL USING (bucket_id = 'avatars');
        END IF;
      END
      $$;
    `;
    await client.query(policyQuery);
    console.log("Policies updated.");
  } catch (e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}

run();
