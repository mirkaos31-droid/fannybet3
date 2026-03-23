const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- CALLING RPC get_survival_winner_history ---');
    const { data: winners, error: wError } = await supabase.rpc('get_survival_winner_history', { p_limit: 5 });
    if (wError) console.error(wError);
    else console.table(winners);

    console.log('--- CHECKING PROFILE FOR WINNER 11664225-c7d8-0ec-992d-e97712857c3b ---');
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', '11664225-c7d8-0ec-992d-e97712857c3b').single();
    console.log(profile);
}

run();
