
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const LOCAL_URL = 'http://127.0.0.1:54321';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';

console.log(`Checking local Supabase connection at ${LOCAL_URL}...`);

const supabase = createClient(LOCAL_URL, ANON_KEY);

async function checkLocal() {
    try {
        const { data, error } = await supabase.from('profiles').select('count', { count: 'exact', head: true }).limit(0);

        if (error) {
            if (error.message.includes('fetch')) {
                console.error('❌ Local Supabase NOT REACHABLE (is Docker/CLI running?)');
            } else {
                console.error('❌ Local connection failed with error:', error.message);
            }
        } else {
            console.log('✅ Local Supabase is REACHABLE and responding!');
        }
    } catch (err) {
        console.error('❌ Error during local check:', err.message);
    }
}

checkLocal();
