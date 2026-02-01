import { supabase } from '../supabaseClient';
import type { User, Matchday, Bet, Match, SurvivalSeason, SurvivalPlayer, SurvivalPick, Duel } from '../types';

export const gameService = {
    // --- AUTH ---
    login: async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: "No user data" };

        // Fetch profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (!profile) return { user: null, error: "Profile not found" };

        return {
            user: {
                id: profile.id,
                username: profile.username,
                role: profile.role as 'ADMIN' | 'USER',
                tokens: profile.tokens,
                email: data.user.email,
                createdAt: profile.created_at,
                avatarUrl: profile.avatar_url,
                wins1x2: profile.wins_1x2,
                winsSurvival: profile.wins_survival,
                level: profile.level,
                predictionAccuracy: profile.prediction_accuracy,
                betsPlaced: profile.bets_placed,
                totalTokensWon: profile.total_tokens_won,
                totalPoints: profile.total_points
            },
            error: null
        };
    },

    signUp: async (username: string, email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { username } // Passed to handle_new_user trigger
            }
        });

        if (error) return { user: null, error: error.message };
        if (!data.user) return { user: null, error: "Signup failed" };

        // Profile is auto-created by trigger, but might take a ms. 
        // We return basic info immediately.
        return {
            user: {
                id: data.user.id,
                username,
                role: 'USER',
                tokens: 100,
                email: data.user.email,
                wins1x2: 0,
                winsSurvival: 0,
                level: 1,
                predictionAccuracy: 0,
                betsPlaced: 0,
                totalTokensWon: 0,
                totalPoints: 0
            },
            error: null
        };
    },

    logout: async () => {
        await supabase.auth.signOut();
    },

    getCurrentUser: async (): Promise<User | null> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (!profile) return null;

        return {
            id: profile.id,
            username: profile.username,
            role: profile.role as 'ADMIN' | 'USER',
            tokens: profile.tokens,
            email: user.email,
            createdAt: profile.created_at,
            avatarUrl: profile.avatar_url,
            wins1x2: profile.wins_1x2,
            winsSurvival: profile.wins_survival,
            level: profile.level,
            predictionAccuracy: profile.prediction_accuracy,
            betsPlaced: profile.bets_placed,
            totalTokensWon: profile.total_tokens_won,
            totalPoints: profile.total_points
        };
    },

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
            deadline: data.deadline
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
            deadline: d.deadline
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
                timestamp: b.timestamp
            };
        });
    },

    getUserBet: async (username: string): Promise<Bet | undefined> => {
        // Need to get user_id from username first? Or assuming caller passes valid context.
        // Actually best to filter by the current open matchday.
        // First get open matchday id
        const md = await gameService.getMatchday();
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
            .single();

        if (!bet) return undefined;

        return {
            id: bet.id,
            username: username,
            matchdayId: bet.matchday_id,
            predictions: bet.predictions,
            includeSuperJackpot: bet.include_super_jackpot,
            timestamp: bet.timestamp
        };
    },

    // --- ACTIONS ---
    placeBet: async (predictions: string[], includeSuperJackpot: boolean): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Not logged in" };

        const md = await gameService.getMatchday();
        if (!md) return { success: false, message: "No active matchday" };

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
        const md = await gameService.getMatchday();
        if (!md) return;

        const updatedMatches = [...md.matches];
        updatedMatches[idx] = newMatch;

        await supabase
            .from('matchdays')
            .update({ matches: updatedMatches })
            .eq('id', md.id);
    },

    updateMatchResult: async (idx: number, result: string | null) => {
        const md = await gameService.getMatchday();
        if (!md) return;

        const updatedResults = [...md.results];
        updatedResults[idx] = result;

        await supabase
            .from('matchdays')
            .update({ results: updatedResults })
            .eq('id', md.id);
    },

    updateSuperJackpot: async (amount: number) => {
        const md = await gameService.getMatchday();
        if (!md) return;

        await supabase.from('matchdays').update({ super_jackpot: amount }).eq('id', md.id);
    },

    updateDeadline: async (deadline: string) => {
        const md = await gameService.getMatchday();
        if (!md) return;

        await supabase.from('matchdays').update({ deadline }).eq('id', md.id);
    },

    resetMatchday: async () => {
        const md = await gameService.getMatchday();
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
        const md = await gameService.getMatchday();
        if (!md) return { success: false, message: "Nessuna giornata attiva" };

        let survivalStats = undefined;

        // 1. AUTO-PROCESS SURVIVAL ROUND
        try {
            console.log("Auto-processing Survival Round...");
            const survivalRes = await gameService.processSurvivalRound(md.id);
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
        const bets = await gameService.getAllBets();
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
        const openMD = await gameService.getMatchday();

        // 4. Get all picks for current matchday
        let picks: SurvivalPick[] = [];
        if (openMD) {
            const { data: picksData } = await supabase
                .from('survival_picks')
                .select('player_id, team, result')
                .eq('matchday_id', openMD.id);
            picks = (picksData || []) as SurvivalPick[];
        }

        const parsedPlayers: SurvivalPlayer[] = (players || []).map((p: any) => {
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
        console.log('[getSurvivalState] Logging current user details:', {
            auth_id: user?.id,
            meta_username: user?.user_metadata?.username
        });

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
        const md = await gameService.getMatchday();
        // Since we might be processing a closed matchday, we should probably fetch by ID if possible, 
        // but current getMatchday only gets OPEN. Let's assume we process BEFORE archiving?
        // Or we need a getMatchdayById. For now, assume it's the current OPEN one.
        if (!md || md.id !== matchdayId) return { success: false, message: "Matchday not found or not active" };

        // 2. Get active season
        const { season, players } = await gameService.getSurvivalState();
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

    resetSystem: async (): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase.rpc('reset_fanny_system');
        if (error) return { success: false, message: error.message };
        return { success: true, message: "Sistema resettato con successo. Tutti i dati di gioco sono stati ripuliti." };
    },

    // --- USER MANAGEMENT (ADMIN ONLY) ---
    getAllUsers: async (): Promise<{ id: string; username: string; email: string; tokens: number; role: string; created_at: string }[]> => {
        const { data, error } = await supabase
            .from('profiles')
            .select('id, username, email, tokens, role, created_at')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return (data || []) as { id: string; username: string; email: string; tokens: number; role: string; created_at: string }[];
    },

    updateUserTokens: async (userId: string, tokenAmount: number): Promise<boolean> => {
        const { data: current } = await supabase
            .from('profiles')
            .select('tokens')
            .eq('id', userId)
            .single();

        if (!current) return false;

        const newTokens = Math.max(0, (current.tokens || 0) + tokenAmount);

        const { error } = await supabase
            .from('profiles')
            .update({ tokens: newTokens })
            .eq('id', userId);

        return !error;
    },

    deleteUserProfile: async (userId: string): Promise<boolean> => {
        // Use the secure RPC function instead of client-side admin API (which isn't available in browser)
        const { error } = await supabase.rpc('delete_user_by_admin', { target_user_id: userId });
        if (error) {
            console.error('Error deleting user:', error);
            return false;
        }
        return true;
    },

    updateUserRole: async (userId: string, newRole: 'ADMIN' | 'USER'): Promise<boolean> => {
        const { error } = await supabase.rpc('update_user_role', { target_user_id: userId, new_role: newRole });
        if (error) {
            console.error('Error updating role:', error);
            return false;
        }
        return true;
    },

    syncEmails: async (): Promise<void> => {
        await supabase.rpc('sync_user_emails');
    },

    updateProfile: async (username: string, avatarUrl?: string): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };

        const updates: { username: string; updated_at: string; avatar_url?: string } = {
            username,
            updated_at: new Date().toISOString()
        };
        if (avatarUrl) updates.avatar_url = avatarUrl;

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id);

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Profilo aggiornato con successo" };
    },

    uploadAvatar: async (file: File): Promise<{ success: boolean; url?: string; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };

        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) {
            return { success: false, message: "Caricamento fallito: " + uploadError.message };
        }

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        return { success: true, url: publicUrl, message: "Immagine caricata" };
    },

    // --- DUEL ARENA ---
    getChallengeableUsers: async (): Promise<{ id: string; username: string; avatarUrl?: string }[]> => {
        const md = await gameService.getMatchday();
        if (!md) return [];
        const { data, error } = await supabase.rpc('get_challengeable_users', { p_matchday_id: md.id });
        if (error) {
            console.error('Error fetching opponents:', error);
            return [];
        }
        return (data || []).map((u: any) => ({
            id: u.id,
            username: u.username,
            avatarUrl: u.avatar_url
        }));
    },

    createDuel: async (opponentId: string): Promise<{ success: boolean; message: string }> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, message: "Non loggato" };
        const md = await gameService.getMatchday();
        if (!md) return { success: false, message: "Nessuna giornata attiva" };

        const { error } = await supabase
            .from('duels')
            .insert({
                matchday_id: md.id,
                challenger_id: user.id,
                opponent_id: opponentId,
                status: 'PENDING'
            });

        if (error) return { success: false, message: error.message };
        return { success: true, message: "Sfida inviata!" };
    },

    getMyDuels: async (): Promise<Duel[]> => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        const { data, error } = await supabase
            .from('duels')
            .select(`
                *,
                challenger:profiles!challenger_id(id, username, avatar_url),
                opponent:profiles!opponent_id(id, username, avatar_url)
            `)
            .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching duels:', error);
            return [];
        }

        return (data || []).map((d: any) => ({
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
            scores: d.scores,
            winnerId: d.winner_id,
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
        const md = await gameService.getMatchday();
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

        return (data || []).map((d: any) => ({
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
            scores: d.scores,
            winnerId: d.winner_id,
            createdAt: d.created_at
        }));
    }
};


