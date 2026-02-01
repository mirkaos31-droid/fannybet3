import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gameService } from '../services/gameService';
import { supabase } from '../supabaseClient';
import type { Duel } from '../types';

interface SupabasePayload {
    new?: {
        results?: (string | null)[];
    };
}

const computeScore = (predictions: string[] | undefined, results: (string | null)[] | undefined) => {
    if (!predictions || !results) return 0;
    let s = 0;
    predictions.forEach((p, i) => {
        if (results[i] && results[i] === p) s++;
    });
    return s;
};

export const DuelArenaView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'FIND' | 'GLOBAL'>('ACTIVE');
    const [duels, setDuels] = useState<Duel[]>([]);
    const [globalDuels, setGlobalDuels] = useState<Duel[]>([]);
    const [opponents, setOpponents] = useState<{ id: string, username: string, avatarUrl?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [showRules, setShowRules] = useState(false);

    // Live update: keep a ref to latest duels and recompute scores on matchday updates
    const duelsRef = useRef<Duel[]>(duels);
    useEffect(() => { duelsRef.current = duels; }, [duels]);



    const refreshDuelScores = useCallback(async (results: (string | null)[] | undefined) => {
        if (!results) return;
        const current = duelsRef.current || [];
        if (current.length === 0) return;

        const updated = await Promise.all(current.map(async (d) => {
            if (d.status !== 'ACCEPTED') return d;
            const betC = await gameService.getUserBet(d.challenger.username);
            const betO = await gameService.getUserBet(d.opponent.username);
            const cScore = betC ? computeScore(betC.predictions, results) : 0;
            const oScore = betO ? computeScore(betO.predictions, results) : 0;
            const newScores = { challenger_score: cScore, opponent_score: oScore };

            // Persist only if changed to avoid spamming DB
            if (!d.scores || d.scores.challenger_score !== newScores.challenger_score || d.scores.opponent_score !== newScores.opponent_score) {
                // Fire-and-forget persistence (optimistic UI)
                gameService.updateDuelScores(d.id, newScores).catch(err => console.error('Failed saving duel scores', err));
                return { ...d, scores: newScores };
            }

            return d;
        }));

        setDuels(updated);
    }, []);

    const loadDuels = useCallback(async () => {
        const d = await gameService.getMyDuels();
        setDuels(d);
        // compute initial scores after loading
        const md = await gameService.getMatchday();
        if (md) await refreshDuelScores(md.results);
    }, [refreshDuelScores]);

    const loadOpponents = useCallback(async () => {
        const opp = await gameService.getChallengeableUsers();
        setOpponents(opp);
    }, []);

    const loadGlobalDuels = useCallback(async () => {
        const d = await gameService.getAllDuels();
        setGlobalDuels(d);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadDuels();
        loadOpponents();
        loadGlobalDuels();
    }, [loadDuels, loadOpponents, loadGlobalDuels]);

    // Subscribe to matchday updates (results changes) and refresh duel scores live
    useEffect(() => {
        let subscription: ReturnType<typeof supabase.channel> | null = null;
        let mounted = true;

        const setup = async () => {
            const md = await gameService.getMatchday();
            if (!md) return;

            // initial compute
            await refreshDuelScores(md.results);

            subscription = supabase
                .channel(`matchday-${md.id}`)
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matchdays', filter: `id=eq.${md.id}` }, (payload: SupabasePayload) => {
                    if (!mounted) return;
                    const newResults = payload.new?.results;
                    if (newResults) {
                        refreshDuelScores(newResults);
                    }
                })
                .subscribe();
        };

        setup();

        return () => {
            mounted = false;
            if (subscription) {
                try { supabase.removeChannel(subscription); } catch { /* ignore */ }
            }
        };
    }, [refreshDuelScores]);


    const handleChallenge = async (opponentId: string, username: string) => {
        if (!confirm(`Vuoi sfidare ${username} in una battaglia 1vs1?`)) return;
        setLoading(true);
        const res = await gameService.createDuel(opponentId);
        setLoading(false);
        if (res.success) {
            alert("⚔️ Sfida lanciata! Attendi che l'avversario accetti.");
            setActiveTab('ACTIVE');
            loadDuels();
        } else {
            alert("Errore: " + res.message);
        }
    };

    const handleRespond = async (duelId: string, accept: boolean) => {
        if (!confirm(accept ? "Accetti la sfida? Che vinca il migliore!" : "Rifiuti la sfida?")) return;
        const res = await gameService.respondToDuel(duelId, accept);
        if (res.success) {
            loadDuels();
        } else {
            alert("Errore: " + res.message);
        }
    };

    // Filter duels
    const pendingDuels = duels.filter(d => d.status === 'PENDING');
    const activeDuels = duels.filter(d => d.status === 'ACCEPTED');
    const completedDuels = duels.filter(d => d.status === 'COMPLETED');

    return (
        <div className="space-y-8 animate-fade-in pb-24">
            {/* HERO SECTION */}
            <div className="relative overflow-hidden rounded-2xl md:rounded-[40px] border-2 md:border-4 border-amber-700 p-4 md:p-8 text-center shadow-[0_0_50px_rgba(180,83,9,0.2)] bg-[url('/arena_bg.png')] bg-cover bg-center">
                {/* Overlay for readability */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-700 to-transparent opacity-50 z-10"></div>

                <div className="flex flex-col items-center justify-center gap-6 relative z-10">
                    <img
                        src="/shield_logo.png"
                        alt="Arena Logo"
                        className="w-48 h-48 object-contain drop-shadow-[0_0_25px_rgba(180,83,9,0.5)] animate-float"
                        style={{
                            maskImage: 'radial-gradient(circle at center, black 50%, transparent 100%)',
                            WebkitMaskImage: 'radial-gradient(circle at center, black 50%, transparent 100%)'
                        }}
                        onError={(e) => e.currentTarget.src = 'https://placehold.co/150x150/000000/b45309?text=🛡️'}
                    />

                    <div>
                        <h1 className="text-3xl md:text-7xl font-black italic tracking-tighter text-white mb-2 uppercase">
                            L'ARENA
                            <span className="text-amber-600 text-4xl md:text-8xl align-top ml-1 md:ml-2 font-display">*</span>
                        </h1>
                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-xs md:text-sm max-w-lg mx-auto">
                            Sfida gli altri utenti in duelli 1vs1.
                            <br />
                            <span className="text-amber-500">Chi rischia di più, vince di più.</span>
                        </p>
                    </div>

                    <button
                        onClick={() => setShowRules(!showRules)}
                        className="text-[10px] font-black uppercase tracking-widest text-amber-600 border-b border-amber-600/30 hover:border-amber-600 transition-all pb-1"
                    >
                        {showRules ? 'Chiudi Regole' : 'Come Funziona il Punteggio?'}
                    </button>

                    {showRules && (
                        <div className="bg-white/5 p-4 rounded-xl text-left text-xs text-gray-300 w-full max-w-md border border-white/10 animate-fade-in space-y-2">
                            <p className="font-bold text-white mb-1">🥅 SYSTEMA GOAL (1-3):</p>
                            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
                                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] font-mono">1 ⚽</span>
                                <span>Risultato POPOLARE (scelto da {'>'}50%)</span>

                                <span className="bg-[#dfff00]/20 text-[#dfff00] px-2 py-0.5 rounded text-[10px] font-mono">2 ⚽</span>
                                <span>Risultato BILANCIATO (20-50%)</span>

                                <span className="bg-red-500/20 text-red-500 px-2 py-0.5 rounded text-[10px] font-mono">3 ⚽</span>
                                <span>Risultato RISCHIOSO ({'<'}20%)</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* TABS */}
            <div className="flex p-1 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 overflow-hidden">
                <button
                    onClick={() => setActiveTab('ACTIVE')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'ACTIVE'
                        ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
                        : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Le Mie Sfide
                </button>
                <button
                    onClick={() => setActiveTab('FIND')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'FIND'
                        ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
                        : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Trova Avversari
                </button>
                <button
                    onClick={() => setActiveTab('GLOBAL')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'GLOBAL'
                        ? 'bg-amber-600/20 text-amber-500 border border-amber-600/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
                        : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Tutti i Duelli
                </button>
            </div>

            {/* CONTENT */}
            {activeTab === 'ACTIVE' && (
                <div className="space-y-8">
                    {/* PENDING REQUESTS section */}
                    {pendingDuels.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-black italic text-white border-l-4 border-amber-500 pl-4">RICHIESTE IN ATTESA</h3>
                            <div className="grid gap-4">
                                {pendingDuels.map(duel => (
                                    <DuelCard
                                        key={duel.id}
                                        duel={duel}
                                        onRespond={handleRespond}
                                        isPending={true}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ACTIVE BATTLES */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-black italic text-white border-l-4 border-amber-700 pl-4">DUELLI IN CORSO</h3>
                        {activeDuels.length === 0 ? (
                            <div className="text-center py-12 text-gray-600 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                                Nessun duello attivo. <br />
                                <button onClick={() => setActiveTab('FIND')} className="text-amber-600 underline mt-2 hover:text-white transition-colors">Lancia una sfida!</button>
                            </div>
                        ) : (
                            <div className="grid gap-6">
                                {activeDuels.map(duel => (
                                    <DuelCard key={duel.id} duel={duel} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* HISTORY */}
                    {completedDuels.length > 0 && (
                        <div className="space-y-4 opacity-60 hover:opacity-100 transition-opacity">
                            <h3 className="text-lg font-black italic text-gray-400 border-l-4 border-gray-600 pl-4">STORICO</h3>
                            <div className="grid gap-4">
                                {completedDuels.map(duel => (
                                    <DuelCard key={duel.id} duel={duel} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            {activeTab === 'GLOBAL' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-black italic text-white border-l-4 border-amber-700 pl-4 uppercase">BATTAGLIE GLOBALI</h3>
                    {globalDuels.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                            Nessun duello registrato per questa giornata.
                        </div>
                    ) : (
                        <div className="grid gap-6">
                            {globalDuels.map(duel => (
                                <DuelCard key={duel.id} duel={duel} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'FIND' && (
                <div className="space-y-6">
                    <h3 className="text-lg font-black italic text-white border-l-4 border-amber-700 pl-4">SFIDA UN GIOCATORE</h3>
                    <p className="text-xs text-gray-500 max-w-md">
                        Puoi sfidare solo gli utenti che hanno <strong>già inserito</strong> la schedina per la giornata corrente.
                    </p>

                    {opponents.length === 0 ? (
                        <div className="text-center py-12 text-gray-500 font-bold uppercase tracking-widest border-2 border-dashed border-white/5 rounded-3xl">
                            Nessun avversario disponibile al momento.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {opponents.map(opp => (
                                <div key={opp.id} className="bg-white/5 border border-white/10 p-4 rounded-2xl flex items-center justify-between group hover:border-amber-600 hover:bg-black transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-black border border-white/20 overflow-hidden">
                                            {opp.avatarUrl ? (
                                                <img src={opp.avatarUrl} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-500">
                                                    {opp.username.substring(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <span className="font-bold text-white group-hover:text-amber-500 transition-colors">{opp.username}</span>
                                    </div>
                                    <button
                                        onClick={() => handleChallenge(opp.id, opp.username)}
                                        disabled={loading}
                                        className="px-4 py-2 bg-amber-600 text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(180,83,9,0.2)]"
                                    >
                                        Invita ⚔️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Sub-component for Cards
const DuelCard: React.FC<{ duel: Duel, isPending?: boolean, onRespond?: (id: string, accept: boolean) => void }> = ({ duel, isPending, onRespond }) => {
    // Small win animation when a duel becomes COMPLETED with a declared winner
    const [showWinAnim, setShowWinAnim] = useState(false);
    const prevStatusRef = useRef<string | undefined>(duel.status);

    useEffect(() => {
        if (prevStatusRef.current !== duel.status) {
            if (duel.status === 'COMPLETED' && duel.winnerId) {
                // Trigger small celebratory animation
                setTimeout(() => {
                    setShowWinAnim(true);
                    document.body.classList.add('bronze-arena');

                    // Hide after animation
                    const t = setTimeout(() => {
                        setShowWinAnim(false);
                        document.body.classList.remove('bronze-arena');
                    }, 6500);

                    return () => clearTimeout(t);
                }, 0);
            }
            prevStatusRef.current = duel.status;
        }
    }, [duel.status, duel.winnerId]);

    const winnerName = duel.winnerId === duel.challenger.id ? duel.challenger.username : duel.winnerId === duel.opponent.id ? duel.opponent.username : 'Vincitore';

    return (
        <div className={`relative bg-black rounded-2xl md:rounded-3xl p-4 md:p-6 border-2 ${isPending ? 'border-amber-500/50' : 'border-amber-700/30'} overflow-hidden group hover:border-amber-600 transition-colors`}>
            {/* WIN OVERLAY */}
            {showWinAnim && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="duel-win-overlay flex flex-col items-center justify-center text-center">
                        <div className="trophy-pop text-amber-400">
                            <svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-300 drop-shadow-[0_0_20px_rgba(255,204,0,0.6)]">
                                <path d="M8 21h8"></path>
                                <path d="M9 17h6v-3a6 6 0 0 0 6-6V3H3v5a6 6 0 0 0 6 6v3z"></path>
                                <circle cx="12" cy="7" r="3"></circle>
                            </svg>
                        </div>
                        <div className="mt-4 text-amber-300 font-black text-lg md:text-2xl uppercase">{winnerName} <span className="text-white">vince!</span></div>

                        <div className="confetti-container absolute inset-0 pointer-events-none">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <span key={i} className={`confetti confetti-${i % 6}`} style={{ left: `${(i * 5) % 100}%`, animationDelay: `${(i % 6) * 0.08}s` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* VS Badge */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <div className="bg-black border-2 border-amber-700 rounded-full w-12 h-12 flex items-center justify-center text-amber-600 font-black italic text-xl shadow-xl group-hover:scale-110 transition-transform">
                    VS
                </div>
            </div>

            <div className="flex justify-between items-center relative z-0">
                {/* Challenger Side */}
                <div className="flex flex-col items-center gap-2 w-1/2 pr-6 border-r border-white/5">
                    <div className="w-14 h-14 rounded-full border-2 border-amber-600 p-1 shadow-[0_0_15px_rgba(180,83,9,0.3)]">
                        <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                            {duel.challenger.avatarUrl && <img src={duel.challenger.avatarUrl} className="w-full h-full object-cover" />}
                        </div>
                    </div>
                    <span className="font-black text-white text-sm">{duel.challenger.username}</span>
                    {duel.scores && (
                        <div className="text-3xl font-black text-amber-500 drop-shadow-[0_0_10px_rgba(180,83,9,0.5)]">{duel.scores.challenger_score}</div>
                    )}
                </div>

                {/* Opponent Side */}
                <div className="flex flex-col items-center gap-2 w-1/2 pl-6">
                    <div className="w-14 h-14 rounded-full border-2 border-amber-900 p-1">
                        <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                            {duel.opponent.avatarUrl && <img src={duel.opponent.avatarUrl} className="w-full h-full object-cover" />}
                        </div>
                    </div>
                    <span className="font-black text-white text-sm">{duel.opponent.username}</span>
                    {duel.scores && (
                        <div className="text-3xl font-black text-white/50">{duel.scores.opponent_score}</div>
                    )}
                </div>
            </div>

            {/* Footer Action / Status */}
            <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
                {isPending && onRespond ? (
                    <div className="flex gap-4 w-full">
                        <button onClick={() => onRespond(duel.id, false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all">
                            Rifiuta
                        </button>
                        <button onClick={() => onRespond(duel.id, true)} className="flex-1 py-3 rounded-xl bg-amber-600 text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:scale-105 transition-all shadow-[0_0_15px_rgba(180,83,9,0.4)]">
                            Accetta Sfida
                        </button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        {duel.status === 'COMPLETED' ? (
                            <div className="text-xs font-bold uppercase tracking-widest text-amber-700/80">Terminata</div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="inline-block bg-amber-600 text-black text-[10px] font-black uppercase px-2 py-1 rounded animate-pulse">LIVE</span>
                                <div className="text-xs font-bold uppercase tracking-widest text-amber-700/80">In Corso...</div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
