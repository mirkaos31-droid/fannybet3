import { supabase } from '../supabaseClient';
import type { SurvivalSeason, SurvivalPlayer, SurvivalPick } from '../types';
import { bettingService } from './bettingService'; // Use the new service

// Database record interfaces
interface DbSurvivalPlayerRecord {
    id: string;
    user_id: string;
    status: 'ALIVE' | 'ELIMINATED' | 'WINNER';
    used_teams: string[];
    eliminated_at_matchday?: number;
    profiles: DbProfileRecord | DbProfileRecord[];
}

interface DbProfileRecord {
    username: string;
    avatar_url?: string;
    tokens: number;
}

export const survivalService = {
    // --- SURVIVAL MODE ---
    getSurvivalState: async (): Promise<{ season: SurvivalSeason | null, players: SurvivalPlayer[] }> => {
        // 1. Get Active/Open Season
        const { data: season } = await supabase
            .from('survival_seasons')
            .select('*')
            .in('status', ['OPEN', 'ACTIVE'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        console.log('[getSurvivalState] Current Active Season:', season);
        if (!season) return { season: null, players: [] };

        // 2. Get Players
        console.log('[getSurvivalState] Fetching players for season:', season.id);
        const { data: players, error: playersError } = await supabase
            .from('survival_players')
            .select('*, profiles(username, avatar_url, tokens)')
            .eq('season_id', season.id);

        if (playersError) {
            console.error('Error fetching survival players:', playersError);
        }
        console.log('Raw players from DB:', players);

        // 3. Get current matchday
        const openMD = await bettingService.getMatchday();

        // 4. Get all picks for current matchday
        let picks: SurvivalPick[] = [];
        if (openMD) {
            const { data: picksData } = await supabase
                .from('survival_picks')
                .select('player_id, team, result')
                .eq('matchday_id', openMD.id);
            picks = (picksData || []) as SurvivalPick[];
        }

        const parsedPlayers: SurvivalPlayer[] = (players || []).map((p: DbSurvivalPlayerRecord) => {
            const currentPick = picks.find(pick => pick.player_id === p.id);
            // Handle profile as object or array (common in Supabase joins)
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;

            return {
                id: p.id,
                userId: p.user_id,
                username: profile?.username || 'Sconosciuto',
                avatarUrl: profile?.avatar_url,
                tokens: profile?.tokens || 0,
                status: p.status || 'ALIVE', // Default to ALIVE if missing
                usedTeams: p.used_teams || [],
                eliminatedAt: p.eliminated_at_matchday,
                currentPick: currentPick?.team
            };
        });

        const { data: { user } } = await supabase.auth.getUser();

        // 5. Get My Pick Context (if logged in)
        let myPickCtx = undefined;

        if (user && openMD) {
            const me = parsedPlayers.find(p => p.userId === user.id || p.username === user.user_metadata?.username);
            console.log('[getSurvivalState] Finding "Me":', me);
            if (me && me.currentPick) {
                const pickData = picks.find(pick => pick.player_id === me.id);
                if (pickData) {
                    myPickCtx = { myPick: pickData.team, myStatus: pickData.result as 'PENDING' | 'WIN' | 'ELIMINATED' };
                }
            }
        }

        return {
            season: {
                id: season.id,
                status: season.status as 'OPEN' | 'ACTIVE' | 'COMPLETED',
                prizePool: season.prize_pool,
                startMatchdayId: season.start_matchday_id,
                currentMatch: myPickCtx
            },
            players: parsedPlayers
        };
    },

    joinSurvival: async (seasonId: number): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('join_survival', { p_season_id: seasonId });
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },

    submitSurvivalPick: async (seasonId: number, team: string): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('submit_survival_pick', { p_season_id: seasonId, p_team: team });
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },

    // --- SURVIVAL ADMIN ---
    processSurvivalRound: async (matchdayId: number): Promise<{ success: boolean; message: string; eliminated?: number; advanced?: number }> => {
        // 1. Get Matchday Results
        const md = await bettingService.getMatchday();
        // Since we might be processing a closed matchday, we should probably fetch by ID if possible, 
        // but current getMatchday only gets OPEN. Let's assume we process BEFORE archiving?
        // Or we need a getMatchdayById. For now, assume it's the current OPEN one.
        if (!md || md.id !== matchdayId) return { success: false, message: "Matchday not found or not active" };

        // 2. Get active season
        const { season, players } = await survivalService.getSurvivalState();
        if (!season) return { success: false, message: "No active season" };

        // 3. Get all picks for this matchday
        const { data: picks } = await supabase
            .from('survival_picks')
            .select('*')
            .eq('matchday_id', matchdayId);

        if (!picks) return { success: false, message: "No picks found" };

        // 4. Calculate eliminations
        const eliminatedIds: (string | number)[] = [];
        let advancedCount = 0;

        for (const player of players) {
            // Skip already eliminated
            if (player.status === 'ELIMINATED') continue;

            const pick = picks.find((p: SurvivalPick) => p.player_id === player.id);
            if (!pick) {
                // No pick = Eliminated (Rule)
                eliminatedIds.push(player.id);
                continue;
            }

            // Find match for the picked team
            const matchIndex = md.matches.findIndex(m => m.home === pick.team || m.away === pick.team);
            if (matchIndex === -1) {
                // Picked team not playing? Should not happen if UI is correct. Eliminate?
                // Or maybe they picked from a different matchday?
                console.warn(`Player ${player.username} picked team ${pick.team} not found in matchday.`);
                continue;
            }

            const result = md.results[matchIndex]; // '1', 'X', '2'
            if (!result) {
                // Match not played yet? Cannot process.
                return { success: false, message: "Not all matches have results" };
            }

            const match = md.matches[matchIndex];
            const isWin = (match.home === pick.team && result === '1') ||
                (match.away === pick.team && result === '2');

            if (!isWin) {
                eliminatedIds.push(player.id);
            } else {
                advancedCount++;
            }
        }

        // 5. Apply eliminations & Update Survivors
        if (eliminatedIds.length > 0) {
            const { error } = await supabase.rpc('eliminate_survival_players', { p_player_ids: eliminatedIds });
            if (error) return { success: false, message: error.message };
        }

        // Update used_teams for survivors
        const { error: updateError } = await supabase.rpc('update_survivors_teams', { p_matchday_id: matchdayId });
        if (updateError) {
            console.error("Failed to update survivor teams", updateError);
            return { success: false, message: "Round processed but failed to update survivor teams" };
        }

        return { success: true, message: "Round processed", eliminated: eliminatedIds.length, advanced: advancedCount };
    },

    closeSurvivalSeason: async (seasonId: number): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('close_survival_season', { p_season_id: seasonId });
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },

    startNewSurvivalSeason: async (): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('start_new_survival_season');
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },
};
