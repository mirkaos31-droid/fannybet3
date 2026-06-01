const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function resetTokens() {
    const users = ['Sabato', 'ZeroByte'];
    
    try {
        for (const username of users) {
            console.log(`\nResetting tokens for ${username}...`);
            
            // First, get the user to verify they exist
            const { data: userData, error: selectError } = await supabase
                .from('profiles')
                .select('id, username, tokens')
                .eq('username', username)
                .single();
            
            if (selectError) {
                console.error(`Error finding ${username}:`, selectError.message);
                continue;
            }
            
            if (!userData) {
                console.log(`User ${username} not found`);
                continue;
            }
            
            console.log(`Found: ${userData.username} - Current tokens: ${userData.tokens}`);
            
            // Update tokens to 0
            const { data: updateData, error: updateError } = await supabase
                .from('profiles')
                .update({ tokens: 0 })
                .eq('username', username)
                .select('id, username, tokens');
            
            if (updateError) {
                console.error(`Error updating ${username}:`, updateError.message);
                continue;
            }
            
            console.log(`✓ ${username} tokens reset to 0`);
            console.log(`Updated data:`, updateData);
        }
        
        console.log('\n--- Summary ---');
        const { data: finalCheck, error: checkError } = await supabase
            .from('profiles')
            .select('username, tokens')
            .in('username', ['Sabato', 'ZeroByte']);
        
        if (!checkError) {
            console.table(finalCheck);
        }
        
    } catch (error) {
        console.error('Unexpected error:', error);
    }
}

resetTokens();
