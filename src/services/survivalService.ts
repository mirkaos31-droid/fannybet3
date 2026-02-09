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
    // --- SURVIVAL ADMIN ---
    processSurvivalRound: async (matchdayId: number): Promise<{ success: boolean; message: string; eliminated?: number; advanced?: number }> => {
        // 1. Get Matchday Results
        const md = await bettingService.getMatchday();
        if (!md || md.id !== matchdayId) return { success: false, message: "Matchday not found or not active" };

        // 2. Get active season
        // Need to fetch entry_fee too, so let's verify getSurvivalState returns it or fetch it 
        // Actually getSurvivalState returns the season object, we might need to cast or add entry_fee to type
        const { season, players } = await survivalService.getSurvivalState();
        if (!season) return { success: false, message: "No active season" };

        // Fetch strict season data to get entry_fee (as it might not be in the public type yet)
        const { data: seasonData } = await supabase.from('survival_seasons').select('entry_fee, prize_pool').eq('id', season.id).single();
        const entryFee = seasonData?.entry_fee || 2; // Default 2 if not found
        const currentPool = seasonData?.prize_pool || 0;

        // 3. Get all picks for this matchday
        const { data: picks } = await supabase
            .from('survival_picks')
            .select('*')
            .eq('matchday_id', matchdayId);

        if (!picks) return { success: false, message: "No picks found" };

        // [AUTO-START] If season is OPEN, switch to ACTIVE now that we are processing the first round
        if (season.status === 'OPEN') {
            await supabase.from('survival_seasons').update({ status: 'ACTIVE' }).eq('id', season.id);
            console.log(`Season ${season.id} status updated to ACTIVE (Locked)`);
        }

        // 4. Calculate eliminations
        const eliminatedIds: (string | number)[] = [];
        let advancedCount = 0;
        let survivors: SurvivalPlayer[] = [];

        for (const player of players) {
            // Already eliminated?
            if (player.status === 'ELIMINATED' || player.status === 'WINNER') continue;

            // Assume ALIVE
            const pick = picks.find((p: SurvivalPick) => p.player_id === player.id);
            let isEliminated = false;

            if (!pick) {
                isEliminated = true; // No pick = Eliminated
            } else {
                const matchIndex = md.matches.findIndex(m => m.home === pick.team || m.away === pick.team);
                if (matchIndex === -1) {
                    // console.warn(`Player ${player.username} picked team ${pick.team} not found.`);
                    // Strict rule: Invalid team = Elimination? Or survive? Let's say survive if system error, but unlikely.
                    // For now, eliminating invalid picks is safer to prevent exploits.
                    isEliminated = true;
                } else {
                    const result = md.results[matchIndex];
                    if (!result) return { success: false, message: "Not all matches have results" };

                    const match = md.matches[matchIndex];
                    const isWin = (match.home === pick.team && result === '1') || (match.away === pick.team && result === '2');

                    if (!isWin) isEliminated = true;
                }
            }

            if (isEliminated) {
                eliminatedIds.push(player.id);
            } else {
                advancedCount++;
                survivors.push(player);
            }
        }

        // 5. Apply eliminations
        if (eliminatedIds.length > 0) {
            const { error } = await supabase.rpc('eliminate_survival_players', { p_player_ids: eliminatedIds });
            if (error) return { success: false, message: error.message };
        }

        // Update used_teams for survivors
        await supabase.rpc('update_survivors_teams', { p_matchday_id: matchdayId });

        // 6. CHECK FOR WINNER (Automatic)
        // If exactly ONE player remains ALIVE
        if (advancedCount === 1 && survivors.length === 1) {
            const winner = survivors[0];
            const prize = Math.max(0, currentPool - entryFee); // Prize = Total - Entry

            console.log(`🏆 SURVIVAL WINNER FOUND: ${winner.username}. Prize: ${prize}`);

            // A. Mark Season Completed
            await supabase.from('survival_seasons').update({ status: 'COMPLETED' }).eq('id', season.id);

            // B. Mark Player as Winner
            await supabase.from('survival_players').update({ status: 'WINNER' }).eq('id', winner.id);

            // C. Award Prize to Profile
            // We need the profile ID. winner.userId should be it (auth id).
            // Actually survivalService maps userId to p.user_id.

            // Let's get the profile first to be sure
            const { data: profile } = await supabase.from('profiles').select('id, tokens, wins_survival, total_tokens_won').eq('id', winner.userId).single();

            if (profile) {
                await supabase.from('profiles').update({
                    tokens: (profile.tokens || 0) + prize,
                    wins_survival: (profile.wins_survival || 0) + 1,
                    total_tokens_won: (profile.total_tokens_won || 0) + prize
                }).eq('id', profile.id);
            }

            return {
                success: true,
                message: `Round completato. 👑 VINCITORE: ${winner.username} (+${prize} token)! Campionato concluso.`,
                eliminated: eliminatedIds.length,
                advanced: advancedCount
            };
        }

        return { success: true, message: `Round processato. Eliminati: ${eliminatedIds.length}, Avanzano: ${advancedCount}`, eliminated: eliminatedIds.length, advanced: advancedCount };
    },

    closeSurvivalSeason: async (seasonId: number): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.rpc('close_survival_season', { p_season_id: seasonId });
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },

    startNewSurvivalSeason: async (entryFee: number = 2): Promise<{ success: boolean; message: string }> => {
        // Now accepts entryFee, defaults to 2 if not passed (though RPC defaults too)
        const { data, error } = await supabase.rpc('start_new_survival_season', { p_entry_fee: entryFee });
        if (error) return { success: false, message: error.message };
        return data as { success: boolean, message: string };
    },
};
