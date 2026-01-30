import React, { useState, useEffect } from 'react';
import { gameService } from '../services/gameService';
import type { Duel } from '../types';

export const DuelArenaView: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'FIND' | 'GLOBAL'>('ACTIVE');
    const [duels, setDuels] = useState<Duel[]>([]);
    const [globalDuels, setGlobalDuels] = useState<Duel[]>([]);
    const [opponents, setOpponents] = useState<{ id: string, username: string, avatarUrl?: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [showRules, setShowRules] = useState(false);

    useEffect(() => {
        loadDuels();
        loadOpponents();
        loadGlobalDuels();
    }, []);

    const loadGlobalDuels = async () => {
        const d = await gameService.getAllDuels();
        setGlobalDuels(d);
    };

    const loadDuels = async () => {
        const d = await gameService.getMyDuels();
        setDuels(d);
    };

    const loadOpponents = async () => {
        const opp = await gameService.getChallengeableUsers();
        setOpponents(opp);
    };

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
    // Determine if I am challenger or opponent? (Simplified: we show basic info)
    // In a real app we'd highlight "ME" vs "THEM". 
    // Assuming the user viewing this is one of them.

    return (
        <div className={`relative bg-black rounded-2xl md:rounded-3xl p-4 md:p-6 border-2 ${isPending ? 'border-amber-500/50' : 'border-amber-700/30'} overflow-hidden group hover:border-amber-600 transition-colors`}>
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
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-700/80">
                        {duel.status === 'COMPLETED' ? 'Terminata' : 'In Corso...'}
                    </div>
                )}
            </div>
        </div>
    );
};
