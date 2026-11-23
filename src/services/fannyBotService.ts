import { supabase } from '../supabaseClient';
import { communityFeedService } from './communityFeedService';
import { fbLegaService } from './fbLegaService';
import { survivalService } from './survivalService';

// Pick random element from an array helper
const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

// Punchlines and commentary pools
const MVP_PUNCHLINES = [
    '🔮 Ha visto il futuro oppure ha corrotto direttamente il VAR.',
    '🎯 Un cecchino infallibile: partite lette come un libro aperto.',
    '👑 Signori, tutti in piedi: ha dispensato lezioni di calcio gratis alla comitiva.',
    '🧠 QI calcistico fuori scala questa settimana. Applausi a scena aperta.',
    '⚡ In stato di grazia totale: nessuno è riuscito a tenergli testa.'
];

const WOODEN_SPOON_PUNCHLINES = [
    '🤡 Premio "Gufata Suprema" d\'ufficio: consigliamo un pellegrinaggio urgente a Lourdes.',
    '🎲 Ha chiaramente compilato la schedina tirando a sorte bendato sul parquet.',
    '📉 Punteggio da retrocessione immediata: perfino il gatto avrebbe azzeccato più risultati.',
    '🪦 Un minuto di raccoglimento per questa schedina, finita dritta nel tritatutto.',
    '🍿 Un caloroso ringraziamento da parte di tutti per aver regalato perle di ottimismo.'
];

const SURVIVAL_CARNAGE_PUNCHLINES = [
    '💀 Strage senza pietà nella fossa dei leoni! Le teste rotolano e l\'Arena si svuota.',
    '🩸 Bagno di sangue sportivo: i grandi favoriti sono caduti come birilli.',
    '🪓 Giornata fatale: l\'Arena ha mietuto altre vittime innocenti (o presunte tali).'
];

const SURVIVAL_MERCY_PUNCHLINES = [
    '🛡️ Miracolo nell\'Arena: quasi tutti salvi! I gufi della curva piangono lacrime amare.',
    '👀 Tutti vivi per il rotto della cuffia: ma al prossimo round non ci saranno sconti.',
    '✨ Passo indenne da manuale: la Dea Bendata ha baciato i concorrenti.'
];

