const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.rpc('get_function_source', { p_name: 'resolve_fb_league_round' });
    if (error) {
        // Fallback: try to query pg_proc
        const { data: data2, error: error2 } = await supabase.from('pg_proc').select('prosrc').eq('proname', 'resolve_fb_league_round');
        if (error2) console.error(error2);
        else console.log(data2[0]?.prosrc);
    } else {
        console.log(data);
    }
}

async function checkStatus() {
     const { data, error } = await supabase.from('matchdays').select('id, status').in('id', [17, 18, 19]);
     console.table(data);
}

checkStatus();
