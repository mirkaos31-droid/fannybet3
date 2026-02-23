import { supabase } from '../supabaseClient';
import type { Matchday, Match, Bet } from '../types';
import { survivalService } from './survivalService'; // Warning: Circular dependency risk if not careful, but processSurvivalRound uses getMatchday.
// We should probably decouple this. 
// For now, let's keep getMatchday here and pass it to survivalService where needed, OR duplicate/move logic.
// In the original gameService, survivalService.processSurvivalRound called gameService.getMatchday.
// I will keep getMatchday here.

export const bettingService = {
    // --- DATA ACCESS ---
    getMatchday: async (): Promise<Matchday | null> => {
        // Get the active OPEN matchday
        const { data, error } = await supabase
            .from('matchdays')
            .select('*')
            .eq('status', 'OPEN')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            matches: data.matches as Match[],
            results: data.results as (string | null)[],
            superJackpot: data.super_jackpot,
            currentPot: data.current_pot,
            rolloverPot: data.rollover_pot,
            status: data.status as 'OPEN' | 'CLOSED' | 'ARCHIVED',
            deadline: data.deadline,
            betsLocked: data.bets_locked || false,
            winners: data.winners || [],
            winnerAnimation: data.winner_animation || false,
            leaderboardAnimation: data.leaderboard_animation || false,
            jollyMatchIndex: data.jolly_match_index
        };
    },

    getArchivedMatchdays: async (): Promise<Matchday[]> => {
        const { data } = await supabase
            .from('matchdays')
            .select('*')
            .eq('status', 'ARCHIVED')
            .order('id', { ascending: false });

        if (!data) return [];

        return data.map(d => ({
            id: d.id,
            matches: d.matches as Match[],
            results: d.results as (string | null)[],
            superJackpot: d.super_jackpot,
            currentPot: d.current_pot,
            rolloverPot: d.rollover_pot,
            status: d.status as 'ARCHIVED',
            deadline: d.deadline,
            betsLocked: d.bets_locked || false,
            winners: d.winners || [],
            winnerAnimation: d.winner_animation || false,
            leaderboardAnimation: d.leaderboard_animation || false,
            jollyMatchIndex: d.jolly_match_index
        }));
    },

    getGlobalRanking: async (): Promise<{ username: string; totalPoints: number; level: number; avatarUrl?: string }[]> => {
        const { data } = await supabase
            .from('profiles')
            .select('username, total_points, level, avatar_url')
            .order('total_points', { ascending: false })
            .limit(100);

        if (!data) return [];

        return data.map(d => ({
            username: d.username,
            totalPoints: d.total_points || 0,
            level: d.level || 1,
            avatarUrl: d.avatar_url
        }));
    },

    getAllBets: async (): Promise<Bet[]> => {
        const { data } = await supabase
            .from('bets')
            .select(`
                *,
                profiles (username, avatar_url, level)
            `);

        if (!data) return [];

        return data.map(b => {
            const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
            return {
                id: b.id,
                username: profile?.username || 'Sconosciuto',
                avatarUrl: profile?.avatar_url,
                level: profile?.level || 1,
                matchdayId: b.matchday_id,
                predictions: b.predictions,
                includeSuperJackpot: b.include_super_jackpot,
                timestamp: b.created_at || new Date().toISOString()
            };
        });
    },

    getUserBets: async (username: string): Promise<Bet[]> => {
        const md = await bettingService.getMatchday();
        if (!md) return [];

        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (!profile) return [];

        const { data: bets } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', profile.id)
            .eq('matchday_id', md.id)
            .order('created_at', { ascending: false });

        if (!bets) return [];

        return bets.map(bet => ({
            id: bet.id,
            username: username,
            matchdayId: bet.matchday_id,
            predictions: bet.predictions,
            includeSuperJackpot: bet.include_super_jackpot,
            timestamp: bet.created_at || new Date().toISOString()
        }));
    },

    // --- ACTIONS ---
    placeBet: async (predictions: string[], includeSuperJackpot: boolean): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('submit_1x2_bet', {
            p_predictions: predictions,
            p_include_super_jackpot: includeSuperJackpot
        });

        if (error) return { success: false, message: error.message };

        const res = data as { success: boolean, message: string };

        if (res.success) {
            // Proactively recalculate pot for UI immediate consistency
            await bettingService.recalculatePot();
        }

        return res;
    },

    // --- ADMIN ACTIONS ---
    createMatchday: async (): Promise<{ success: boolean, message: string }> => {
        const { data, error } = await supabase.rpc('admin_create_matchday');
        if (error) return { success: false, message: error.message };
        const result = data as { success: boolean, message: string };
        return result;
    },

    updateMatch: async (idx: number, newMatch: Match) => {
        const md = await bettingService.getMatchday();
        if (!md) return;

        const updatedMatches = [...md.matches];
        updatedMatches[idx] = newMatch;

        await supabase
            .from('matchdays')
            .update({ matches: updatedMatches })
            .eq('id', md.id);
    },

    updateMatchResult: async (idx: number, result: string | null) => {
        const md = await bettingService.getMatchday();
        if (!md) return;

        const updatedResults = [...md.results];
        updatedResults[idx] = result;

        await supabase
            .from('matchdays')
            .update({ results: updatedResults })
            .eq('id', md.id);
    },

    updateSuperJackpot: async (amount: number) => {
        const md = await bettingService.getMatchday();
        if (!md) return;

        await supabase.from('matchdays').update({ super_jackpot: amount }).eq('id', md.id);
    },

    updateDeadline: async (deadline: string) => {
        const md = await bettingService.getMatchday();
        if (!md) return;

        // Set the deadline; bets remain allowed until that timestamp (server-time comparison)
        await supabase.from('matchdays').update({ deadline }).eq('id', md.id);
    },

    setBetLock: async (lock: boolean) => {
        const md = await bettingService.getMatchday();
        if (!md) return { success: false, message: 'No active matchday' };

        const { error } = await supabase.from('matchdays').update({ bets_locked: lock }).eq('id', md.id);
        if (error) return { success: false, message: error.message };
        return { success: true };
    },

    resetMatchday: async () => {
        const md = await bettingService.getMatchday();
        if (!md) return;

        // Clear results
        await supabase
            .from('matchdays')
            .update({ results: Array(12).fill(null) })
            .eq('id', md.id);

        // Delete bets
        await supabase
            .from('bets')
            .delete()
            .eq('matchday_id', md.id);
    },


    archiveMatchday: async (): Promise<{ success: boolean; message: string; survivalStats?: { eliminated: number; advanced: number } }> => {
        const md = await bettingService.getMatchday();
        if (!md) return { success: false, message: "Nessuna giornata attiva" };

        let survivalStats = undefined;

        // 1. AUTO-PROCESS SURVIVAL ROUND
        try {
            console.log("Auto-processing Survival Round...");
            const survivalRes = await survivalService.processSurvivalRound(md.id);
            if (survivalRes.success) {
                console.log("Survival Round Processed:", survivalRes);
                survivalStats = {
                    eliminated: survivalRes.eliminated || 0,
                    advanced: survivalRes.advanced || 0
                };
            } else {
                console.warn("Survival Process Warning:", survivalRes.message);
            }
        } catch (err) {
            console.error("Survival Process Error:", err);
        }


        // 2. CALCULATE 1X2 WINNERS & SUPER JACKPOT
        const { data: currentBetsData } = await supabase
            .from('bets')
            .select(`
                *,
                profiles (username, avatar_url, level)
            `)
            .eq('matchday_id', md.id);

        const currentBets = (currentBetsData || []).map(b => {
            const profile = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
            return {
                id: b.id,
                username: profile?.username || 'Sconosciuto',
                avatarUrl: profile?.avatar_url,
                level: profile?.level || 1,
                matchdayId: b.matchday_id,
                predictions: b.predictions,
                includeSuperJackpot: b.include_super_jackpot,
                timestamp: b.created_at || new Date().toISOString()
            };
        });

        let maxScore = 0;
        currentBets.forEach(bet => {
            let s = 0;
            md.results.forEach((res, idx) => {
                if (res && res === bet.predictions[idx]) s++;
            });
            if (s > maxScore) maxScore = s;
        });

        const currentTotalPot = md.currentPot || 0;
        const currentSuper = md.superJackpot || 0;
        let nextRollover = 0;
        let winnerMsg = "";

        // --- STANDARD POT DISTRIBUTION (Score >= 7) ---
        let standardWinnersUsernames: string[] = [];
        let standardShare = 0;

        if (maxScore >= 7) {
            console.log("STANDARD POT WINNER(S) FOUND");

            // Identify winners (exactly those with maxScore)
            const winners = currentBets.filter(bet => {
                let s = 0;
                md.results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
                return s === maxScore;
            });

            const winnersCount = winners.length;

            // Distribute STANDARD POT equally among winners; burn remainder if odd
            const totalPayout = Math.floor(currentTotalPot);
            standardShare = winnersCount > 0 ? Math.floor(totalPayout / winnersCount) : 0;
            const remainder = winnersCount > 0 ? (totalPayout % winnersCount) : totalPayout;

            standardWinnersUsernames = winners.map(w => w.username);

            // Update each winner profile for Standard Pot
            for (const w of standardWinnersUsernames) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, tokens, wins1x2, total_tokens_won')
                    .eq('username', w)
                    .single();

                if (!profile) continue;

                const newTokens = (profile.tokens || 0) + standardShare;
                const newWins = (profile.wins1x2 || 0) + 1;
                const newTotalWon = (profile.total_tokens_won || 0) + standardShare;

                await supabase
                    .from('profiles')
                    .update({ tokens: newTokens, wins1x2: newWins, total_tokens_won: newTotalWon })
                    .eq('id', profile.id);
            }

            nextRollover = 0; // Pot distributed
            winnerMsg += `VINCITORI 1X2: ${standardWinnersUsernames.join(', ')} (+${standardShare}FTK)`;
            if (remainder > 0) winnerMsg += ` (bruciati: ${remainder})`;

        } else {
            console.log("NO STANDARD WINNER, ROLLOVER");
            winnerMsg += "NESSUN VINCITORE 1X2 (Rollover)";
            nextRollover = currentTotalPot;
        }

        // --- SUPER JACKPOT DISTRIBUTION (Score >= 10 AND includeSuperJackpot) ---
        // Verify eligibility: Must have played SuperJackpot bet AND scored >= 10 (regardless of if they were maxScore or not, though usually they would be)
        // Wait, "Verrà assegnato solo a chi gioca il superjackpot e totalizza 10 o più punti."
        // Logic: Find all bets with score >= 10 AND includeSuperJackpot == true.

        const superJackpotWinners = currentBets.filter(bet => {
            if (!bet.includeSuperJackpot) return false;
            let s = 0;
            md.results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
            return s >= 10;
        });

        if (superJackpotWinners.length > 0 && currentSuper > 0) {
            console.log("SUPER JACKPOT WINNER(S) FOUND");
            const sjShare = Math.floor(currentSuper / superJackpotWinners.length);
            const sjWinnersUsernames = superJackpotWinners.map(w => w.username);

            // Update winners with Super Jackpot prize
            for (const w of sjWinnersUsernames) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, tokens, wins1x2, total_tokens_won') // We track SJ wins as 1x2 wins or maybe separate? For now 1x2 wins.
                    .eq('username', w)
                    .single();

                if (!profile) continue;

                const newTokens = (profile.tokens || 0) + sjShare;
                // Note: we might have already updated this user above if they also won Standard Pot. 
                // To avoid race condition/overwriting, we should have probably done one update per user.
                // However, since we await the update above, fetching again here gets the UPDATED values.
                // So it is safe, just slightly inefficient (2 updates for same user).

                const newTotalWon = (profile.total_tokens_won || 0) + sjShare;
                // Optional: Increment wins again? Or is SJ considered a "bonus"? 
                // Let's NOT increment wins1x2 again for the same matchday to avoid double counting "victories".
                // Just Tokens.

                await supabase
                    .from('profiles')
                    .update({ tokens: newTokens, total_tokens_won: newTotalWon })
                    .eq('id', profile.id);
            }
            winnerMsg += ` | 💎 SUPER JACKPOT: ${sjWinnersUsernames.join(', ')} (+${sjShare}FTK)`;
        } else {
            // No Super Jackpot winners. 
            // The Jackpot is NOT rolled over to 'rollover_pot' (which is for 1x2). 
            // It effectively stays in the 'System' (or resets to 0 by default admin_create logic).
            // We just don't pay it out.
        }

        const winnersUsernames = [...new Set([...standardWinnersUsernames, ...superJackpotWinners.map(w => w.username)])];

        // 2.5 UPDATE USER TOTAL POINTS, ACCURACY & LEVEL
        for (const bet of currentBets) {
            let s = 0;
            md.results.forEach((res, idx) => {
                if (res && res === bet.predictions[idx]) s++;
            });

            // Fetch current profile to get current points, wins, and calculate new stats
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', bet.username)
                .single();

            if (profile) {
                const newPoints = (profile.total_points || 0) + s;

                const newAccuracy = (profile.bets_placed || 0) > 0
                    ? Math.round((newPoints / (profile.bets_placed * 12)) * 100)
                    : 0;

                // Level milestones
                const milestones = [
                    { level: 1, req: { bets: 0, wins: 0, tokens: 0 } },
                    { level: 2, req: { bets: 5, wins: 1, tokens: 100 } },
                    { level: 3, req: { bets: 15, wins: 3, tokens: 500 } },
                    { level: 4, req: { bets: 30, wins: 7, tokens: 1500 } },
                    { level: 5, req: { bets: 50, wins: 15, tokens: 5000 } },
                ];

                const currentWins = (profile.wins_1x2 || 0) + (profile.wins_survival || 0) + (s >= 7 ? 1 : 0);
                const currentTokens = profile.total_tokens_won || 0;
                let newLevel = 1;

                for (let i = milestones.length - 1; i >= 0; i--) {
                    const m = milestones[i];
                    if ((profile.bets_placed || 0) >= m.req.bets && currentWins >= m.req.wins && currentTokens >= m.req.tokens) {
                        newLevel = m.level;
                        break;
                    }
                }

                await supabase
                    .from('profiles')
                    .update({
                        total_points: newPoints,
                        prediction_accuracy: newAccuracy,
                        level: newLevel
                    })
                    .eq('id', profile.id);
            }
        }

        // 3. ARCHIVE MATCHDAY: close the day, clear pots, zero jackpot, record winners and set animations (reset happens on next admin_create_matchday)
        await supabase
            .from('matchdays')
            .update({
                status: 'ARCHIVED',
                rollover_pot: nextRollover,
                current_pot: 0,
                super_jackpot: 0,
                winners: winnersUsernames,
                winner_animation: (winnersUsernames.length > 0),
                leaderboard_animation: (winnersUsernames.length > 0),
                matches: [], // Clear matches to keep record lean
                results: []  // Clear results
            })
            .eq('id', md.id);

        // 4. CLEANUP: Delete bets for this matchday now that they are processed
        await supabase
            .from('bets')
            .delete()
            .eq('matchday_id', md.id);

        return {
            success: true,
            message: `Giornata Archiviata. ${winnerMsg}`,
            survivalStats
        };
    },

    resetSystem: async (): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase.rpc('reset_fanny_system');
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Sistema resettato con successo. Tutti i dati di gioco sono stati ripuliti." };
    },

    recalculatePot: async (): Promise<{ success: boolean; message: string; newPot?: number }> => {
        const { data, error } = await supabase.rpc('admin_recalculate_current_pot');
        if (error) return { success: false, message: error.message };
        return data as { success: boolean; message: string; newPot?: number };
    },
};
