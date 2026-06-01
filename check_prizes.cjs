const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log('Fetching league details...');
    const { data: league, error: lError } = await supabase
        .from('fb_leagues')
        .select('*')
        .eq('id', 2)
        .single();
    
    if (lError) {
        console.error('League Error:', lError);
        return;
    }
    console.log('League:', league);

    console.log('\nFetching participants...');
    const { data: participants, error: pError } = await supabase
        .from('fb_league_participants')
        .select('*')
        .eq('league_id', 2)
        .order('total_points', { ascending: false });

    if (pError) {
        console.error('Participants Error:', pError);
        return;
    }
    console.log('Participants Count:', participants.length);
    console.table(participants.map(p => ({
        user_id: p.user_id,
        total_points: p.total_points,
    })));

    console.log('\nFetching Profiles...');
    const userIds = participants.map(p => p.user_id);
    const { data: profiles, error: prError } = await supabase
        .from('profiles')
        .select('id, username, tokens, total_tokens_won, role')
        .in('id', userIds);

    if (prError) {
        console.error('Profiles Error:', prError);
    } else {
        console.log('Profiles Count:', profiles.length);
        console.table(profiles);
    }

    console.log('\nFetching Collectible Cards...');
    const { data: cards, error: cError } = await supabase
        .from('collectible_cards')
        .select('id, title');
    
    if (cError) {
        console.error('Cards Error:', cError);
    } else {
        console.log('Cards found:');
        console.table(cards);
    }

    console.log('\nFetching League Matchdays...');
    const { data: leagueMatchdays, error: lmError } = await supabase.rpc('get_fb_league_matchdays', {
        p_league_id: 2
    });
    if (lmError) {
        console.error('League Matchdays Error:', lmError);
    } else {
        console.log('League Matchdays:');
        console.table(leagueMatchdays);
    }
}

run();
