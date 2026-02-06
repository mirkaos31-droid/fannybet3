
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
    try {
        console.log('--- Checking ALL Duels ---');
        const { data: duels, error: duelError } = await supabase
            .from('duels')
            .select('id, matchday_id, status, created_at, challenger_id, opponent_id');

        if (duelError) console.error('Duel error:', duelError);
        else console.log(JSON.stringify(duels, null, 2));

    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkState();
