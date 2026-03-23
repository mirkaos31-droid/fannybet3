const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const matchdayId = 19;

    console.log(`--- MATCHDAY ${matchdayId} DATA ---`);
    const { data: md } = await supabase.from('matchdays').select('*').eq('id', matchdayId).single();
    if (md) {
        console.log('Results:', md.results);
        console.log('Winners:', md.winners);
        console.log('Winner Animation:', md.winner_animation);
        console.log('Leaderboard Animation:', md.leaderboard_animation);
        console.log('Current Pot:', md.current_pot);
        console.log('Rollover Pot:', md.rollover_pot);
    }

    console.log(`--- BETS FOR MATCHDAY ${matchdayId} ---`);
    const { data: bets } = await supabase.from('bets').select('id, user_id, predictions').eq('matchday_id', matchdayId);
    console.log(`Total bets: ${bets ? bets.length : 0}`);

    if (bets && md.results) {
        let maxScore = 0;
        const scores = bets.map(bet => {
            let s = 0;
            md.results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
            if (s > maxScore) maxScore = s;
            return s;
        });
        console.log('Max Score Found:', maxScore);
        console.log('Scores:', scores);
    }
}

run();
