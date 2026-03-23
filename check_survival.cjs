const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('--- SURVIVAL SEASONS ---');
    const { data: seasons } = await supabase.from('survival_seasons').select('*').order('id', { ascending: false }).limit(5);
    console.table(seasons);

    if (seasons && seasons.length > 0) {
        const lastSeasonId = seasons[0].status === 'OPEN' || seasons[0].status === 'ACTIVE' ? (seasons[1] ? seasons[1].id : null) : seasons[0].id;
        if (lastSeasonId) {
            console.log(`--- PLAYERS FOR SEASON ${lastSeasonId} ---`);
            const { data: players } = await supabase.from('survival_players').select('id, user_id, status').eq('season_id', lastSeasonId);
            console.table(players);
        }
    }
}

run();
