const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Querying function definition...');
    const { data, error } = await supabase.rpc('get_func', { func_name: 'distribute_fb_league_prizes' });
    if (error) {
        // Let's try executing SQL directly using raw SQL via REST API if get_func is not allowed or failed
        console.error('RPC Error:', error);
    } else {
        console.log('Function definition:');
        console.log(data);
    }
}

run();
