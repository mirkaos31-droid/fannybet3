const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const matchdayId = 19;
    const { data: bets } = await supabase.from('bets').select('id, user_id, amount').eq('matchday_id', matchdayId);
    console.table(bets);

    const { data: md } = await supabase.from('matchdays').select('current_pot, rollover_pot').eq('id', matchdayId).single();
    console.log('Matchday Pot State:', md);
}

run();
