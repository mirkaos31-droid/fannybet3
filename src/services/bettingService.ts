import { supabase } from '../supabaseClient';
import type { Match } from '../types';
import { commonService } from './commonService';

export const bettingService = {
    // --- ADMIN ACTIONS ---
    createMatchday: async (): Promise<{ success: boolean, message: string }> => {
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

    updateAllMatches: async (matches: Match[]): Promise<{ success: boolean; message: string }> => {
        const md = await commonService.getMatchday();
        if (!md) return { success: false, message: 'Nessuna giornata attiva' };

        const { error } = await supabase
            .from('matchdays')
            .update({ matches })
            .eq('id', md.id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Tutte le 10 partite Serie A sono state aggiornate' };
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

    updateDeadline: async (deadline: string) => {
        const md = await commonService.getMatchday();
        if (!md) return;
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

        // Clear results only (no bets to delete anymore)
        await supabase
            .from('matchdays')
            .update({ results: Array(10).fill(null) })
            .eq('id', md.id);
    },

    archiveMatchday: async (matchdayId?: number): Promise<{ success: boolean; message: string; survivalStats?: { eliminated: number; advanced: number } }> => {
        let md = null;
        if (matchdayId) {
            md = await commonService.getMatchdayById(matchdayId);
        } else {
            md = await commonService.getMatchday();
        }
        if (!md) return { success: false, message: 'Nessuna giornata attiva trovata.' };

        let survivalStats = undefined;

        // 1. AUTO-PROCESS SURVIVAL ROUND
        try {
            console.log('Auto-processing Survival Round...');
            const { survivalService } = await import('./survivalService');
            const survivalRes = await survivalService.processSurvivalRound(md.id);
            if (survivalRes.success) {
                console.log('Survival Round Processed:', survivalRes);
                survivalStats = {
                    eliminated: survivalRes.eliminated || 0,
                    advanced: survivalRes.advanced || 0
                };
            }
        } catch (err) {
            console.error('Survival Process Error:', err);
        }

        // 2. ARCHIVE MATCHDAY (simple — no 1x2 prize distribution)
        const { data, error } = await supabase.rpc('admin_archive_matchday_simple', {
            p_matchday_id: md.id
        });

        if (error) {
            return { success: false, message: `Errore durante l'archiviazione: ${error.message}` };
        }

        const res = data as { success: boolean; message: string };

        if (!res.success) {
            return { success: false, message: res.message };
        }

        return {
            success: true,
            message: res.message,
            survivalStats
        };
    },

    resetSystem: async (): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase.rpc('reset_fanny_system');
        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Sistema resettato con successo. Tutti i dati di gioco sono stati ripuliti.' };
    },

    getBurnedTokens: async (): Promise<number> => {
        try {
            const { data, error } = await supabase
                .from('system_stats')
                .select('value')
                .eq('key', 'burned_tokens')
                .maybeSingle();

            if (error || !data) return 0;
            return Number(data.value) || 0;
        } catch {
            return 0;
        }
    }
};
