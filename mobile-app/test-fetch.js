import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    console.log("Fetching activities for student...");
    // Let's just fetch all activities and evaluations
    const { data, error } = await supabase
        .from('activities')
        .select('title, created_at, evaluations(rating, comment)')
        .order('created_at', { ascending: false })
        .limit(5);
        
    console.log("Error:", error);
    console.log("Data:", JSON.stringify(data, null, 2));
}

test();
