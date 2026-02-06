
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUsers() {
    try {
        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, username, role');

        if (error) console.error('Error:', error);
        else {
            console.log(`Found ${profiles.length} profiles.`);
            console.log(profiles);
        }

    } catch (err) {
        console.error('FATAL:', err);
    }
}

checkUsers();
