const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const leagueId = 2; // Serie X 2026
    const matchdayId = 19; // The one that should be Round 3

    console.log(`--- PICKS FOR LEAGUE ${leagueId}, MATCHDAY ${matchdayId} ---`);
    const { data: picks, error: pError } = await supabase
        .from('fb_league_picks')
        .select('id, user_id, points_earned')
        .eq('league_id', leagueId)
        .eq('matchday_id', matchdayId);

    if (pError) console.error(pError);
    else {
        console.log(`Total picks: ${picks.length}`);
        console.log(`Unresolved picks (points_earned is null): ${picks.filter(p => p.points_earned === null).length}`);
    }

    console.log('--- LEAGUE STATUS ---');
    const { data: league } = await supabase.from('fb_leagues').select('*').eq('id', leagueId).single();
    console.log(`League: ${league.name}, Status: ${league.status}, Current Round: ${league.current_round}`);
}

run();
