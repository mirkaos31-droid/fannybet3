const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const leagueId = 2; // Serie X 2026
    const matchdayId = 19;

    console.log(`--- STATUS OF LEAGUE ${leagueId} ---`);
    const { data: league } = await supabase.from('fb_leagues').select('*').eq('id', leagueId).single();
    console.log(`Current Round: ${league.current_round}`);

    console.log(`--- RESULTS FOR MATCHDAY ${matchdayId} ---`);
    const { data: results } = await supabase.from('fb_league_matchday_results').select('*').eq('league_id', leagueId).eq('matchday_id', matchdayId);
    console.log(`Results found: ${results ? results.length : 0}`);
}

run();