export const fannyBotService = {
    /**
     * Automatic recap when an FB Lega (Fanta 1X2) round is resolved
     */
    async postFBLegaRoundRecap(leagueId: number, matchdayId: number): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[FannyBot] Generating autonomous recap for League ${leagueId}, Matchday ${matchdayId}...`);

            // 1. Get League info
            const { data: league, error: lError } = await supabase
                .from('fb_leagues')
                .select('name, current_round, duration_matchdays')
                .eq('id', leagueId)
                .single();

            if (lError || !league) {
                console.warn('[FannyBot] League not found for bot recap:', lError);
                return { success: false, error: 'League not found' };
            }

            // 2. Get round participants and scores
            const participants = await fbLegaService.getHistoricalLeaderboard(leagueId, matchdayId);
            if (!participants || participants.length === 0) {
                console.log('[FannyBot] No participants found for this round.');
                return { success: false, error: 'No participants' };
            }

            // Sort by matchday points (live_points) to find best and worst of the round
            const sortedByRound = [...participants].sort((a, b) => (b.live_points || 0) - (a.live_points || 0));
            // Sort by total points to find overall leader
            const sortedByTotal = [...participants].sort((a, b) => (b.total_points || 0) - (a.total_points || 0));

            const topRound = sortedByRound[0];
            const worstRound = sortedByRound[sortedByRound.length - 1];
            const overallLeader = sortedByTotal[0];

            const roundNum = league.current_round || 1;
            const leagueName = league.name || 'Fanta 1X2';

            const mvpPhrase = pickRandom(MVP_PUNCHLINES);
            const spoonPhrase = pickRandom(WOODEN_SPOON_PUNCHLINES);

            // Construct spicy bulletin text
            let content = `📢 **BOLLETTINO UFFICIALE: ROUND ${roundNum} CONCLUSO!**\n\n`;
            content += `🏆 Lega: *${leagueName}*\n\n`;

            if (topRound && (topRound.live_points || 0) > 0) {
                content += `👑 **MVP DEL ROUND:** @${topRound.username} con **${topRound.live_points} PT**!\n`;
                content += `${mvpPhrase}\n\n`;
            }

            if (worstRound && worstRound.username !== topRound?.username) {
                content += `🤡 **CUCCHIAIO DI LEGNO:** @${worstRound.username} si ferma a **${worstRound.live_points || 0} PT**!\n`;
                content += `${spoonPhrase}\n\n`;
            }

            if (overallLeader) {
                content += `🔥 **CAPOLISTA GENERALE:** @${overallLeader.username} guarda tutti dall'alto a quota **${overallLeader.total_points} PT**.\n\n`;
            }

            content += `👉 Controllate la classifica completa e commentate qui sotto! Chi osa sfidare il capolista? 🍿⚔️`;

            const title = `📊 REPORT ROUND ${roundNum} [${leagueName.toUpperCase()}]`;

            await communityFeedService.createBotPost(
                title,
                content,
                'BOT_LEADERBOARD',
                {
                    leagueId,
                    matchdayId,
                    roundNum,
                    mvp: topRound?.username,
                    mvpPoints: topRound?.live_points,
                    woodenSpoon: worstRound?.username,
                    leader: overallLeader?.username
                }
            );

            console.log(`[FannyBot] Autonomous FB Lega recap posted successfully!`);
            return { success: true };
        } catch (err: any) {
            console.error('[FannyBot] Error in postFBLegaRoundRecap:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Automatic recap when a Survival round / Matchday is archived
     */
    async postSurvivalMatchdayRecap(
        matchdayId: number,
        survivalStats?: { eliminated: number; advanced: number }
    ): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[FannyBot] Generating autonomous Survival recap for Matchday ${matchdayId}...`);

            // Fetch season state to get total survivors remaining
            const { season, players } = await survivalService.getSurvivalState();
            const alivePlayers = players.filter(p => p.status === 'ALIVE');

            const eliminated = survivalStats?.eliminated || 0;
            const advanced = survivalStats?.advanced || 0;

            let title = `💀 RESOCONTO ARENA SURVIVAL: ROUND ARCHIVIATO`;
            let content = `🏁 **I GIOCHI SONO FATTI!**\n\n`;

            if (alivePlayers.length === 1 && season?.status === 'COMPLETED') {
                const winner = alivePlayers[0];
                title = `🏆 GLORIA ETERNA AL CAMPIONE SURVIVAL!`;
                content = `👑 **HABEMUS CAMPIONEM!**\n\n`;
                content += `Tutti gli altri sono caduti sul campo di battaglia: **@${winner.username}** è l'unico vero Sopravvissuto dell'Arena!\n\n`;
                content += `💰 Il montepremi totale è stato accreditato al Re indiscusso. Inchinatevi! 🍾🎉`;
            } else if (eliminated > 0) {
                const phrase = pickRandom(SURVIVAL_CARNAGE_PUNCHLINES);
                title = `💀 CARNEFICINA NELL'ARENA SURVIVAL!`;
                content += `🩸 **${eliminated} gladiatori hanno perso la vita** in questo round!\n`;
                content += `${phrase}\n\n`;
                content += `🛡️ Sono riusciti a salvarsi in **${advanced}**.\n`;
                content += `👀 Rimangono **${alivePlayers.length} superstiti** a contendersi il montepremi.\n\n`;
                content += `Resisterete fino al prossimo round o farete la stessa fine? 🪦🍿`;
            } else {
                const phrase = pickRandom(SURVIVAL_MERCY_PUNCHLINES);
                title = `🛡️ ARENA SURVIVAL: MIRACOLO NEL ROUND!`;
                content += `Nessun caduto in questo round!\n`;
                content += `${phrase}\n\n`;
                content += `Tutti i **${alivePlayers.length} guerrieri** avanzano alla prossima battaglia. Ma la lama del boia è solo rimandata... ⚔️🔥`;
            }

            await communityFeedService.createBotPost(
                title,
                content,
                'BOT_RESULT',
                { matchdayId, survivalStats, remainingAlive: alivePlayers.length }
            );

            console.log(`[FannyBot] Autonomous Survival recap posted successfully!`);
            return { success: true };
        } catch (err: any) {
            console.error('[FannyBot] Error in postSurvivalMatchdayRecap:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Automatic announcement when an entire league finishes and prizes are paid out
     */
    async postLeagueWinnersAnnouncement(leagueId: number): Promise<{ success: boolean; error?: string }> {
        try {
            console.log(`[FannyBot] Announcing final winners for League ${leagueId}...`);

            const { data: league } = await supabase
                .from('fb_leagues')
                .select('name')
                .eq('id', leagueId)
                .single();

            const participants = await fbLegaService.getLeagueLeaderboardLive(leagueId);
            if (!participants || participants.length === 0) return { success: false };

            const sorted = [...participants].sort((a, b) => b.total_points - a.total_points);
            const winner = sorted[0];
            const second = sorted[1];
            const third = sorted[2];

            const leagueName = league?.name || 'Fanta 1X2';

            const title = `👑 TRIONFO FINALE: ECCO I VINCITORI DI [${leagueName.toUpperCase()}]!`;
            let content = `🎉 **LA STAGIONE È UFFICIALMENTE CONCLUSA!**\n\n`;
            content += `I premi e i token sono stati distribuiti. Ecco il podio storico:\n\n`;
            content += `🥇 **1° CLASSIFICATO (CAMPIONE):** @${winner?.username} (${winner?.total_points} PT)\n`;
            if (second) content += `🥈 **2° CLASSIFICATO:** @${second.username} (${second.total_points} PT)\n`;
            if (third) content += `🥉 **3° CLASSIFICATO:** @${third.username} (${third.total_points} PT)\n\n`;
            content += `🏆 Onore al vincitore, gloria a chi ha lottato fino all'ultimo secondo, e una pacca sulla spalla a tutti gli altri. Ci vediamo alla prossima stagione! 🔥🍾`;

            await communityFeedService.createBotPost(
                title,
                content,
                'BOT_RESULT',
                { leagueId, podium: [winner?.username, second?.username, third?.username] },
                true // pinned!
            );

            return { success: true };
        } catch (err: any) {
            console.error('[FannyBot] Error in postLeagueWinnersAnnouncement:', err);
            return { success: false, error: err.message };
        }
    },

    /**
     * Generate an on-demand smart bulletin for the admin to preview or launch
     */
    async generateSmartBulletin(): Promise<{ title: string; content: string; type: any }> {
        try {
            // Check active survival
            const { players } = await survivalService.getSurvivalState();
            const alive = players.filter(p => p.status === 'ALIVE').length;

            const topics = [
                {
                    title: '⏳ CONTO ALLA ROVESCIA SCHEDINE!',
                    content: `Attenzione Fannies: il tempo scorre inesorabile! Chi dimentica di compilare la schedina regala punti agli avversari e si candida ufficialmente al Cucchiaio di Legno. Correte a giocare prima che si chiudano i cancelli! ⏰⚽`,
                    type: 'BOT_DEADLINE'
                },
                {
                    title: `⚔️ ARENA SURVIVAL: ${alive} GUERRIERI IN TRINCEA`,
                    content: `La tensione si taglia con il coltello: solo ${alive} sopravvissuti ancora in vita nel torneo! Chi sarà il prossimo a crollare sotto la pressione? Fate i vostri pronostici e non tremate al momento della scelta! 💀🛡️`,
                    type: 'BOT_ALERT'
                },
                {
                    title: '🍿 GUFI IN AGGUATO SULLA GIORNATA',
                    content: `I sondaggi della Curva parlano chiaro: le gufate sono state distribuite equamente su tutti i campi di Serie A. Chi riuscirà a salvarsi dai risultati a sorpresa? Che vinca il più lucido... o il più fortunato! 🔥👀`,
                    type: 'BOT_ALERT'
                }
            ];

            return pickRandom(topics);
        } catch {
            return {
                title: '📢 NOTIZIARIO DELLA CURVA',
                content: 'I motori sono caldi e i pronostici sono in bilico. Chi guiderà la classifica al termine di questa giornata? ⚽🔥',
                type: 'BOT_ALERT'
            };
        }
    }
};
