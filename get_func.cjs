const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.rpc('get_function_source', { p_name: 'resolve_fb_league_round' });
    if (error) {
        // Try direct query if RPC doesn't exist
        const { data: data2, error: error2 } = await supabase.from('pg_proc').select('prosrc').eq('proname', 'resolve_fb_league_round');
        if (error2) console.error('Error fetching from pg_proc:', error2);
        else if (data2 && data2.length > 0) console.log(data2[0].prosrc);
        else console.log('Function not found in pg_proc');
    } else {
        console.log(data);
    }
}

run();
