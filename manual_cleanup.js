
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanDuels() {
    try {
        console.log('--- Identificando le giornate APERTE ---');
        const { data: openMDs } = await supabase
            .from('matchdays')
            .select('id')
            .eq('status', 'OPEN');

        const openIds = openMDs?.map(m => m.id) || [];
        console.log('Giornate aperte:', openIds);

        console.log('\n--- Eliminando duelli orfani (non OPEN) ---');
        // Note: This might fail if RLS prevents 'anon' from deleting.
        // However, I will try. If it fails, the user must apply the migration.

        const { data: deleted, error, count } = await supabase
            .from('duels')
            .delete({ count: 'exact' })
            .not('matchday_id', 'in', `(${openIds.join(',')})`);

        if (error) {
            console.error('Errore durante la cancellazione:', error);
            console.log('Probabilmente a causa delle restrizioni RLS. È necessario applicare la migrazione SQL.');
        } else {
            console.log(`Cancellazione riuscita! Duelli rimossi: ${count}`);
        }

    } catch (err) {
        console.error('FATAL:', err);
    }
}

cleanDuels();
