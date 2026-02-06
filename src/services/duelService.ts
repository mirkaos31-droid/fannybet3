import { supabase } from '../supabaseClient';
import type { Duel } from '../types';
import { bettingService } from './bettingService';

interface DbDuelJoinedRecord {
    id: string;
    matchday_id: number;
    challenger_id: string;
    opponent_id: string;
    status: 'PENDING' | 'COMPLETED' | 'ACCEPTED' | 'DECLINED';
    scores?: { challenger_score?: number; opponent_score?: number };
    winner_id?: string;
    created_at: string;
    challenger: { id: string; username: string; avatar_url?: string };
    opponent: { id: string; username: string; avatar_url?: string };
    wager_amount?: number;
}

interface DbUserRecord {
    id: string;
    username: string;
    avatar_url?: string;
}

export const duelService = {
    // --- DUEL ARENA ---
    getChallengeableUsers: async (): Promise<{ id: string; username: string; avatarUrl?: string }[]> => {
        const md = await bettingService.getMatchday();
        if (!md) return [];
        const { data, error } = await supabase.rpc('get_challengeable_users', { p_matchday_id: md.id });
        if (error) {
            console.error('Error fetching opponents:', error);
            return [];
        }
        return (data || []).map((u: DbUserRecord) => ({
            id: u.id,
            username: u.username,
            avatarUrl: u.avatar_url
        }));
    },

    createDuel: async (opponentId: string, wagerAmount: number = 0): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };
        const md = await bettingService.getMatchday();
        if (!md) return { success: false, message: "Nessuna giornata attiva" };

        const { error } = await supabase
            .from('duels')
            .insert({
                matchday_id: md.id,
                challenger_id: user.id,
                opponent_id: opponentId,
                status: 'PENDING',
                wager_amount: wagerAmount
            });

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Sfida inviata!" };
    },

    getMyDuels: async (): Promise<Duel[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Only return duels for the active matchday to avoid showing stale duels
        const md = await bettingService.getMatchday();
        if (!md) return [];

        const { data, error } = await supabase
            .from('duels')
            .select(`
                *,
                challenger:profiles!challenger_id(id, username, avatar_url),
                opponent:profiles!opponent_id(id, username, avatar_url)
            `)
            .eq('matchday_id', md.id)
            .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching duels:', error);
            return [];
        }

        return (data || []).map((d: DbDuelJoinedRecord) => ({
            id: d.id,
            matchdayId: d.matchday_id,
            challenger: {
                id: d.challenger.id,
                username: d.challenger.username,
                avatarUrl: d.challenger.avatar_url
            },
            opponent: {
                id: d.opponent.id,
                username: d.opponent.username,
                avatarUrl: d.opponent.avatar_url
            },
            status: d.status,
            scores: d.scores ? {
                challenger_score: d.scores.challenger_score ?? 0,
                opponent_score: d.scores.opponent_score ?? 0
            } : undefined,
            winnerId: d.winner_id,
            wagerAmount: d.wager_amount || 0,
            createdAt: d.created_at
        }));
    },

    respondToDuel: async (duelId: string, accept: boolean): Promise<{ success: boolean; message: string }> => {
        const status = accept ? 'ACCEPTED' : 'DECLINED';
        const { error } = await supabase
            .from('duels')
            .update({ status })
            .eq('id', duelId);

        if (error) return { success: false, message: error.message };
        return { success: true, message: accept ? "Sfida Accettata!" : "Sfida Rifiutata" };
    },

    getAllDuels: async (): Promise<Duel[]> => {
        const md = await bettingService.getMatchday();
        if (!md) return [];

        const { data, error } = await supabase
            .from('duels')
            .select(`
                *,
                challenger:profiles!challenger_id(id, username, avatar_url),
                opponent:profiles!opponent_id(id, username, avatar_url)
            `)
            .eq('matchday_id', md.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching all duels:', error);
            return [];
        }

        return (data || []).map((d: DbDuelJoinedRecord) => ({
            id: d.id,
            matchdayId: d.matchday_id,
            challenger: {
                id: d.challenger.id,
                username: d.challenger.username,
                avatarUrl: d.challenger.avatar_url
            },
            opponent: {
                id: d.opponent.id,
                username: d.opponent.username,
                avatarUrl: d.opponent.avatar_url
            },
            status: d.status,
            scores: d.scores ? {
                challenger_score: d.scores.challenger_score ?? 0,
                opponent_score: d.scores.opponent_score ?? 0
            } : undefined,
            winnerId: d.winner_id,
            wagerAmount: d.wager_amount || 0,
            createdAt: d.created_at
        }));
    },

    updateDuelScores: async (duelId: string, scores: { challenger_score: number; opponent_score: number }): Promise<{ success: boolean; message?: string }> => {
        const { error } = await supabase
            .from('duels')
            .update({ scores })
            .eq('id', duelId);

        if (error) {
            console.error('Error updating duel scores:', error);
            return { success: false, message: error.message };
        }
        return { success: true };
    }
};
