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
    const [wagerAmount, setWagerAmount] = useState(0);
    const [selectedOpponent, setSelectedOpponent] = useState<{ id: string, username: string } | null>(null);

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

    // Subscribe to duels changes (so UI updates from server-side resolution and triggers animations)
    useEffect(() => {
        let duelsChannel: ReturnType<typeof supabase.channel> | null = null;
        let mounted = true;

        const setup = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            // Subscribe to any INSERT/UPDATE/DELETE affecting duels where the user is challenger or opponent
            duelsChannel = supabase
                .channel(`duels-user-${user.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'duels', filter: `or(challenger_id.eq.${user.id},opponent_id.eq.${user.id})` }, (_payload: any) => {
                    if (!mounted) return;
                    // Reload lists so DuelCard gets fresh data and animations can trigger
                    loadDuels();
                    loadGlobalDuels();
                })
                .subscribe();
        };

        setup();

        return () => {
            mounted = false;
            if (duelsChannel) {
                try { supabase.removeChannel(duelsChannel); } catch { /* ignore */ }
            }
        };
    }, [loadDuels, loadGlobalDuels]);


    const handleChallenge = async (opponentId: string, username: string) => {
        // Refactoring to use state for the modal
        setSelectedOpponent({ id: opponentId, username });
    };

    const confirmChallenge = async () => {
        if (!selectedOpponent) return;
        setLoading(true);
        const res = await gameService.createDuel(selectedOpponent.id, wagerAmount);
        setLoading(false);
        setSelectedOpponent(null); // Close modal
        if (res.success) {
            alert(`⚔️ Sfida lanciata a ${selectedOpponent.username}!\nPosta: ${wagerAmount} Token.`);
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
            <div className="relative overflow-hidden rounded-2xl md:rounded-[40px] border-2 md:border-4 border-[#b45309] p-4 md:p-8 text-center shadow-[0_0_50px_rgba(180,83,9,0.25)] bg-[url('/arena_bg.png')] bg-cover bg-center">
                {/* Overlay for readability */}
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]"></div>
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#b45309] to-transparent opacity-50 z-10"></div>

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
                        </h1>
                        <p className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs max-w-lg mx-auto">
                            Sfida gli altri utenti in duelli 1vs1.
                            <br />
                            <span className="text-[#b45309] font-black">COME SI VINCE?</span> Vince chi totalizza più <span className="text-white">Goal</span> indovinando i risultati più difficili.
                        </p>
                    </div>

                    <button
                        onClick={() => setShowRules(!showRules)}
                        className="text-[10px] font-black uppercase tracking-widest text-[#b45309] border-b border-[#b45309]/30 hover:border-[#b45309] transition-all pb-1"
                    >
                        {showRules ? 'Chiudi Regole' : 'Regolamento Sfide ⚔️'}
                    </button>

                    {showRules && (
                        <div className="bg-black/90 p-5 rounded-2xl text-left text-xs text-gray-300 w-full max-w-md border border-[#b45309]/30 animate-fade-in space-y-4 shadow-2xl">
                            <div>
                                <p className="font-black text-[#b45309] mb-1 uppercase tracking-tighter italic">🥅 COME SI VINCE:</p>
                                <p className="text-[11px] leading-relaxed text-gray-400">
                                    Il vincitore è colui che ottiene il <span className="text-white font-bold">maggior numero di Goal</span> totali. In caso di pareggio nei goal, la posta viene restituita ad entrambi i giocatori.
                                </p>
                            </div>

                            <div>
                                <p className="font-black text-white mb-2 uppercase tracking-tighter italic text-[10px]">📊 VALORE DEI PRONOSTICI:</p>
                                <div className="grid grid-cols-[auto_1fr] gap-3 items-center">
                                    <span className="bg-white/10 px-2 py-1 rounded text-[10px] font-mono text-center min-w-[40px]">1 ⚽</span>
                                    <span className="text-gray-400">Risultato <span className="text-white">FACILE</span> (scelto da {'>'}50% degli utenti)</span>

                                    <span className="bg-[#bfff00]/20 text-[#bfff00] px-2 py-1 rounded text-[10px] font-mono text-center min-w-[40px]">2 ⚽</span>
                                    <span className="text-gray-400">Risultato <span className="text-white">MEDIO</span> (scelto dal 20% al 50%)</span>

                                    <span className="bg-red-500/20 text-red-500 px-2 py-1 rounded text-[10px] font-mono text-center min-w-[40px]">3 ⚽</span>
                                    <span className="text-gray-400">Risultato <span className="text-white">DIFFICILE</span> (scelto da {'<'}20%)</span>
                                </div>
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
                        ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
                        : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Le Mie Sfide
                </button>
                <button
                    onClick={() => setActiveTab('FIND')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'FIND'
                        ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
                        : 'text-gray-500 hover:text-white'
                        }`}
                >
                    Trova Avversari
                </button>
                <button
                    onClick={() => setActiveTab('GLOBAL')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'GLOBAL'
                        ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]'
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
                            <h3 className="text-lg font-black italic text-white border-l-4 border-[#b45309] pl-4">RICHIESTE IN ATTESA</h3>
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
                        <h3 className="text-lg font-black italic text-white border-l-4 border-[#b45309] pl-4">DUELLI IN CORSO</h3>
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
                    <h3 className="text-lg font-black italic text-white border-l-4 border-[#b45309] pl-4 uppercase">BATTAGLIE GLOBALI</h3>
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
                    <h3 className="text-lg font-black italic text-white border-l-4 border-[#b45309] pl-4">SFIDA UN GIOCATORE</h3>
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
                                        className="px-4 py-2 bg-[#b45309] text-black text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-amber-500 hover:scale-105 active:scale-95 transition-all shadow-[0_0_10px_rgba(180,83,9,0.2)]"
                                    >
                                        Invita ⚔️
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {/* CHALLENGE MODAL */}
            {selectedOpponent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
                    <div className="bg-gray-900 border border-amber-600/50 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative">
                        <h3 className="text-xl font-black italic text-white uppercase text-center mb-4">
                            Sfida <span className="text-amber-500">{selectedOpponent.username}</span>
                        </h3>

                        <div className="space-y-4 mb-6">
                            <div className="text-center">
                                <label className="block text-xs font-black uppercase text-gray-500 tracking-widest mb-2">
                                    Scegli la Posta (Token)
                                </label>
                                <div className="flex justify-center gap-2">
                                    {[0, 1, 2, 3, 4, 5].map(amt => (
                                        <button
                                            key={amt}
                                            onClick={() => setWagerAmount(amt)}
                                            className={`w-10 h-10 rounded-lg font-black text-sm flex items-center justify-center transition-all ${wagerAmount === amt
                                                ? 'bg-amber-500 text-black scale-110 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                                                : 'bg-white/10 text-gray-400 hover:bg-white/20'
                                                }`}
                                        >
                                            {amt}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-gray-500 mt-2">
                                    {wagerAmount === 0 ? "Duello amichevole (Nessun rischio)" : `Vinci: ${wagerAmount * 2} Token | Perdi: ${wagerAmount} Token`}
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setSelectedOpponent(null)}
                                className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-black text-xs uppercase tracking-widest hover:bg-white/10"
                            >
                                Annulla
                            </button>
                            <button
                                onClick={confirmChallenge}
                                disabled={loading}
                                className="flex-1 py-3 rounded-xl bg-[#b45309] text-black font-black text-xs uppercase tracking-widest hover:bg-amber-500 shadow-lg"
                            >
                                {loading ? 'Invio...' : 'Lancia Sfida'}
                            </button>
                        </div>
                    </div>
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
        <div className={`relative bg-black rounded-2xl md:rounded-3xl p-4 md:p-6 border-2 ${isPending ? 'border-[#b45309]/50' : 'border-[#b45309]/30'} overflow-hidden group hover:border-[#b45309] transition-colors`}>
            {/* WIN OVERLAY */}
            {showWinAnim && (
                <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                    <div className="duel-win-overlay flex flex-col items-center justify-center text-center">
                        <div className="trophy-pop text-[#b45309]">
                            <svg xmlns="http://www.w3.org/2000/svg" width="92" height="92" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="text-[#b45309] drop-shadow-[0_0_20px_rgba(180,83,9,0.6)]">
                                <path d="M8 21h8"></path>
                                <path d="M9 17h6v-3a6 6 0 0 0 6-6V3H3v5a6 6 0 0 0 6 6v3z"></path>
                                <circle cx="12" cy="7" r="3"></circle>
                            </svg>
                        </div>
                        <div className="mt-4 text-[#b45309] font-black text-lg md:text-2xl uppercase">{winnerName} <span className="text-white">vince!</span></div>

                        <div className="confetti-container absolute inset-0 pointer-events-none">
                            {Array.from({ length: 20 }).map((_, i) => (
                                <span key={i} className={`confetti confetti-${i % 6}`} style={{ left: `${(i * 5) % 100}%`, animationDelay: `${(i % 6) * 0.08}s` }} />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* VS Badge - REMOVED CIRCLE */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
                <div className="text-[#b45309] font-black italic text-2xl shadow-xl group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(180,83,9,0.8)]">
                    VS
                </div>

                {/* Wager Badge - CENTERED */}
                {duel.wagerAmount !== undefined && (
                    <div className="flex flex-col items-center">
                        <div className="text-[10px] uppercase text-gray-500 font-bold tracking-widest leading-none">POSTA</div>
                        <div className="text-cyan-400 font-mono font-black text-xl drop-shadow-[0_0_10px_rgba(34,211,238,0.8)] animate-pulse-slow leading-none mt-0.5">
                            {duel.wagerAmount} <span className="text-[8px] text-cyan-600">TK</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between items-center relative z-0">
                {/* Challenger Side */}
                <div className="flex flex-col items-center gap-2 w-1/2 pr-6 border-r border-white/5">
                    <div className="w-14 h-14 rounded-full border-2 border-[#b45309] p-1 shadow-[0_0_15px_rgba(180,83,9,0.3)]">
                        <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden">
                            {duel.challenger.avatarUrl && <img src={duel.challenger.avatarUrl} className="w-full h-full object-cover" />}
                        </div>
                    </div>
                    <span className="font-black text-white text-sm">{duel.challenger.username}</span>
                    {duel.scores && (
                        <div className="text-3xl font-black text-[#b45309] drop-shadow-[0_0_10px_rgba(180,83,9,0.5)]">{duel.scores.challenger_score}</div>
                    )}
                </div>

                {/* Opponent Side */}
                <div className="flex flex-col items-center gap-2 w-1/2 pl-6">
                    <div className="w-14 h-14 rounded-full border-2 border-[#452711] p-1">
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
                        <button onClick={() => onRespond(duel.id, true)} className="flex-1 py-3 rounded-xl bg-[#b45309] text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:scale-105 transition-all shadow-[0_0_15px_rgba(180,83,9,0.4)]">
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
