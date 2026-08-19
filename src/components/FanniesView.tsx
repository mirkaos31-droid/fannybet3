// @ts-nocheck
import React, { useEffect, useState } from 'react';
import type { Matchday, Bet } from '../types';
import { gameService } from '../services/gameService';
import { Lock, Eye, Zap, Target, Users, ShieldCheck, Database, Search, Coins } from 'lucide-react';

interface FanniesViewProps {
    matchday: Matchday;
}

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string }> = ({ label, value, icon, color }) => (
    <div className="spy-header-stat group">
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-black/40 border border-white/5 ${color} transition-all duration-300 group-hover:scale-110`}>
                {icon}
            </div>
            <div className="flex flex-col">
                <span className="text-[7px] md:text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</span>
                <span className="text-sm md:text-xl font-digital font-black text-white leading-none">{value}</span>
            </div>
        </div>
    </div>
);

export const FanniesView: React.FC<FanniesViewProps> = ({ matchday }) => {
    const [bets, setBets] = useState<Bet[]>([]);
    const [history, setHistory] = useState<Matchday[]>([]);
    const [viewMode, setViewMode] = useState<'CURRENT' | 'ARCHIVE'>('CURRENT');
    const [selectedHistoryMd, setSelectedHistoryMd] = useState<Matchday | null>(null);
    const [currentUsername, setCurrentUsername] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const activeMatchday = viewMode === 'CURRENT' ? matchday : (selectedHistoryMd || matchday);
    
    // Stats calculation
    const totalBets = Array.isArray(bets) ? bets.length : 0;
    const avgAccuracy = totalBets > 0 
        ? Math.round(bets.reduce((acc, b) => acc + getAccuracy(b.predictions, activeMatchday?.results || []), 0) / totalBets) 
        : 0;

    useEffect(() => {
        const fetchData = async () => {
            try {
                if (!activeMatchday?.id) return;
                
                // Defensive checks for service methods existence
                if (typeof gameService.getAllBets === 'function') {
                    const b = await gameService.getAllBets(activeMatchday.id);
                    setBets(Array.isArray(b) ? b : []);
                } else {
                    console.warn('gameService.getAllBets is not available');
                }

                if (typeof gameService.getArchivedMatchdays === 'function') {
                    const h = await gameService.getArchivedMatchdays();
                    setHistory(Array.isArray(h) ? h : []);
                }

                if (typeof gameService.getCurrentUser === 'function') {
                    const user = await gameService.getCurrentUser();
                    if (user?.username) setCurrentUsername(user.username);
                }
            } catch (err) {
                console.error("Error in FanniesView fetchData:", err);
            }
        };

        fetchData();
    }, [activeMatchday?.id, viewMode]);

    const isDeadlinePassed = new Date() > new Date(activeMatchday.deadline);
    const areBetsLocked = viewMode === 'CURRENT' && !isDeadlinePassed;

    function getAccuracy(predictions: string[], results: (string | null)[]) {
        if (!Array.isArray(predictions) || !Array.isArray(results)) return 0;
        let hits = 0;
        let total = 0;
        predictions.forEach((p, i) => {
            if (results[i]) {
                total++;
                if (p === results[i]) hits++;
            }
        });
        return total > 0 ? Math.round((hits / total) * 100) : 0;
    }

    const filteredBets = Array.isArray(bets) ? bets.filter(b => 
        (b.username || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) : [];

    return (
        <div className="space-y-6 md:space-y-10 animate-fade-in pb-20 max-w-7xl mx-auto px-1 md:px-4">
            {/* TACTICAL HEADER */}
            <div className="flex flex-col gap-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <div className="w-2 h-8 bg-brand-gold shadow-[0_0_15px_rgba(255,204,0,0.5)]"></div>
                            <h3 className="text-3xl md:text-6xl font-display font-black italic tracking-tighter text-white uppercase leading-none">
                                INTELLIGENCE
                            </h3>
                        </div>
                        <p className="text-[10px] md:text-sm font-black text-brand-gold uppercase tracking-[0.4em] opacity-80 flex items-center gap-2">
                            <Database size={14} /> Local Data: SPY Mode Active
                        </p>
                    </div>

                    {/* Mode Toggle */}
                    <div className="flex bg-black/60 rounded-2xl p-1 border border-white/10 shadow-3xl backdrop-blur-xl">
                        <button
                            onClick={() => { setViewMode('CURRENT'); setSelectedHistoryMd(null); }}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase ${viewMode === 'CURRENT' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/30' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Zap size={12} fill={viewMode === 'CURRENT' ? 'currentColor' : 'none'} />
                            LIVE #{matchday.id}
                        </button>
                        <button
                            onClick={() => setViewMode('ARCHIVE')}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black tracking-[0.2em] transition-all uppercase ${viewMode === 'ARCHIVE' ? 'bg-white/10 text-white shadow-xl' : 'text-gray-500 hover:text-white'}`}
                        >
                            <Target size={12} />
                            ARCHIVE
                        </button>
                    </div>
                </div>

                {/* STATS RADAR */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    <StatCard label="Partecipanti" value={totalBets} icon={<Users size={18} />} color="text-cyan-400" />
                    <StatCard label="Avg Accuracy" value={`${avgAccuracy}%`} icon={<ShieldCheck size={18} />} color="text-acid-glow" />
                    <StatCard label="Montepremi" value={`${activeMatchday.currentPot} FTK`} icon={<Coins size={18} />} color="text-brand-gold" />
                    <div className="relative group">
                        <div className="absolute inset-0 bg-brand-gold/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <div className="spy-header-stat !border-brand-gold/20 flex-row items-center !p-1 bg-black/40 overflow-hidden">
                            <div className="px-3">
                                <Search size={16} className="text-gray-500" />
                            </div>
                            <input 
                                type="text"
                                placeholder="FILTER USER..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-transparent border-none outline-none text-[10px] font-black tracking-widest text-white w-full h-full py-3 uppercase placeholder:text-gray-700"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'ARCHIVE' && (
                <div className="glass-panel !py-6 border-brand-gold/20 bg-black/40 animate-slide-up">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-1 h-3 bg-brand-gold"></div>
                        <h4 className="text-[10px] font-black text-brand-gold uppercase tracking-[0.3em]">Temporal Selection</h4>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        {history.length === 0 ? (
                            <div className="text-gray-600 text-xs italic font-mono uppercase">Database empty. No archived matchdays.</div>
                        ) : (
                            history.map(md => (
                                <button
                                    key={md.id}
                                    onClick={() => setSelectedHistoryMd(md)}
                                    className={`px-5 py-2.5 rounded-lg border transition-all text-[10px] font-mono font-black ${selectedHistoryMd?.id === md.id
                                        ? 'bg-brand-gold text-black border-brand-gold shadow-[0_0_15px_rgba(255,204,0,0.3)]'
                                        : 'bg-black/30 text-gray-500 border-white/5 hover:border-white/20 hover:text-white'
                                        }`}
                                >
                                    LOG_ENTRY #{md.id}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* BETS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {filteredBets.length === 0 ? (
                    <div className="col-span-full text-gray-700 text-center py-32 card-spy border-dashed !bg-transparent flex flex-col items-center justify-center gap-4">
                        <div className="w-16 h-16 rounded-full border-2 border-white/5 flex items-center justify-center animate-pulse">
                            <Eye size={32} className="opacity-20" />
                        </div>
                        <div className="font-mono tracking-[0.3em] uppercase text-[10px] animate-pulse">
                            {searchTerm ? "IDSEARCH_ERROR: USER NOT FOUND" : "SATELLITE_LINK: NO DATA UPLOADED"}
                        </div>
                    </div>
                ) : (
                    filteredBets.map((bet, idx) => {
                        const isMyBet = currentUsername === bet.username;
                        const showContent = !areBetsLocked || isMyBet;
                        const accuracy = getAccuracy(bet.predictions, activeMatchday?.results || []);

                        return (
                            <div 
                                key={bet.id} 
                                style={{ animationDelay: `${idx * 0.05}s` }}
                                className={`card-spy group animate-pop-in ${isMyBet ? 'border-brand-gold/40 shadow-[0_0_30px_rgba(255,204,0,0.15)] ring-1 ring-brand-gold/20' : ''}`}
                            >
                                <div className="spy-scanner"></div>
                                
                                {/* TOP ROW: Avatar & User Info */}
                                <div className="flex items-start justify-between mb-4 relative z-10">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-2xl p-[1.5px] transition-transform duration-500 group-hover:scale-110 shadow-2xl relative ${isMyBet ? 'bg-brand-gold' : 'bg-white/10'}`}>
                                            <div className="w-full h-full bg-black rounded-[14px] overflow-hidden flex items-center justify-center">
                                                {bet.avatarUrl ? (
                                                    <img src={bet.avatarUrl} alt={bet.username || 'Agent'} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" />
                                                ) : (
                                                    <span className="font-display font-black text-brand-gold italic text-sm">
                                                        {(bet.username || 'A').charAt(0).toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                            {bet.includeSuperJackpot && (
                                                <div className="absolute -top-1.5 -left-1.5 text-cyan-400 drop-shadow-[0_0_10px_rgba(0,255,255,0.8)] animate-pulse">
                                                    <Zap size={14} fill="currentColor" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-display font-black italic uppercase tracking-tighter text-base ${isMyBet ? 'text-brand-gold' : 'text-white'}`}>
                                                    {bet.username}
                                                </span>
                                                {isMyBet && (
                                                    <span className="bg-brand-gold text-black text-[7px] font-black px-1.5 py-0.5 rounded italic">YOU</span>
                                                )}
                                            </div>
                                            <span className="text-[7px] font-mono text-gray-500 uppercase tracking-[0.2em] mt-0.5">
                                                AGENT_ID: {bet.id ? String(bet.id).substring(0, 8).toUpperCase() : 'UNKNOWN'} // {bet.timestamp ? new Date(bet.timestamp).toLocaleDateString('it-IT') : '--/--/----'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Level Badge */}
                                    <div className="flex flex-col items-end">
                                        <div className={`px-3 py-1 rounded-full text-[8px] font-black border uppercase tracking-widest ${isMyBet ? 'bg-brand-gold/10 border-brand-gold/30 text-brand-gold' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                                            LVL {bet.level || 1}
                                        </div>
                                    </div>
                                </div>

                                {/* PREDICTIONS GRID */}
                                <div className="grid grid-cols-6 gap-1 p-1 bg-black/40 rounded-2xl border border-white/5 relative group/grid">
                                    {!showContent && (
                                        <div className="absolute inset-0 z-30 backdrop-blur-md bg-black/20 rounded-2xl flex items-center justify-center border border-white/5">
                                            <div className="flex flex-col items-center gap-1 opacity-40 group-hover/grid:scale-110 transition-transform">
                                                <Lock size={16} className="text-gray-500" />
                                                <span className="text-[7px] font-black uppercase tracking-[0.3em] font-mono text-gray-500">ENCRYPTED_DATA</span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {(showContent ? (Array.isArray(bet.predictions) ? bet.predictions : []) : Array(12).fill('?')).map((p, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                            <span className="text-[5px] text-gray-700 font-mono font-bold mb-0.5 opacity-60">P_{String(idx + 1).padStart(2, '0')}</span>
                                            <div className={`w-full h-7 flex items-center justify-center font-mono font-black text-xs border transition-all duration-500 ${
                                                !showContent ? 'bg-white/[0.02] border-white/5 text-gray-800' :
                                                (activeMatchday?.results && activeMatchday.results[idx])
                                                ? (activeMatchday.results[idx] === p
                                                    ? 'bg-acid-glow text-black border-acid-glow shadow-[0_0_15px_rgba(191,255,0,0.4)]'
                                                    : 'bg-red-500/10 text-red-500/50 border-red-500/20 line-through opacity-40')
                                                : 'bg-white/5 text-brand-gold border-brand-gold/20 group-hover:border-brand-gold/40'
                                            }`}>
                                                {p}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* FOOTER INFO */}
                                <div className="mt-3 flex items-center justify-between">
                                    <div className="flex flex-col">
                                        <span className="text-[7px] font-mono text-gray-600 uppercase tracking-widest">ANALYSIS_REALTIME</span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-brand-gold transition-all duration-1000" style={{ width: showContent ? `${accuracy}%` : '0%' }}></div>
                                            </div>
                                            <span className="text-[9px] font-black text-brand-gold font-digital">{showContent ? `${accuracy}%` : '---'}</span>
                                        </div>
                                    </div>
                                    
                                    {bet.includeSuperJackpot && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="flex gap-0.5">
                                                {[1,2,3].map(i => (
                                                    <div key={i} className="w-0.5 h-2 bg-cyan-400/30 animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}></div>
                                                ))}
                                            </div>
                                            <span className="text-[7px] font-mono font-black text-cyan-400 uppercase tracking-[0.2em]">S_JACKPOT</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
