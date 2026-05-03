import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: profiles } = await supabase.from('profiles').select('id, username').limit(1);
    if (!profiles || profiles.length === 0) {
        console.log('No profiles found');
        return;
    }

    const user = profiles[0];
    console.log(`Sending notification to ${user.username} (${user.id})`);

    const { error } = await supabase.from('notifications').insert([
        {
            user_id: user.id,
            title: 'Protocol Test',
            message: 'Il sistema audio è attivo. Benvenuto nell\'Arena, Fanny!',
            type: 'info'
        }
    ]);

    if (error) console.error(error);
    else console.log('Notification sent successfully!');
}

test();
