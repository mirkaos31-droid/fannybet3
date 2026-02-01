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
            betsLocked: data.bets_locked || false
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
            betsLocked: d.bets_locked || false
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

        const currentTotalPot = md.currentPot;
        let nextRollover = 0;
        let winnerMsg = "";

        if (maxScore >= 7) {
            console.log("WINNER FOUND");
            winnerMsg = "VINCITORI TROVATI!";
            nextRollover = 0;
            // TODO: Distribute tokens to winners?
        } else {
            console.log("NO WINNER, ROLLOVER");
            winnerMsg = "NESSUN VINCITORE (Rollover)";
            nextRollover = currentTotalPot;
        }

        // 2.5 UPDATE USER TOTAL POINTS
        for (const bet of currentBets) {
            let s = 0;
            md.results.forEach((res, idx) => {
                if (res && res === bet.predictions[idx]) s++;
            });

            if (s > 0) {
                // Fetch current user total_points
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('total_points')
                    .eq('username', bet.username)
                    .single();

                const currentPoints = profile?.total_points || 0;

                await supabase
                    .from('profiles')
                    .update({ total_points: currentPoints + s })
                    .eq('username', bet.username);
            }
        }

        // 3. ARCHIVE MATCHDAY
        await supabase
            .from('matchdays')
            .update({
                status: 'ARCHIVED',
                rollover_pot: nextRollover
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
