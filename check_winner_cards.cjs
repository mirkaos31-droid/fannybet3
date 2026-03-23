const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const winnerId = '11664225-c7d8-40ec-992d-e97712857c3b';

    console.log('--- SURVIVAL RELATED CARDS ---');
    const { data: cards } = await supabase.from('collectible_cards').select('id, title, description').ilike('description', '%survival%');
    console.table(cards);

    console.log(`--- CARDS FOR WINNER ${winnerId} ---`);
    const { data: userCards } = await supabase.from('user_cards').select('card_id, collectible_cards(title)').eq('user_id', winnerId);
    console.table(userCards);
}

run();
