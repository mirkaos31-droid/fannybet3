
import { createClient } from '@supabase/supabase-client';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkState() {
    console.log('--- Checking Matchdays ---');
    const { data: matchdays, error: mdError } = await supabase
        .from('matchdays')
        .select('id, status, created_at, deadline')
        .order('id', { ascending: false })
        .limit(5);

    if (mdError) console.error('Matchday error:', mdError);
    else console.table(matchdays);

    console.log('\n--- Checking Duels ---');
    const { data: duels, error: duelError } = await supabase
        .from('duels')
        .select('id, matchday_id, status, created_at, challenger_id, opponent_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (duelError) console.error('Duel error:', duelError);
    else console.table(duels);

    const openMatchday = matchdays?.find(m => m.status === 'OPEN');
    if (openMatchday) {
        console.log(`\nCurrent OPEN Matchday: ${openMatchday.id} (Created: ${openMatchday.created_at})`);
        const pendingInOpen = duels?.filter(d => d.matchday_id === openMatchday.id && d.status === 'PENDING');
        console.log(`Pending duels in current OPEN matchday: ${pendingInOpen?.length || 0}`);
    } else {
        console.log('\nNo OPEN matchday found.');
    }
}

checkState();
