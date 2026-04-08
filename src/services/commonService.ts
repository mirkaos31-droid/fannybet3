import { supabase } from '../supabaseClient';
import type { Matchday, Match } from '../types';

export const commonService = {
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
            matches: (data.matches || []) as Match[],
            results: (data.results || Array(12).fill(null)) as (string | null)[],
            superJackpot: data.super_jackpot || 0,
            currentPot: data.current_pot || 0,
            rolloverPot: data.rollover_pot || 0,
            status: data.status as 'OPEN' | 'CLOSED' | 'ARCHIVED',
            deadline: data.deadline,
            betsLocked: data.bets_locked || false,
            winners: data.winners || [],
            winnerAnimation: data.winner_animation || false,
            leaderboardAnimation: data.leaderboard_animation || false,
            jollyMatchIndex: data.jolly_match_index
        };
    },

    getMatchdayById: async (id: number): Promise<Matchday | null> => {
        const { data, error } = await supabase
            .from('matchdays')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) return null;

        return {
            id: data.id,
            matches: (data.matches || []) as Match[],
            results: (data.results || Array(12).fill(null)) as (string | null)[],
            superJackpot: data.super_jackpot || 0,
            currentPot: data.current_pot || 0,
            rolloverPot: data.rollover_pot || 0,
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
            matches: (d.matches || []) as Match[],
            results: (d.results || Array(12).fill(null)) as (string | null)[],
            superJackpot: d.super_jackpot || 0,
            currentPot: d.current_pot || 0,
            rolloverPot: d.rollover_pot || 0,
            status: d.status as 'ARCHIVED',
            deadline: d.deadline,
            betsLocked: d.bets_locked || false,
            winners: d.winners || [],
            winnerAnimation: d.winner_animation || false,
            leaderboardAnimation: d.leaderboard_animation || false,
            jollyMatchIndex: d.jolly_match_index
        }));
    },
};
