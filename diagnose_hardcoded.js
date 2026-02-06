
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
    try {
        console.log('--- Checking Matchdays ---');
        const { data: matchdays, error: mdError } = await supabase
            .from('matchdays')
            .select('id, status, created_at, deadline')
            .order('id', { ascending: false })
            .limit(5);

        if (mdError) console.error('Matchday error:', mdError);
        else console.log(JSON.stringify(matchdays, null, 2));

        console.log('\n--- Checking Duels ---');
        const { data: duels, error: duelError } = await supabase
            .from('duels')
            .select('id, matchday_id, status, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (duelError) console.error('Duel error:', duelError);
        else console.log(JSON.stringify(duels, null, 2));

        const openMatchday = matchdays?.find(m => m.status === 'OPEN');
        if (openMatchday) {
            console.log(`\nCurrent OPEN Matchday: ${openMatchday.id} (Created: ${openMatchday.created_at})`);
            const { data: pendingDuels } = await supabase
                .from('duels')
                .select('id')
                .eq('matchday_id', openMatchday.id)
                .eq('status', 'PENDING');

            console.log(`Pending duels in current OPEN matchday: ${pendingDuels?.length || 0}`);
        } else {
            console.log('\nNo OPEN matchday found.');
        }
    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkState();
