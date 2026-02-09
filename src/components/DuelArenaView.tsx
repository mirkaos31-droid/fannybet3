import React, { useState, useEffect, useCallback, useRef } from 'react';
import { gameService } from '../services/gameService';
import { supabase } from '../supabaseClient';
import type { Duel } from '../types';
import { Swords, History } from 'lucide-react';

interface DuelArenaViewProps {
    initialOpponent?: { id: string, username: string };
}

export const DuelArenaView: React.FC<DuelArenaViewProps> = ({ initialOpponent }) => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'FIND' | 'GLOBAL'>('ACTIVE');
    const [duels, setDuels] = useState<Duel[]>([]);
    const [globalDuels, setGlobalDuels] = useState<Duel[]>([]);
    const [opponents, setOpponents] = useState<{ id: string, username: string, avatarUrl?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [showRules, setShowRules] = useState(false);
    const [wagerAmount, setWagerAmount] = useState(0);
    const [selectedOpponent, setSelectedOpponent] = useState<{ id: string, username: string } | null>(initialOpponent || null);


    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [userTokens, setUserTokens] = useState(0);

    const loadDuels = useCallback(async () => {
        const d = await gameService.getMyDuels();
        setDuels(d);
    }, []);

    const loadOpponents = useCallback(async () => {
        const opp = await gameService.getChallengeableUsers();
        setOpponents(opp);
    }, []);

    const loadGlobalDuels = useCallback(async () => {
        const d = await gameService.getAllDuels();
        setGlobalDuels(d);
    }, []);

    const loadProfile = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const { data } = await supabase.from('profiles').select('tokens').eq('id', user.id).single();
        if (data) setUserTokens(data.tokens || 0);
    }, []);

    // Initial load
    useEffect(() => {
        const init = async () => {
            await loadProfile();
            // Parallel load others
            loadDuels();
            loadOpponents();
            loadGlobalDuels();
        };
        init();
    }, [loadDuels, loadOpponents, loadGlobalDuels, loadProfile]);

    // Subscriptions
    useEffect(() => {
        let mounted = true;
        const channel = supabase
            .channel('duels-sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'duels' }, () => {
                if (!mounted) return;
                loadDuels();
                loadGlobalDuels();
                loadProfile();
            })
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(channel);
        };
    }, [loadDuels, loadGlobalDuels, loadProfile]);

    const handleChallenge = (opponentId: string, username: string) => {
        setSelectedOpponent({ id: opponentId, username });
        setWagerAmount(0);
    };

    const confirmChallenge = async () => {
        if (!selectedOpponent) return;
        setLoading(true);
        const res = await gameService.createDuel(selectedOpponent.id, wagerAmount);
        setLoading(false);
        if (res.success) {
            setSelectedOpponent(null);
            alert(`⚔️ Sfida lanciata a ${selectedOpponent.username}!`);
            setActiveTab('ACTIVE');
            loadDuels();
        } else {
            alert("Errore: " + res.message);
        }
    };

    const handleRespond = async (duelId: string, accept: boolean) => {
        if (!confirm(accept ? "Accetti la sfida?" : "Rifiuti la sfida?")) return;
        const res = await gameService.respondToDuel(duelId, accept);
        if (res.success) {
            loadDuels();
        } else {
            alert("Errore: " + res.message);
        }
    };

    const pendingReceived = duels.filter(d => d.status === 'PENDING' && d.opponent.id === currentUserId);
    const pendingSent = duels.filter(d => d.status === 'PENDING' && d.challenger.id === currentUserId);
    const activeDuels = duels.filter(d => d.status === 'ACCEPTED');

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
                <button onClick={() => setActiveTab('ACTIVE')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'ACTIVE' ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]' : 'text-gray-500 hover:text-white'}`}>Le Mie Sfide</button>
                <button onClick={() => setActiveTab('FIND')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'FIND' ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]' : 'text-gray-500 hover:text-white'}`}>Trova Avversari</button>
                <button onClick={() => setActiveTab('GLOBAL')} className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all rounded-xl ${activeTab === 'GLOBAL' ? 'bg-[#b45309]/20 text-[#b45309] border border-[#b45309]/50 shadow-[0_0_20px_rgba(180,83,9,0.2)]' : 'text-gray-500 hover:text-white'}`}>Battaglie</button>
            </div>

            {/* VIEWS */}
            {activeTab === 'ACTIVE' && (
                <div className="space-y-6">
                    {pendingReceived.length > 0 && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black text-[#b45309] uppercase tracking-widest flex items-center gap-2"><Swords className="w-4 h-4" /> Inviti Ricevuti</h3>
                            {pendingReceived.map(d => <DuelCard key={d.id} duel={d} onRespond={handleRespond} isPending={true} />)}
                        </section>
                    )}
                    {pendingSent.length > 0 && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2"><History className="w-4 h-4" /> Sfide Inviate</h3>
                            {pendingSent.map(d => <DuelCard key={d.id} duel={d} isPending={true} />)}
                        </section>
                    )}
                    <section className="space-y-4">
                        <h3 className="text-xs font-black text-white uppercase tracking-widest">In Corso</h3>
                        {activeDuels.length === 0 ? (
                            <div className="text-center py-10 text-gray-600 font-bold uppercase text-[10px]">Nessun duello attivo.</div>
                        ) : (
                            <div className="space-y-4">{activeDuels.map(d => <DuelCard key={d.id} duel={d} />)}</div>
                        )}
                    </section>
                </div>
            )}

            {activeTab === 'FIND' && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Scegli Avversario</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {opponents.map(opp => (
                            <div key={opp.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 hover:border-[#b45309] transition-all">
                                <span className="font-bold text-sm text-white">{opp.username}</span>
                                <button onClick={() => handleChallenge(opp.id, opp.username)} className="px-3 py-1.5 bg-[#b45309] text-black text-[10px] font-black uppercase rounded-lg">Sfida ⚔️</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'GLOBAL' && (
                <div className="space-y-4">
                    <h3 className="text-xs font-black text-white uppercase tracking-widest">Tutti i Duelli</h3>
                    <div className="space-y-4">{globalDuels.map(d => <DuelCard key={d.id} duel={d} />)}</div>
                </div>
            )}

            {/* MODAL */}
            {selectedOpponent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                    <div className="bg-gray-950 border border-[#b45309]/50 p-6 rounded-[32px] w-full max-w-xs text-center shadow-2xl">
                        <h3 className="text-lg font-black text-white mb-4 uppercase italic">Sfida {selectedOpponent.username}</h3>
                        <div className="flex justify-center gap-2 mb-6">
                            {[0, 1, 2, 3, 4, 5].map(v => (
                                <button key={v} onClick={() => v <= userTokens && setWagerAmount(v)} disabled={v > userTokens} className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs transition-all ${wagerAmount === v ? 'bg-[#b45309] text-black scale-110 shadow-lg' : v > userTokens ? 'bg-red-500/10 text-red-500/30' : 'bg-white/10 text-gray-500'}`}>{v}</button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setSelectedOpponent(null)} className="flex-1 py-3 text-[10px] font-black uppercase bg-white/5 text-gray-500 rounded-xl">Chiudi</button>
                            <button onClick={confirmChallenge} disabled={loading} className="flex-1 py-3 text-[10px] font-black uppercase bg-[#b45309] text-black rounded-xl">Sfida!</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const DuelCard: React.FC<{ duel: Duel, isPending?: boolean, onRespond?: (id: string, accept: boolean) => void }> = ({ duel, isPending, onRespond }) => {
    const [showWinAnim, setShowWinAnim] = useState(false);
    const prevStatusRef = useRef<string | undefined>(duel.status);

    useEffect(() => {
        if (prevStatusRef.current !== duel.status) {
            if (duel.status === 'COMPLETED' && duel.winnerId) {
                setTimeout(() => {
                    setShowWinAnim(true);
                    document.body.classList.add('bronze-arena');
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
                    </div>
                </div>
            )}

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-1">
                <div className="text-[#b45309] font-black italic text-2xl shadow-xl group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(180,83,9,0.8)]">VS</div>
                <div className="flex flex-col items-center leading-none">
                    <span className="text-[10px] font-mono text-cyan-500 font-bold">{duel.wagerAmount} TK</span>
                </div>
            </div>

            <div className="flex justify-between items-center relative z-0">
                <div className="flex flex-col items-center gap-2 w-1/2 pr-6 border-r border-white/5">
                    <div className="w-14 h-14 rounded-full border-2 border-[#b45309] p-1 shadow-[0_0_15px_rgba(180,83,9,0.3)]">
                        <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                            {duel.challenger.avatarUrl ? <img src={duel.challenger.avatarUrl} className="w-full h-full object-cover" /> : <div className="text-xs font-black text-gray-500">{duel.challenger.username.substring(0, 2).toUpperCase()}</div>}
                        </div>
                    </div>
                    <span className="font-black text-white text-xs truncate max-w-full">{duel.challenger.username}</span>
                    {duel.scores && <div className="text-2xl font-black text-[#b45309] drop-shadow-[0_0_10px_rgba(180,83,9,0.5)]">{duel.scores.challenger_score}</div>}
                </div>

                <div className="flex flex-col items-center gap-2 w-1/2 pl-6">
                    <div className="w-14 h-14 rounded-full border-2 border-[#452711] p-1">
                        <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden flex items-center justify-center">
                            {duel.opponent.avatarUrl ? <img src={duel.opponent.avatarUrl} className="w-full h-full object-cover" /> : <div className="text-xs font-black text-gray-500">{duel.opponent.username.substring(0, 2).toUpperCase()}</div>}
                        </div>
                    </div>
                    <span className="font-black text-white text-xs truncate max-w-full">{duel.opponent.username}</span>
                    {duel.scores && <div className="text-2xl font-black text-white/50">{duel.scores.opponent_score}</div>}
                </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/5 flex justify-center">
                {isPending && onRespond ? (
                    <div className="flex gap-4 w-full">
                        <button onClick={() => onRespond(duel.id, false)} className="flex-1 py-3 rounded-xl bg-white/5 text-gray-400 font-black text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Rifiuta</button>
                        <button onClick={() => onRespond(duel.id, true)} className="flex-1 py-3 rounded-xl bg-[#b45309] text-black font-black text-[10px] uppercase tracking-widest hover:bg-amber-500 hover:scale-105 transition-all shadow-lg">Accetta Sfida</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 italic">
                            {duel.status === 'COMPLETED' ? 'Terminata' : isPending ? "In attesa dell'avversario..." : 'In Corso...'}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};
