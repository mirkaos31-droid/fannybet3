const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- FB LEAGUES ---');
    const { data: leagues, error: lError } = await supabase.from('fb_leagues').select('*');
    if (lError) console.error(lError);
    else console.table(leagues);

    console.log('--- MATCHDAYS ---');
    const { data: matchdays, error: mError } = await supabase.from('matchdays').select('*').order('id', { ascending: false }).limit(5);
    if (mError) console.error(mError);
    else console.table(matchdays.map(m => ({ id: m.id, status: m.status, deadline: m.deadline, results: m.results ? m.results.join(',') : 'null' })));

    const serieX = leagues?.find(l => l.name.includes('Serie X'));
    if (serieX) {
        console.log(`--- LEGA SERIE X (ID: ${serieX.id}) DETAILS ---`);
        console.log(`Current Round: ${serieX.current_round}`);
        
        console.log('--- MATCHDAY RESULTS FOR THIS LEAGUE ---');
        const { data: results, error: rError } = await supabase.from('fb_league_matchday_results').select('*').eq('league_id', serieX.id);
        if (rError) console.error(rError);
        else {
            const mdCounts = {};
            results.forEach(r => {
                mdCounts[r.matchday_id] = (mdCounts[r.matchday_id] || 0) + 1;
            });
            console.log('Results per matchday:', mdCounts);
        }

        console.log('--- PICKS FOR MATCHDAY 3 IN THIS LEAGUE ---');
        // Matchday 3 might have a specific ID, let's assume it's roughly ID 3 or find it by order
        // But the user said "Gionata 3", which might be the 3rd matchday created.
        // Let's find matchdays ordered by created_at or id
    }
}

run();
