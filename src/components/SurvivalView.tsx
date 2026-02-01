import React, { useState, useEffect, useCallback } from 'react';
import { gameService } from '../services/gameService';
import type { SurvivalSeason, SurvivalPlayer, Matchday, User } from '../types';

interface SurvivalViewProps {
    user: User | null;
    activeMatchday: Matchday | null;
    onBack: () => void;
    onBalanceUpdate: () => void;
}

export const SurvivalView: React.FC<SurvivalViewProps> = ({ user, activeMatchday, onBack, onBalanceUpdate }) => {
    const [season, setSeason] = useState<SurvivalSeason | null>(null);
    const [players, setPlayers] = useState<SurvivalPlayer[]>([]);
    const [loading, setLoading] = useState(false);
    const [initLoading, setInitLoading] = useState(true);
    const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Derived State
    const myPlayer = players.find(p =>
        (p.userId && p.userId === user?.id) ||
        (p.username && p.username === user?.username)
    );
    const isAlive = myPlayer?.status?.toUpperCase() === 'ALIVE';
    const hasJoined = !!myPlayer;
    const isSeasonOpen = season?.status === 'OPEN';

    console.log('[SurvivalView] State Update:', {
        userId: user?.id,
        username: user?.username,
        foundMe: !!myPlayer,
        myStatus: myPlayer?.status,
        isAlive,
        playersCount: players.length
    });

    // Calculate dynamic FT Kill (2 tokens for each dead player)
    const deadCount = players.filter(p => p.status?.toUpperCase() !== 'ALIVE').length;
    const ftKill = deadCount * 2;

    const loadData = useCallback(async () => {
        setInitLoading(true);
        console.log('Loading Survival Data...');
        const data = await gameService.getSurvivalState();
        console.log('Survival View - User Props:', user);
        console.log('Survival View - State Received:', data);
        console.log('Survival View - MyPlayer Search:', data.players.find(p => p.userId === user?.id));
        setSeason(data.season);
        setPlayers(data.players);
        setInitLoading(false);
    }, []);

    useEffect(() => {
        const init = async () => {
            await loadData();
        };
        init();
    }, [user, loadData]);

    const handleJoin = async () => {
        if (!season) return;
        setLoading(true);
        setMsg(null);
        const res = await gameService.joinSurvival(season.id);
        if (res.success) {
            setMsg({ type: 'success', text: res.message });
            onBalanceUpdate();
            loadData(); // Refresh to see myself
        } else {
            setMsg({ type: 'error', text: res.message });
        }
        setLoading(false);
    };

    const handlePick = async (team: string) => {
        if (!season) return;
        if (!confirm(`Sei sicuro di voler scegliere ${team}? Non potrai cambiarla.`)) return;

        setLoading(true);
        setMsg(null);
        const res = await gameService.submitSurvivalPick(season.id, team);
        if (res.success) {
            setMsg({ type: 'success', text: res.message });
            loadData();
        } else {
            setMsg({ type: 'error', text: res.message });
        }
        setLoading(false);
    };

    // Team Colors Helper (Simplified to Steel Grey as requested)
    const getTeamStyle = (_team: string) => {
        return 'bg-slate-800/40 border-slate-500/30 text-slate-100 hover:bg-slate-700/60 hover:border-slate-400/50';
    };

    // Get available teams from current matchday
    const getAvailableTeams = () => {
        if (!activeMatchday) return [];
        const allTeams = activeMatchday.matches.flatMap(m => [m.home, m.away]);
        // Exclude the last four teams as per user request
        const restrictedTeams = allTeams.slice(0, -4);
        // Filter used teams
        return restrictedTeams.filter(t => !myPlayer?.usedTeams.includes(t));
    };

    if (initLoading) return <div className="text-center p-10 font-display text-2xl animate-pulse">CARICAMENTO ARENA...</div>;

    if (!season) {
        return (
            <div className="glass-panel text-center p-10 bg-black/80">
                <h2 className="text-2xl font-bold mb-4">SURVIVAL MODE</h2>
                <p>Nessuna stagione attiva al momento.</p>
                <button onClick={onBack} className="mt-6 text-gray-400 hover:text-white">Torna Indietro</button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in relative min-h-screen">
            {/* Arena Background */}
            <div className="fixed inset-0 z-[-1] pointer-events-none">
                <img
                    src="/arena.png"
                    alt="Arena Background"
                    className="w-full h-full object-cover opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black"></div>
            </div>

            {/* HEADER - THE ARENA */}
            <div className="glass-panel relative overflow-hidden bg-black/80 border-red-900/50 py-10 md:py-16 px-4 md:p-6 group shadow-[0_0_50px_rgba(220,38,38,0.2)]">
                {/* Immagine Arena Background */}
                <div className="absolute inset-0 z-0">
                    <img
                        src="/arena_header.png"
                        alt="Arena Background"
                        className="w-full h-full object-cover opacity-60 scale-110 group-hover:scale-100 transition-transform duration-1000"
                    />
                    {/* Dark Red Overlay Gradient - More transparent to show the image */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-red-950/20 to-black/80"></div>
                    {/* Arena Tiers / Amphitheater rings (keeping original feel) */}
                    <div className="absolute inset-0 opacity-10" style={{
                        backgroundImage: 'repeating-radial-gradient(circle at 50% 150%, transparent 0, transparent 40px, rgba(220,38,38,1) 40px, rgba(220,38,38,1) 41px)',
                    }}></div>
                </div>

                <div className="text-center relative z-10">
                    <div className="flex flex-col items-center justify-center mb-2">
                        <div className="flex items-baseline gap-3">
                            <h2 className="text-5xl sm:text-7xl md:text-[9.5rem] font-display font-black italic text-red-600 tracking-tighter drop-shadow-[0_0_35px_rgba(220,38,38,0.7)] leading-none">
                                ARENA
                            </h2>
                            <span className="text-base md:text-2xl font-black text-red-500/80 uppercase tracking-widest italic flex flex-col items-start leading-none gap-1">
                                <span className="text-xs opacity-40 not-italic tracking-[0.3em] mb-1">PROTOCOL</span>
                                ROUND {players.length > 0 ? Math.max(...players.map(p => p.usedTeams.length)) + 1 : 1}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-col items-center mt-2 md:mt-4">
                        <div className="text-2xl md:text-5xl font-black uppercase tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#713f12] drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)] italic">
                            FT KILL: {ftKill}
                        </div>
                        <div className="text-[7px] font-black text-red-900 uppercase tracking-[0.4em] opacity-40 mt-[-4px] mb-4">
                            Sanguis et Aurum
                        </div>
                    </div>

                    {!hasJoined && !isSeasonOpen && (
                        <div className="mt-4 px-4 py-2 bg-black/40 border border-white/10 rounded-full text-[8px] font-black text-white/40 uppercase tracking-widest">
                            Lobby Chiusa • In Corso
                        </div>
                    )}

                    {hasJoined && (
                        <div className="flex justify-center">
                            <div className={`px-2 py-0.5 rounded-sm font-black text-[7px] italic tracking-tighter uppercase shadow-lg border ${isAlive ? 'bg-green-500/10 text-green-500 border-green-500/30' : 'bg-red-600/10 text-red-500 border-red-600/30'}`}>
                                {isAlive ? 'ALIVE' : 'ELIMINATED'}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {!hasJoined && (
                <div className="text-center py-6">
                    <p className="text-sm mb-4 font-bold text-white/60 uppercase tracking-widest">Only one will survive.</p>
                    <button
                        onClick={handleJoin}
                        disabled={loading || !isSeasonOpen || (user?.tokens || 0) < 2}
                        className="bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl font-black text-lg tracking-tighter shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {loading ? 'WAIT...' : 'JOIN (2 TOKENS)'}
                    </button>
                </div>
            )}

            {msg && msg.text !== "Iscrizione effettuata!" && (
                <div className={`p-4 rounded-xl border-2 font-bold text-center text-xs animate-fade-in ${msg.type === 'success' ? 'bg-green-500/10 border-green-500 text-green-400' : 'bg-red-500/10 border-red-500 text-red-400'}`}>
                    {msg.text}
                </div>
            )}

            {hasJoined && isAlive && (
                <div className="glass-panel bg-black/40 backdrop-blur-xl border-white/5 p-3.5 md:p-4">
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="text-sm font-black italic text-white uppercase tracking-widest opacity-80">🎯 HAI SCELTO</h3>
                        <span className="text-[8px] font-black text-white/10 uppercase tracking-[0.2em]">Live Status</span>
                    </div>

                    {activeMatchday && activeMatchday.status === 'OPEN' ? (
                        <>
                            {myPlayer.currentPick ? (
                                <div className="text-center py-5 bg-white/[0.02] rounded-3xl border border-white/5 relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/[0.01] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="text-gray-500 text-[8px] font-black uppercase tracking-widest mb-1 opacity-40">Locked In:</div>
                                    <div className="text-3xl md:text-5xl font-black italic text-white mb-2 tracking-tighter drop-shadow-2xl px-2">
                                        {myPlayer.currentPick}
                                    </div>

                                    {/* Used Teams History within the card */}
                                    {myPlayer.usedTeams.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-white/5 px-4">
                                            <div className="text-[7px] font-black text-white/20 uppercase tracking-[0.3em] mb-1.5 text-center">History</div>
                                            <div className="flex flex-wrap justify-center gap-1.5 opacity-60">
                                                {myPlayer.usedTeams.map((team, idx) => (
                                                    <span key={idx} className="text-[8px] font-black text-gray-500 border border-white/5 px-2 py-0.5 rounded-full bg-black/20">
                                                        {team}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2">
                                    {getAvailableTeams().length > 0 ? (
                                        getAvailableTeams().map(team => (
                                            <button
                                                key={team}
                                                onClick={() => handlePick(team)}
                                                disabled={loading}
                                                className={`group relative overflow-hidden border-2 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-95 flex flex-col items-center justify-center shadow-lg ${getTeamStyle(team)}`}
                                            >
                                                <span className="text-sm font-black italic uppercase tracking-tight relative z-10">{team}</span>
                                            </button>
                                        ))
                                    ) : (
                                        <div className="col-span-2 text-center py-4 text-white/40 text-[10px] font-black uppercase">Nessuna squadra disponibile</div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="text-gray-500 text-[10px] font-black text-center py-4 uppercase tracking-widest bg-black/20 rounded-2xl">
                            {!activeMatchday ? 'In attesa di matchday aperto...' : (activeMatchday.status === 'CLOSED' ? 'Turno Chiuso' : 'Fase di elaborazione')}
                        </div>
                    )}
                </div>
            )}

            {/* PLAYERS LIST (Graveyard & Alive) */}
            <div className="space-y-12 pb-20">
                {/* STARTING GRID (ALIVE) */}
                <div className="glass-panel border-green-500/20 bg-black/40 backdrop-blur-md pb-6 px-3">
                    <h3 className="text-lg font-display font-black italic text-green-400 mb-4 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        STARTING GRID ({players.filter(p => p.status?.toUpperCase() === 'ALIVE').length})
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                        {players.filter(p => p.status?.toUpperCase() === 'ALIVE').map(p => (
                            <div key={p.id} className="bg-white/[0.03] border border-white/5 p-1 rounded-lg flex flex-col items-center text-center gap-1.5 relative group hover:bg-white/[0.08] transition-all">
                                <div className="relative pt-1">
                                    <div className="w-12 h-12 rounded-full border-2 border-green-500/30 overflow-hidden bg-black/40 group-hover:border-green-500 transition-colors">
                                        {p.avatarUrl ? (
                                            <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-sm font-black opacity-20 italic">
                                                {p.username.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border border-black flex items-center justify-center text-[8px] font-black shadow-lg">✓</div>
                                </div>

                                <div className="w-full min-w-0">
                                    <div className="flex flex-col items-center gap-0.5 leading-none">
                                        <div className="flex items-center gap-1">
                                            <span className="font-display font-black text-[10px] text-white uppercase truncate">{p.username}</span>
                                            {((p.userId && p.userId === user?.id) || (p.username && p.username === user?.username)) && (
                                                <span className="text-[6px] text-brand-teal font-black">● TU</span>
                                            )}
                                        </div>
                                        <span className="text-[8px] font-black italic text-green-500/60 uppercase truncate">
                                            {p.currentPick || 'READY'}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-1 flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-full border border-white/5">
                                    <span className="text-[9px] font-black text-yellow-500 leading-none">2</span>
                                    <span className="text-[6px] font-black text-white/20 uppercase">TK</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GRAVEYARD (DEAD) */}
                <div className="glass-panel border-red-900/40 bg-black/60 backdrop-blur-md pt-8">
                    <h3 className="text-xl font-display font-black italic text-red-600 mb-8 flex items-center gap-2 justify-center">
                        💀 CIMITERO ({players.filter(p => p.status !== 'ALIVE').length})
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4 px-2">
                        {players.filter(p => p.status !== 'ALIVE').map(p => (
                            <div key={p.id} className="tombstone group">
                                <div className="absolute top-2 right-2 text-[8px] text-red-900 font-black opacity-20">
                                    {p.eliminatedAt ? `G${p.eliminatedAt}` : ''}
                                </div>
                                <div className="w-8 h-8 rounded-full border border-white/5 grayscale opacity-30 mb-2 overflow-hidden">
                                    {p.avatarUrl ? (
                                        <img src={p.avatarUrl} alt={p.username} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-[8px] font-black">?</div>
                                    )}
                                </div>
                                <span className="font-display font-black text-[9px] text-white/40 uppercase tracking-tighter truncate w-full text-center">
                                    {p.username}
                                </span>
                                <div className="mt-2 flex flex-wrap justify-center gap-0.5 max-w-full opacity-20 group-hover:opacity-40 transition-opacity">
                                    {p.usedTeams.slice(-2).map((t, i) => (
                                        <span key={i} className="text-[5px] font-black px-1 border border-white/10 rounded">{t}</span>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
