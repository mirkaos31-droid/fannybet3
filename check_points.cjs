const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const leagueId = 2; // Serie X 2026

    for (const matchdayId of [17, 18]) {
        console.log(`--- PICKS FOR LEAGUE ${leagueId}, MATCHDAY ${matchdayId} ---`);
        const { data: picks, error: pError } = await supabase
            .from('fb_league_picks')
            .select('id, user_id, points_earned')
            .eq('league_id', leagueId)
            .eq('matchday_id', matchdayId)
            .limit(5);

        if (pError) console.error(pError);
        else {
            console.table(picks);
        }
    }
}

run();
