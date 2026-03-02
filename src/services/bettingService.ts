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
        // 1. Cleanup old bets before creating new matchday (to keep DB lean and reset rankings)
        await supabase.from('bets').delete().neq('id', 0); // Delete all existing bets

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

        const results = (md.results || []) as (string | null)[];
        let maxScore = 0;
        currentBets.forEach(bet => {
            let s = 0;
            results.forEach((res, idx) => {
                if (res && res === bet.predictions[idx]) s++;
            });
            if (s > maxScore) maxScore = s;
        });

        const currentTotalPot = (md as any).current_pot || 0;
        const currentSuper = (md as any).super_jackpot || 0;
        let nextRollover = 0;
        let winnerMsg = "";
        let standardWinnersUsernames: string[] = [];

        // --- PRIZE AGGREGATION & DISTRIBUTION ---
        const userEarnings = new Map<string, { tokens: number; wins: number }>();

        // Process Standard Winners
        if (maxScore >= 7 && currentTotalPot > 0) {
            console.log("STANDARD POT WINNER(S) FOUND");
            const winners = currentBets.filter(bet => {
                let s = 0;
                results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
                return s === maxScore;
            });

            if (winners.length > 0) {
                const totalPayout = Math.floor(currentTotalPot);
                const share = Math.floor(totalPayout / winners.length);
                const remainder = totalPayout % winners.length;

                winners.forEach(w => {
                    const current = userEarnings.get(w.username) || { tokens: 0, wins: 0 };
                    userEarnings.set(w.username, { tokens: current.tokens + share, wins: current.wins + 1 });
                });

                standardWinnersUsernames = winners.map(w => w.username);
                winnerMsg += `VINCITORI 1X2: ${standardWinnersUsernames.join(', ')} (+${share}FTK)`;
                if (remainder > 0) winnerMsg += ` (bruciati: ${remainder})`;
                nextRollover = 0;
            } else {
                nextRollover = currentTotalPot;
            }
        } else {
            console.log("NO STANDARD WINNER, ROLLOVER");
            winnerMsg += "NESSUN VINCITORE 1X2 (Rollover)";
            nextRollover = currentTotalPot;
        }

        // Process Super Jackpot
        const sjWinners = currentBets.filter(bet => {
            if (!bet.includeSuperJackpot) return false;
            let s = 0;
            results.forEach((res, idx) => { if (res && res === bet.predictions[idx]) s++; });
            return s >= 10;
        });

        if (sjWinners.length > 0 && currentSuper > 0) {
            console.log("SUPER JACKPOT WINNER(S) FOUND");
            const share = Math.floor(currentSuper / sjWinners.length);
            sjWinners.forEach(w => {
                const current = userEarnings.get(w.username) || { tokens: 0, wins: 0 };
                userEarnings.set(w.username, { tokens: current.tokens + share, wins: current.wins }); // SJ doesn't count as extra "win" for level?
            });
            const sjNames = sjWinners.map(w => w.username);
            winnerMsg += ` | 💎 SUPER JACKPOT: ${sjNames.join(', ')} (+${share}FTK)`;
        }

        const winnersUsernames = Array.from(userEarnings.keys());

        // EXECUTE PROFILE UPDATES (One per winner)
        for (const [username, earnings] of userEarnings.entries()) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('username', username)
                .single();

            if (profile) {
                const newTokens = (profile.tokens || 0) + earnings.tokens;
                const newWins = (profile.wins1x2 || 0) + earnings.wins;
                const newTotalWon = (profile.total_tokens_won || 0) + earnings.tokens;

                await supabase
                    .from('profiles')
                    .update({
                        tokens: newTokens,
                        wins1x2: newWins,
                        total_tokens_won: newTotalWon
                    })
                    .eq('id', profile.id);
            }
        }

        // 2.2 🏆 AWARD 1X2 WINNER CARD
        if (winnersUsernames.length > 0) {
            const { data: cardData } = await supabase
                .from('collectible_cards')
                .select('id')
                .eq('title', '1x2 Winner')
                .single();

            if (cardData) {
                for (const username of winnersUsernames) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('username', username)
                        .single();

                    if (profile) {
                        await supabase
                            .from('user_cards')
                            .upsert(
                                { user_id: profile.id, card_id: cardData.id },
                                { onConflict: 'user_id,card_id' }
                            );
                    }
                }
            }
        }

        // 2.3 🏆 AWARD SUPERJ CARD
        const sjNames = sjWinners.map(w => w.username);
        if (sjNames.length > 0) {
            const { data: superJCard } = await supabase
                .from('collectible_cards')
                .select('id')
                .eq('title', 'SuperJ')
                .single();

            if (superJCard) {
                for (const username of sjNames) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('username', username)
                        .single();

                    if (profile) {
                        await supabase
                            .from('user_cards')
                            .upsert(
                                { user_id: profile.id, card_id: superJCard.id },
                                { onConflict: 'user_id,card_id' }
                            );
                    }
                }
            }
        }

        // 2.5 UPDATE USER TOTAL POINTS, ACCURACY & LEVEL
        for (const bet of currentBets) {
            let s = 0;
            results.forEach((res, idx) => {
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
                leaderboard_animation: (winnersUsernames.length > 0)
                // matches and results kept for leaderboard persistence
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

    recalculatePot: async (): Promise<{ success: boolean; message: string; newPot?: number }> => {
        const { data, error } = await supabase.rpc('admin_recalculate_current_pot');
        if (error) return { success: false, message: error.message };
        return data as { success: boolean; message: string; newPot?: number };
    },

    getBurnedTokens: async (): Promise<number> => {
        const { data, error } = await supabase
            .from('system_stats')
            .select('value')
            .eq('key', 'burned_tokens')
            .single();

        if (error || !data) return 0;
        return Number(data.value);
    }
};
