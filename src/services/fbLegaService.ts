import { supabase } from '../supabaseClient';
import type { FBLeague, FBLeagueParticipant, FBLeaguePick } from '../types';

export const fbLegaService = {
    async getLeagues(): Promise<FBLeague[]> {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;

        const { data, error } = await supabase
            .from('fb_leagues')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (!data || data.length === 0) return [];

        // Fetch participant counts and membership in one query
        const leagueIds = data.map(l => l.id);
        const { data: participants } = await supabase
            .from('fb_league_participants')
            .select('league_id, user_id')
            .in('league_id', leagueIds);

        const countMap: Record<number, number> = {};
        const memberSet = new Set<number>();

        (participants || []).forEach(p => {
            countMap[p.league_id] = (countMap[p.league_id] || 0) + 1;
            if (p.user_id === userId) {
                memberSet.add(p.league_id);
            }
        });

        return data.map(l => ({
            ...l,
            participant_count: countMap[l.id] || 0,
            is_member: memberSet.has(l.id)
        }));
    },

    async getLeagueDetails(leagueId: number) {
        const { data: league, error: lError } = await supabase
            .from('fb_leagues')
            .select('*')
            .eq('id', leagueId)
            .single();

        if (lError) throw lError;

        const { data: participants, error: pError } = await supabase
            .from('fb_league_participants')
            .select(`
                *,
                profiles:user_id (username)
            `)
            .eq('league_id', leagueId)
            .order('total_points', { ascending: false });

        if (pError) throw pError;

        return {
            league,
            participants: participants.map(p => ({
                ...p,
                username: (p.profiles as any)?.username
            })) as FBLeagueParticipant[]
        };
    },

    async joinLeague(leagueId: number) {
        const { data, error } = await supabase.rpc('join_fb_league', {
            p_league_id: leagueId
        });
        if (error) throw error;
        return data;
    },

    async submitPicks(leagueId: number, matchdayId: number, predictions: string[]) {
        const { data, error } = await supabase.rpc('submit_fb_league_picks', {
            p_league_id: leagueId,
            p_matchday_id: matchdayId,
            p_predictions: predictions
        });
        if (error) throw error;
        return data;
    },

    async getMyPicks(leagueId: number, userId: string): Promise<FBLeaguePick[]> {
        const { data, error } = await supabase
            .from('fb_league_picks')
            .select('*')
            .eq('league_id', leagueId)
            .eq('user_id', userId);

        if (error) throw error;
        return data || [];
    },

    // Admin Methods
    async createLeague(config: {
        name: string;
        entry_fee: number;
        duration: number;
        scoring_rules: Record<string, number>;
        prize_dist: number[];
    }) {
        const { data, error } = await supabase.rpc('create_fb_league', {
            p_name: config.name,
            p_entry_fee: config.entry_fee,
            p_duration: config.duration,
            p_scoring_rules: config.scoring_rules,
            p_prize_dist: config.prize_dist
        });
        if (error) throw error;
        return data;
    },

    async resolveRound(leagueId: number, matchdayId: number) {
        const { data, error } = await supabase.rpc('resolve_fb_league_round', {
            p_league_id: leagueId,
            p_matchday_id: matchdayId
        });
        if (error) throw error;
        return data;
    },

    async distributePrizes(leagueId: number) {
        const { data, error } = await supabase.rpc('distribute_fb_league_prizes', {
            p_league_id: leagueId
        });
        if (error) throw error;
        return data;
    }
};
