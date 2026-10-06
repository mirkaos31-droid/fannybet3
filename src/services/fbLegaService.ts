import { supabase } from '../supabaseClient';
import type { FBLeague, FBLeagueParticipant, FBLeaguePick, ScoringRules } from '../types';

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
                profiles:user_id (username, avatar_url)
            `)
            .eq('league_id', leagueId)
            .order('total_points', { ascending: false });

        if (pError) throw pError;

        return {
            league,
            participants: participants.map(p => {
                const prof = p.profiles as unknown as { username?: string; avatar_url?: string };
                return {
                    ...p,
                    username: prof?.username,
                    avatar_url: prof?.avatar_url
                };
            }) as FBLeagueParticipant[]
        };
    },

    async getLeagueLeaderboardLive(leagueId: number): Promise<FBLeagueParticipant[]> {
        const { data, error } = await supabase.rpc('get_fb_league_live_leaderboard', {
            p_league_id: leagueId
        });

        if (error) throw error;

        return data.map((p: { user_id: string; username: string; grand_total: number; total_points: number; live_points: number; active_bonuses: string[] | null }) => ({
            user_id: p.user_id,
            username: p.username,
            total_points: p.grand_total, // Show calculated grand total
            accumulated_points: p.total_points,
            live_points: p.live_points,
            active_bonuses: p.active_bonuses || []
        })) as FBLeagueParticipant[];
    },

    async getHistoricalLeaderboard(leagueId: number, matchdayId: number): Promise<FBLeagueParticipant[]> {
        const { data, error } = await supabase.rpc('get_fb_league_historical_leaderboard', {
            p_league_id: leagueId,
            p_matchday_id: matchdayId
        });

        if (error) throw error;

        return data.map((p: { user_id: string; username: string; points_total: number; points_matchday: number; active_bonuses: string[] | null }) => ({
            user_id: p.user_id,
            username: p.username,
            total_points: p.points_total,
            live_points: p.points_matchday, // Repurposing live_points for daily points
            active_bonuses: p.active_bonuses || []
        })) as FBLeagueParticipant[];
    },

    async getLeagueMatchdays(leagueId: number): Promise<{ matchday_id: number; round_number: number }[]> {
        const { data, error } = await supabase.rpc('get_fb_league_matchdays', {
            p_league_id: leagueId
        });
        if (error) throw error;
        return data;
    },

    async joinLeague(leagueId: number) {
        const { data, error } = await supabase.rpc('join_fb_league', {
            p_league_id: leagueId
        });
        if (error) throw error;
        return data;
    },

    async submitPicks(leagueId: number, matchdayId: number, predictions: string[], secretMatchIndex?: number | null) {
        const { data, error } = await supabase.rpc('submit_fb_league_picks', {
            p_league_id: leagueId,
            p_matchday_id: matchdayId,
            p_predictions: predictions,
            p_secret_match_index: secretMatchIndex ?? null
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

    async payInstallment(leagueId: number): Promise<{ success: boolean; message: string; installments_paid?: number; next_installment?: number }> {
        const { data, error } = await supabase.rpc('pay_fb_league_installment', {
            p_league_id: leagueId
        });
        if (error) throw error;
        return data as { success: boolean; message: string; installments_paid?: number; next_installment?: number };
    },

    async getUserPicks(leagueId: number, matchdayId: number, targetUserId: string): Promise<string[] | null> {
        const { data, error } = await supabase
            .from('fb_league_picks')
            .select('predictions, points_earned')
            .eq('league_id', leagueId)
            .eq('matchday_id', matchdayId)
            .eq('user_id', targetUserId)
            .single();

        if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 0 rows
        return data ? data.predictions : null;
    },

    // Rileva quante giornate di Serie A 2026-27 sono già archiviate
    // Filtra per deadline >= 2026-08-01 per escludere stagioni precedenti
    async getCompletedMatchdaysCount(): Promise<number> {
        const SEASON_START = '2026-08-01T00:00:00Z';
        const { count, error } = await supabase
            .from('matchdays')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'ARCHIVED')
            .gte('deadline', SEASON_START);
        if (error) throw error;
        return count ?? 0;
    },

    // Admin Methods
    async createLeague(config: {
        name: string;
        entry_fee: number;
        duration: number;
        scoring_rules: ScoringRules;
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
    },

    async updateLeaguePrizeDist(leagueId: number, prizeDist: number[]) {
        const { error } = await supabase
            .from('fb_leagues')
            .update({ prize_distribution: prizeDist })
            .eq('id', leagueId);
        if (error) throw error;
        return { success: true, message: 'Distribuzione premi aggiornata!' };
    },

    async awardCard(username: string, cardTitle: string) {
        const { data, error } = await supabase.rpc('award_card_to_user', {
            p_username: username,
            p_card_title: cardTitle
        });
        if (error) throw error;
        return data;
    }
};
