
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rzyscsvzentuplsgoipv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6eXNjc3Z6ZW50dXBsc2dvaXB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODgwNTAsImV4cCI6MjA4NDA2NDA1MH0.5n-iXvz7L3VgGhr20l54AQ_HScFmYStEu9co2gElKsU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncProfiles() {
    try {
        console.log('--- FETCHING DATA ---');
        const { data: profiles } = await supabase.from('profiles').select('*');
        const { data: bets } = await supabase.from('bets').select('*');
        const { data: matchdays } = await supabase.from('matchdays').select('*').eq('status', 'ARCHIVED');

        const mdMap = {};
        matchdays.forEach(md => {
            mdMap[md.id] = md.results;
        });

        const milestones = [
            { level: 1, requirements: { bets: 0, wins: 0, tokens: 0 } },
            { level: 2, requirements: { bets: 5, wins: 1, tokens: 100 } },
            { level: 3, requirements: { bets: 15, wins: 3, tokens: 500 } },
            { level: 4, requirements: { bets: 30, wins: 7, tokens: 1500 } },
            { level: 5, requirements: { bets: 50, wins: 15, tokens: 5000 } },
        ];

        for (const profile of profiles) {
            console.log(`\nProcessing user: ${profile.username} (${profile.id})`);

            const userBets = bets.filter(b => b.user_id === profile.id);
            const totalBetsPlaced = userBets.length;

            let totalCorrect = 0;
            let archivedBetsCount = 0;
            let wins1x2Count = 0;
            let totalPts = 0;

            userBets.forEach(bet => {
                const results = mdMap[bet.matchday_id];
                if (results) {
                    archivedBetsCount++;
                    let correct = 0;
                    results.forEach((res, idx) => {
                        if (res && res === bet.predictions[idx]) {
                            correct++;
                        }
                    });
                    totalCorrect += correct;
                    totalPts += correct;
                    if (correct >= 7) {
                        // Assuming wins_1x2 means "won the pot" which requires 7+ hits in current logic
                        wins1x2Count++;
                    }
                }
            });

            // Precision: total_correct / (archived_bets * 12)
            const precision = archivedBetsCount > 0
                ? Math.round((totalCorrect / (archivedBetsCount * 12)) * 100)
                : 0;

            // Level Calculation
            let newLevel = 1;
            const totalWins = wins1x2Count + (profile.wins_survival || 0);
            const totalTokens = profile.total_tokens_won || 0;

            for (let i = milestones.length - 1; i >= 0; i--) {
                const req = milestones[i].requirements;
                if (totalBetsPlaced >= req.bets && totalWins >= req.wins && totalTokens >= req.tokens) {
                    newLevel = milestones[i].level;
                    break;
                }
            }

            console.log(` - Bets Placed: ${totalBetsPlaced}`);
            console.log(` - Total Points (Hits): ${totalPts}`);
            console.log(` - Wins 1X2 (7+ hits): ${wins1x2Count}`);
            console.log(` - Precision: ${precision}%`);
            console.log(` - Calculated Level: ${newLevel}`);

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    bets_placed: totalBetsPlaced,
                    total_points: totalPts,
                    wins_1x2: wins1x2Count,
                    prediction_accuracy: precision,
                    level: newLevel
                })
                .eq('id', profile.id);

            if (updateError) console.error('   Update Error:', updateError);
            else console.log('   Stats Synchronized!');
        }

    } catch (err) {
        console.error('FATAL:', err);
    }
}

syncProfiles();
