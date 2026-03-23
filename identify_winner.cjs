const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const matchdayId = 19;
    const { data: bets } = await supabase.from('bets').select('id, user_id, predictions, profiles(username)').eq('matchday_id', matchdayId);
    
    const { data: md } = await supabase.from('matchdays').select('results').eq('id', matchdayId).single();
    
    if (bets && md.results) {
        bets.forEach(bet => {
            let s = 0;
            md.results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
            const profile = Array.isArray(bet.profiles) ? bet.profiles[0] : bet.profiles;
            console.log(`User: ${profile?.username}, Score: ${s}, ID: ${bet.user_id}`);
        });
    }
}

run();
