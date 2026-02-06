
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
    try {
        console.log('--- Checking Bets for Matchday 12 ---');
        const { data: bets, error: betError } = await supabase
            .from('bets')
            .select('id, user_id, matchday_id, created_at')
            .eq('matchday_id', 12);

        if (betError) console.error('Bet error:', betError);
        else {
            console.log(`Found ${bets?.length || 0} bets.`);
            console.log(JSON.stringify(bets, null, 2));
        }

    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkState();
