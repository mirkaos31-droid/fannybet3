import { supabase } from '../supabaseClient';
import { WORLD_CUP_MATCHES } from '../data/worldCupMatches';

export const worldCupService = {
    // ---- ADMIN TOOLS ----

    async adminInitializeWorldCupMatches() {
        const matches = WORLD_CUP_MATCHES.map((m, idx) => {
            const isBigMatch = (idx % 12) === 11; 
            const matchday = Math.floor(idx / 12) + 1;
            // Create a fake ISO string for the database
            const fakeTime = new Date().toISOString(); 
            return {
                id: idx + 1,
                matchday,
                home_team: m.home,
                away_team: m.away,
                group_name: m.group,
                match_time: fakeTime,
                is_big_match: isBigMatch,
                real_result: null
            };
        });

        const { error } = await supabase.from('worldcup_matches').insert(matches);
        return { success: !error, message: error?.message };
    },

    async adminGenerateGroups() {
        const { data: participants } = await supabase.from('worldcup_user_groups').select('*');
        if (!participants || participants.length === 0) return { success: false, message: 'Nessun partecipante trovato' };

        const botNames = ['Bot Maldini', 'Bot Baggio', 'Bot Totti', 'Bot Del Piero', 'Bot Cannavaro', 'Bot Buffon'];
        const remainder = participants.length % 4;
        let allParticipants = [...participants];

        if (remainder !== 0) {
            const botsToAdd = 4 - remainder;
            const newBots = [];
            for(let i=0; i<botsToAdd; i++) {
                newBots.push({
                    bot_name: botNames[i % botNames.length] + ' ' + (Math.floor(Math.random() * 99) + 1).toString(),
                    group_name: 'WAITING',
                    status: 'ACTIVE'
                });
            }
            const { data: insertedBots } = await supabase.from('worldcup_user_groups').insert(newBots).select();
            if (insertedBots) {
                allParticipants = [...allParticipants, ...insertedBots];
            }
        }

        // Shuffle
        for (let i = allParticipants.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allParticipants[i], allParticipants[j]] = [allParticipants[j], allParticipants[i]];
        }

        // Assign groups
        const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
        const numGroups = allParticipants.length / 4;
        
        for (let g = 0; g < numGroups; g++) {
            const grpName = alphabet[g];
            for (let i = 0; i < 4; i++) {
                allParticipants[(g * 4) + i].group_name = grpName;
            }
        }

        // Update DB
        for (const p of allParticipants) {
            await supabase.from('worldcup_user_groups').update({ group_name: p.group_name }).eq('id', p.id);
        }

        // Generate Clashes
        const clashes = [];
        for (let g = 0; g < numGroups; g++) {
            const grp = allParticipants.slice(g * 4, (g * 4) + 4);
            const grpName = alphabet[g];
            clashes.push({ matchday: 1, group_name: grpName, home_participant_id: grp[0].id, away_participant_id: grp[1].id });
            clashes.push({ matchday: 1, group_name: grpName, home_participant_id: grp[2].id, away_participant_id: grp[3].id });
            clashes.push({ matchday: 2, group_name: grpName, home_participant_id: grp[0].id, away_participant_id: grp[2].id });
            clashes.push({ matchday: 2, group_name: grpName, home_participant_id: grp[1].id, away_participant_id: grp[3].id });
            clashes.push({ matchday: 3, group_name: grpName, home_participant_id: grp[0].id, away_participant_id: grp[3].id });
            clashes.push({ matchday: 3, group_name: grpName, home_participant_id: grp[1].id, away_participant_id: grp[2].id });
            clashes.push({ matchday: 4, group_name: grpName, home_participant_id: grp[1].id, away_participant_id: grp[0].id });
            clashes.push({ matchday: 4, group_name: grpName, home_participant_id: grp[3].id, away_participant_id: grp[2].id });
            clashes.push({ matchday: 5, group_name: grpName, home_participant_id: grp[2].id, away_participant_id: grp[0].id });
            clashes.push({ matchday: 5, group_name: grpName, home_participant_id: grp[3].id, away_participant_id: grp[1].id });
            clashes.push({ matchday: 6, group_name: grpName, home_participant_id: grp[3].id, away_participant_id: grp[0].id });
            clashes.push({ matchday: 6, group_name: grpName, home_participant_id: grp[2].id, away_participant_id: grp[1].id });
        }

        await supabase.from('worldcup_clashes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: clashError } = await supabase.from('worldcup_clashes').insert(clashes);

        if (!clashError) {
            const realUsers = allParticipants.filter(p => p.user_id);
            if (realUsers.length > 0) {
                const notifications = realUsers.map(u => ({
                    user_id: u.user_id,
                    title: '🌍 GIRONI MONDIALE GENERATI!',
                    message: `I gironi del Mondiale 2026 sono pronti! Sei nel GIRONE ${u.group_name}. Inizia subito a pronosticare!`,
                    type: 'info'
                }));
                await supabase.from('notifications').insert(notifications);
            }
        }

        return { success: !clashError, message: clashError?.message };
    },

    async adminResolveMatchday(matchday: number) {
        const { error } = await supabase.rpc('resolve_worldcup_matchday', { p_matchday: matchday });
        if (!error) {
            const { data: participants } = await supabase.from('worldcup_user_groups').select('user_id').not('user_id', 'is', null);
            if (participants && participants.length > 0) {
                const notifications = participants.map(p => ({
                    user_id: p.user_id,
                    title: `🏁 MONDIALE: G. ${matchday} CHIUSA`,
                    message: `La Giornata ${matchday} del Mondiale 2026 è stata archiviata. I risultati sono pronti!`,
                    type: 'info'
                }));
                await supabase.from('notifications').insert(notifications);
            }
        }
        return { success: !error, message: error?.message };
    },

    async adminSaveRealResults(resultsMap: Record<number, string>) {
        for (const [id, result] of Object.entries(resultsMap)) {
            await supabase.from('worldcup_matches').update({ real_result: result }).eq('id', parseInt(id));
        }
        return { success: true };
    },

    async adminResetWorldCup() {
        // Warning: This deletes EVERYTHING except the matches.
        await supabase.from('worldcup_predictions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('worldcup_clashes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('worldcup_user_groups').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        // Reset match real results
        await supabase.from('worldcup_matches').update({ real_result: null }).neq('id', 0);
        return { success: true };
    },


    // ---- USER TOOLS ----
    async joinWorldCup(userId: string) {
        // Check if already joined
        const { data: existing } = await supabase.from('worldcup_user_groups').select('id').eq('user_id', userId).single();
        if (existing) return { success: true }; // already joined

        const { error } = await supabase.from('worldcup_user_groups').insert({
            user_id: userId,
            group_name: 'WAITING',
            status: 'ACTIVE'
        });
        if (!error) {
            await supabase.from('notifications').insert([{
                user_id: userId,
                title: '🌍 MONDIALE: ISCRITTO!',
                message: 'Ti sei iscritto con successo ai Mondiali 2026! Sei in sala d\'attesa.',
                type: 'success'
            }]);
        }
        return { success: !error, message: error?.message };
    },

    async getUserGroups() {
        const { data, error } = await supabase.from('worldcup_user_groups')
            .select(`
                id, group_name, status, bot_name,
                user_id,
                profiles(username, avatar_url)
            `);
        if (error) {
            console.error('Error fetching user groups:', error);
        }
        return data || [];
    },

    async getMatches() {
        const { data } = await supabase.from('worldcup_matches').select('*').order('id', { ascending: true });
        return data || [];
    },

    async getClashes() {
        const { data } = await supabase.from('worldcup_clashes').select('*').order('matchday', { ascending: true });
        return data || [];
    },

    async getUserPredictions(userId: string) {
        const { data } = await supabase.from('worldcup_predictions').select('*').eq('user_id', userId);
        return data || [];
    },

    async savePredictions(userId: string, predictions: { match_id: number; prediction: string; is_jolly: boolean }[]) {
        if (predictions.length === 0) return { success: true };
        
        const formatted = predictions.map(p => ({
            user_id: userId,
            match_id: p.match_id,
            prediction: p.prediction,
            is_jolly: p.is_jolly
        }));

        const { error } = await supabase.from('worldcup_predictions').upsert(formatted, { onConflict: 'user_id,match_id' });
        if (!error) {
            await supabase.from('notifications').insert([{
                user_id: userId,
                title: '💾 SCHEDINA MONDIALE SALVATA',
                message: `I tuoi pronostici per il Mondiale sono stati registrati con successo.`,
                type: 'success'
            }]);
        }
        return { success: !error, message: error?.message };
    },
};
