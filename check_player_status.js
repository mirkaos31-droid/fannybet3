
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayer() {
    try {
        const { data: players, error } = await supabase
            .from('survival_players')
            .select('*, survival_seasons(*)')
            .eq('user_id', '38e3164b-2c9a-4fe3-9a77-5057996b0e13');

        if (error) console.error('Error:', error);
        else console.log(JSON.stringify(players, null, 2));

    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkPlayer();
