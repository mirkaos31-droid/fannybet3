import { supabase } from '../supabaseClient';
import type { Match, Bet } from '../types';
import { commonService } from './commonService';

export const bettingService = {
    // --- DATA ACCESS ---

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

    getAllBets: async (matchdayId?: number): Promise<Bet[]> => {
        let query = supabase
            .from('bets')
            .select(`
                *,
                profiles (username, avatar_url, level)
            `);

        if (matchdayId) {
            query = query.eq('matchday_id', matchdayId);
        }
        
        const { data } = await query;

        if (!data) return [];

        return data.map(b => ({
            id: b.id,
            userId: b.user_id,
            username: b.profiles?.username || 'Sconosciuto',
            avatarUrl: b.profiles?.avatar_url,
            matchdayId: b.matchday_id,
            predictions: b.predictions || Array(12).fill('?'),
            includeSuperJackpot: b.include_super_jackpot,
            timestamp: b.created_at || new Date().toISOString(),
            amount: b.amount,
            level: b.profiles?.level || 1
        }));
    },

    getUserBets: async (username: string): Promise<Bet[]> => {
        const md = await commonService.getMatchday();
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
            predictions: bet.predictions || Array(12).fill('?'),
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
        // 1. Cleanup removed - we keep historical bets for the archive/leaderboard

        const { data, error } = await supabase.rpc('admin_create_matchday');
        if (error) return { success: false, message: error.message };
        const result = data as { success: boolean, message: string };
        return result;
    },

    updateMatch: async (idx: number, newMatch: Match) => {
        const md = await commonService.getMatchday();
        if (!md) return;

        const updatedMatches = [...md.matches];
        updatedMatches[idx] = newMatch;

        await supabase
            .from('matchdays')
            .update({ matches: updatedMatches })
            .eq('id', md.id);
    },

    updateMatchResult: async (idx: number, result: string | null) => {
        const md = await commonService.getMatchday();
        if (!md) return;

        const updatedResults = [...md.results];
        updatedResults[idx] = result;

        await supabase
            .from('matchdays')
            .update({ results: updatedResults })
            .eq('id', md.id);
    },

    updateSuperJackpot: async (amount: number) => {
        const md = await commonService.getMatchday();
        if (!md) return;

        await supabase.from('matchdays').update({ super_jackpot: amount }).eq('id', md.id);
    },

    // Verify and fix pot synchronization
    verifyAndFixPot: async () => {
        const md = await commonService.getMatchday();
        if (!md) return { success: false, message: 'No open matchday found' };

        const { data: bets } = await supabase
            .from('bets')
            .select('amount')
            .eq('matchday_id', md.id);

        const actualPot = bets ? bets.reduce((sum, bet) => sum + (bet.amount || 0), 0) : 0;

        if (md.currentPot !== actualPot) {
            await supabase
                .from('matchdays')
                .update({ current_pot: actualPot })
                .eq('id', md.id);

            return {
                success: true,
                message: `Pot corrected: ${md.currentPot} → ${actualPot}`,
                wasFixed: true
            };
        }

        return { success: true, message: 'Pot is synchronized', wasFixed: false };
    },

    updateDeadline: async (deadline: string) => {
        const md = await commonService.getMatchday();
        if (!md) return;

        // Set the deadline; bets remain allowed until that timestamp (server-time comparison)
        await supabase.from('matchdays').update({ deadline }).eq('id', md.id);
    },

    setBetLock: async (lock: boolean) => {
        const md = await commonService.getMatchday();
        if (!md) return { success: false, message: 'No active matchday' };

        const { error } = await supabase.from('matchdays').update({ bets_locked: lock }).eq('id', md.id);
        if (error) return { success: false, message: error.message };
        return { success: true };
    },

    resetMatchday: async () => {
        const md = await commonService.getMatchday();
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


    archiveMatchday: async (matchdayId?: number): Promise<{ success: boolean; message: string; survivalStats?: { eliminated: number; advanced: number } }> => {
        let md = null;
        if (matchdayId) {
            md = await commonService.getMatchdayById(matchdayId);
        } else {
            md = await commonService.getMatchday();
        }

        if (!md) return { success: false, message: "Nessuna giornata attiva trovata." };

        let survivalStats = undefined;

        // 1. AUTO-PROCESS SURVIVAL ROUND (Keep separate for now as it uses complex JS logic)
        try {
            console.log("Auto-processing Survival Round...");
            const { survivalService } = await import('./survivalService');
            const survivalRes = await survivalService.processSurvivalRound(md.id);
            if (survivalRes.success) {
                console.log("Survival Round Processed:", survivalRes);
                survivalStats = {
                    eliminated: survivalRes.eliminated || 0,
                    advanced: survivalRes.advanced || 0
                };
            }
        } catch (err) {
            console.error("Survival Process Error:", err);
        }

        // 2. ATOMIC 1X2 ARCHIVING & PRIZE DISTRIBUTION
        // This RPC handles winner calculation, profile updates, card awards, and matchday closure.
        const { data, error } = await supabase.rpc('admin_archive_1x2_matchday', {
            p_matchday_id: md.id
        });

        if (error) {
            return { success: false, message: `Errore durante l'archiviazione: ${error.message}` };
        }

        const res = data as { success: boolean; message: string; winners: string[]; next_rollover: number };

        if (!res.success) {
            return { success: false, message: res.message };
        }

        return {
            success: true,
            message: `Giornata Archiviata. ${res.message} (Vincitori: ${res.winners?.join(', ') || 'Nessuno'})`,
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
