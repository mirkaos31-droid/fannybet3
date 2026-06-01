const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- LEAGUE DETAILS ---');
    const { data: league } = await supabase.from('fb_leagues').select('*').eq('id', 2).single();
    console.log(league);

    const mds = [24, 25, 26, 27];
    for (const mdId of mds) {
        console.log(`\n--- DETAILS FOR MATCHDAY ${mdId} ---`);
        const { data: md } = await supabase.from('matchdays').select('*').eq('id', mdId).single();
        console.log(`Status: ${md.status}, Results: ${md.results ? md.results.join(',') : 'null'}`);

        const { data: picks } = await supabase.from('fb_league_picks').select('id, user_id, points_earned').eq('league_id', 2).eq('matchday_id', mdId);
        console.log(`Picks count: ${picks ? picks.length : 0}`);
        const unresolved = picks ? picks.filter(p => p.points_earned === null).length : 0;
        console.log(`Unresolved picks: ${unresolved}`);
    }

    console.log('\n--- PARTICIPANTS CURRENT POINTS ---');
    const { data: participants } = await supabase.from('fb_league_participants').select('user_id, total_points').eq('league_id', 2);
    console.table(participants);
}

run();
