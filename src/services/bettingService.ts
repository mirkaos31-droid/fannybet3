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
            leaderboardAnimation: data.leaderboard_animation || false
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
            leaderboardAnimation: d.leaderboard_animation || false
        }));
    },

    getGlobalRanking: async (): Promise<{ username: string; totalPoints: number; avatarUrl?: string }[]> => {
        const { data } = await supabase
            .from('profiles')
            .select('username, total_points, avatar_url')
            .order('total_points', { ascending: false })
            .limit(100);

        if (!data) return [];

        return data.map(d => ({
            username: d.username,
            totalPoints: d.total_points || 0,
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

    getUserBet: async (username: string): Promise<Bet | undefined> => {
        // Need to get user_id from username first? Or assuming caller passes valid context.
        // Actually best to filter by the current open matchday.
        // First get open matchday id
        const md = await bettingService.getMatchday();
        if (!md) return undefined;

        // Find profile id by username
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('username', username)
            .single();

        if (!profile) return undefined;

        const { data: bet } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', profile.id)
            .eq('matchday_id', md.id)
            .maybeSingle();

        if (!bet) return undefined;

        return {
            id: bet.id,
            username: username,
            matchdayId: bet.matchday_id,
            predictions: bet.predictions,
            includeSuperJackpot: bet.include_super_jackpot,
            timestamp: bet.created_at || new Date().toISOString()
        };
    },

    // --- ACTIONS ---
    placeBet: async (predictions: string[], includeSuperJackpot: boolean): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Not logged in" };

        const md = await bettingService.getMatchday();
        if (!md) return { success: false, message: "No active matchday" };

        // Disallow bets if matchday has a deadline in the past or equal to now
        if (md.deadline) {
            const deadlineTime = new Date(md.deadline).getTime();
            if (isNaN(deadlineTime) || Date.now() >= deadlineTime) {
                return { success: false, message: "Scommesse chiuse per la giornata (deadline raggiunta)." };
            }
        }

        const cost = includeSuperJackpot ? 2 : 1;

        // Check tokens
        const { data: profile } = await supabase
            .from('profiles')
            .select('tokens')
            .eq('id', user.id)
            .single();

        if (!profile || profile.tokens < cost) return { success: false, message: "Insufficient tokens" };

        // Deduct Tokens
        const { error: tokenError } = await supabase
            .from('profiles')
            .update({ tokens: profile.tokens - cost })
            .eq('id', user.id);

        if (tokenError) return { success: false, message: "Token deduction failed" };

        // Update Pot (Increment current_pot by 1 - base game fee)
        await supabase
            .from('matchdays')
            .update({ current_pot: md.currentPot + 1 })
            .eq('id', md.id);

        // Insert Bet
        const { error: betError } = await supabase
            .from('bets')
            .insert({
                user_id: user.id,
                matchday_id: md.id,
                predictions: predictions,
                include_super_jackpot: includeSuperJackpot
            });

        if (betError) {
            return { success: false, message: betError.message };
        }

        // Increment bets_placed in profile
        const { data: currentProf } = await supabase
            .from('profiles')
            .select('bets_placed')
            .eq('id', user.id)
            .single();

        await supabase
            .from('profiles')
            .update({ bets_placed: (currentProf?.bets_placed || 0) + 1 })
            .eq('id', user.id);

        return { success: true, message: includeSuperJackpot ? "Schedina + SuperJackpot Giocata!" : "Schedina Base Giocata!" };
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

    // --- ADMIN DIAGNOSTICS ---
    // Returns a summary of duel counts grouped by matchday_id
    adminGetDuelsSummary: async (): Promise<{ matchdayId: number; count: number }[]> => {
        const { data, error } = await supabase
            .from('duels')
            .select('matchday_id');

        if (error || !data) {
            console.error('Error fetching duels for admin summary:', error);
            return [];
        }

        const counts: Record<number, number> = {};
        (data || []).forEach((d: any) => {
            const id = d.matchday_id || 0;
            counts[id] = (counts[id] || 0) + 1;
        });

        return Object.entries(counts).map(([matchdayId, count]) => ({ matchdayId: parseInt(matchdayId, 10), count }));
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

        // 1.5 PROCESS DUELS
        try {
            console.log("Resolving Duels...");
            const { error: duelError } = await supabase.rpc('resolve_matchday_duels', { p_matchday_id: md.id });
            if (duelError) console.error("Duel Resolution Error:", duelError);
            else console.log("Duels resolved successfully.");
        } catch (err) {
            console.error("Duel Resolution Exception:", err);
        }

        // 2. CALCULATE 1X2 WINNERS (Client-side implementation of logic)
        const bets = await bettingService.getAllBets();
        const currentBets = bets.filter(b => b.matchdayId === md.id);

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
        let winnersUsernames: string[] = [];

        if (maxScore >= 7) {
            console.log("WINNER(S) FOUND");

            // Identify winners (exactly those with maxScore)
            const winners = currentBets.filter(bet => {
                let s = 0;
                md.results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
                return s === maxScore;
            });

            const winnersCount = winners.length;

            // Distribute pot + superJackpot equally among winners; burn remainder if odd
            const totalPayout = Math.floor(currentTotalPot + currentSuper);
            const share = winnersCount > 0 ? Math.floor(totalPayout / winnersCount) : 0;
            const remainder = winnersCount > 0 ? (totalPayout % winnersCount) : totalPayout;

            winnersUsernames = winners.map(w => w.username);

            // Update each winner profile: tokens, wins1x2, totalTokensWon
            for (const w of winnersUsernames) {
                // Fetch current totals
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('id, tokens, wins1x2, total_tokens_won')
                    .eq('username', w)
                    .single();

                if (!profile) continue;

                const newTokens = (profile.tokens || 0) + share;
                const newWins = (profile.wins1x2 || 0) + 1;
                const newTotalWon = (profile.total_tokens_won || 0) + share;

                await supabase
                    .from('profiles')
                    .update({ tokens: newTokens, wins1x2: newWins, total_tokens_won: newTotalWon })
                    .eq('id', profile.id);
            }

            nextRollover = 0; // Pot distributed
            winnerMsg = `VINCITORI: ${winnersUsernames.join(', ')} — ${share} token${winnersCount > 1 ? " ciascuno" : ""} (bruciati: ${remainder})`;

        } else {
            console.log("NO WINNER, ROLLOVER");
            winnerMsg = "NESSUN VINCITORE (Rollover)";
            nextRollover = currentTotalPot;
        }

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

                // Recalculate Accuracy
                // We need total correct of all archived bets. 
                // This is slightly expensive to do every archive if we fetch all history, 
                // but for now let's just use the current stats and update incrementally if possible.
                // Or better: fetch all bets for this user to ensure perfection.
                const { data: userBets } = await supabase.from('bets').select('predictions, matchday_id').eq('user_id', profile.id);
                const archivedMDs = await bettingService.getArchivedMatchdays(); // Cached in memory or just fetch
                const archivedIds = new Set(archivedMDs.map(a => a.id));
                // Add the current one to the set since it's about to be archived
                archivedIds.add(md.id);

                let totalCorrect = 0;
                let archivedCount = 0;
                userBets?.forEach(ub => {
                    if (archivedIds.has(ub.matchday_id)) {
                        archivedCount++;
                        // If it's the current md, use md.results
                        const results = ub.matchday_id === md.id ? md.results : archivedMDs.find(a => a.id === ub.matchday_id)?.results;
                        if (results) {
                            results.forEach((r, i) => { if (r && r === ub.predictions[i]) totalCorrect++; });
                        }
                    }
                });

                const newAccuracy = archivedCount > 0 ? Math.round((totalCorrect / (archivedCount * 12)) * 100) : 0;

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
                leaderboard_animation: (winnersUsernames.length > 0)
            })
            .eq('id', md.id);

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
};
