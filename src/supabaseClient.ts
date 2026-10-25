import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables!');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
    realtime: {
        params: {
            eventsPerSecond: 40,
        },
        heartbeatIntervalMs: 15000,
        timeout: 30000,
    },
});
