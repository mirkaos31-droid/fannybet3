
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPicks() {
    try {
        const { data: md11 } = await supabase
            .from('matchdays')
            .select('id')
            .eq('status', 'ARCHIVED')
            .order('id', { ascending: false })
            .limit(1);

        const lastId = md11?.[0]?.id;
        console.log('Last Archived Matchday ID:', lastId);

        if (lastId) {
            const { data: picks } = await supabase
                .from('survival_picks')
                .select('*, survival_players(user_id, profiles(username))')
                .eq('matchday_id', lastId);

            console.log(`Found ${picks?.length || 0} picks for MD ${lastId}.`);
            console.log(JSON.stringify(picks, null, 2));
        }

    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkPicks();
