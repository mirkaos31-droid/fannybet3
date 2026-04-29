import React, { useEffect, useState } from 'react';
import type { Matchday } from '../types';
import { gameService } from '../services/gameService';
import { Gem } from 'lucide-react';

interface LeaderboardViewProps {
    matchday: Matchday | null;
}

interface RankedUser {
    username: string;
    score: number;
    predictions: string[];
    timestamp: string;
    avatarUrl?: string;
    level: number;
    includeSuperJackpot?: boolean;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ matchday }) => {
    const [ranking, setRanking] = useState<RankedUser[]>([]);
    const [globalRanking, setGlobalRanking] = useState<{ username: string; totalPoints: number; avatarUrl?: string }[]>([]);
    const [displayMatchday, setDisplayMatchday] = useState<Matchday | null>(null);
    const [viewType, setViewType] = useState<'MATCHDAY' | 'GLOBAL'>('MATCHDAY');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const calculateRanking = async () => {
            setLoading(true);
            try {
                if (viewType === 'MATCHDAY') {
                    let targetMatchday = matchday;

                    if (!targetMatchday) {
                        const history = await gameService.getArchivedMatchdays();
                        if (history.length > 0) {
                            targetMatchday = history[0]; // Get the latest one
                        }
                    }

                    setDisplayMatchday(targetMatchday);

                    if (!targetMatchday) {
                        setRanking([]);
                        return;
                    }

                    const bets = await gameService.getAllBets(targetMatchday!.id);
                    const currentBets = bets;

                    const ranked: RankedUser[] = currentBets.map(bet => {
                        let score = 0;
                        targetMatchday!.results.forEach((res, idx) => {
                            if (res && res === bet.predictions[idx]) {
                                score += 1;
                            }
                        });

                        return {
                            username: bet.username,
                            score,
                            predictions: bet.predictions,
                            timestamp: bet.timestamp,
                            avatarUrl: bet.avatarUrl,
                            level: bet.level || 1,
                            includeSuperJackpot: bet.includeSuperJackpot
                        };
                    });

                    ranked.sort((a, b) => {
                        if (b.score !== a.score) return b.score - a.score;
                        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
                    });

                    setRanking(ranked);
                } else {
                    const global = await gameService.getGlobalRanking();
                    setGlobalRanking(global);
                }
            } finally {
                setLoading(false);
            }
        };

        calculateRanking();
    }, [matchday, viewType]);

    if (!displayMatchday && viewType === 'MATCHDAY' && !loading) {
        return (
            <div className="text-center text-gray-500 py-10 font-black uppercase tracking-widest text-xs opacity-50 italic">
                Nessuna classifica disponibile per questa giornata.
            </div>
        );
    }

    const currentRankingData = viewType === 'MATCHDAY'
        ? ranking.map(r => ({ username: r.username, score: r.score, avatarUrl: r.avatarUrl, level: r.level, extra: '/12', includeSuperJackpot: r.includeSuperJackpot }))
        : globalRanking.map(r => ({ username: r.username, score: r.totalPoints, avatarUrl: r.avatarUrl, level: (r as { level?: number }).level || 1, extra: ' PT', includeSuperJackpot: false }));

    const podium = currentRankingData.slice(0, 3);
    const list = currentRankingData.slice(3);

    return (
        <div className="space-y-10 animate-fade-in pb-20">
            {/* Header style matching 'I FANNIES' */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="flex flex-col gap-4">
                    <div className="bg-brand-purple px-8 py-2 md:py-3 skew-x-[-12deg] shadow-[0_0_30px_rgba(157,0,255,0.4)] inline-block self-start">
                        <h3 className="text-2xl md:text-3xl font-display font-black italic tracking-tighter text-white skew-x-[12deg] uppercase">
                            CLASSIFICA
                        </h3>
                    </div>

                    {/* NEW TOGGLE BAR */}
                    <div className="flex gap-2 p-1 bg-black/40 backdrop-blur-md rounded-xl border border-white/5 self-start scale-90 origin-left">
                        <button
                            onClick={() => setViewType('MATCHDAY')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'MATCHDAY'
                                ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(157,0,255,0.3)]'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Giornata {displayMatchday ? `#${displayMatchday.id}` : ''}
                        </button>
                        <button
                            onClick={() => setViewType('GLOBAL')}
                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewType === 'GLOBAL'
                                ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(157,0,255,0.3)]'
                                : 'text-gray-500 hover:text-gray-300'
                                }`}
                        >
                            Generale
                        </button>
                    </div>
                </div>

                <div className="text-right">
                    <div className="text-[10px] font-mono font-black text-brand-purple uppercase tracking-[0.2em]">
                        {viewType === 'MATCHDAY'
                            ? (displayMatchday?.status === 'OPEN' ? 'LIVE GIORNATA' : 'ARCHIVIO GIORNATA')
                            : 'GLOBAL FANNIES RANKING'}
                    </div>
                    <div className="text-white/30 text-[9px] font-black uppercase tracking-tighter mt-1 italic">
                        {viewType === 'MATCHDAY' ? 'Basata sui risultati dell\'ultima giornata' : 'Basata sulla somma di tutti i punti vinti'}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="relative w-16 h-16">
                        <div className="absolute inset-0 border-4 border-brand-purple/20 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-t-brand-purple rounded-full animate-spin"></div>
                        <div className="absolute inset-0 bg-brand-purple/10 blur-xl rounded-full animate-pulse"></div>
                    </div>
                    <p className="mt-6 text-[10px] font-black uppercase tracking-[0.4em] text-gray-500 animate-pulse">Sincronizzazione Classifica...</p>
                </div>
            ) : (
                <>
                    {/* MODERNISED PODIUM WITH PEDESTALS */}
                    {currentRankingData.length > 0 && (
                        <div className="flex justify-center items-end gap-3 md:gap-12 pt-16 pb-12 relative px-2">
                            {/* Ambient Glow behind podium */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl h-64 bg-brand-purple/5 blur-[120px] rounded-full pointer-events-none"></div>

                            {/* 2nd Place (Left) */}
                            {podium[1] && (
                                <div className="flex flex-col items-center group flex-1 max-w-[140px] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                                    <div className="relative mb-0 z-10 transition-transform duration-500 group-hover:scale-110">
                                        <div className={`w-16 h-16 md:w-24 md:h-24 rounded-2xl border-2 p-1 bg-black/60 rotate-[-4deg] overflow-hidden shadow-[0_0_30px_rgba(148,163,184,0.2)] 
                                            ${displayMatchday?.status === 'ARCHIVED' && podium[1].score >= 10 ? 'super-jackpot-crown border-brand-diamond' : 'border-slate-400/40'}`}>
                                            {podium[1].avatarUrl ? (
                                                <img src={podium[1].avatarUrl} alt={podium[1].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-2xl text-slate-400 bg-slate-900/50">
                                                    {podium[1].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 w-7 h-7 rounded-lg bg-slate-400 text-black flex items-center justify-center font-black text-xs shadow-xl border border-white/20 rotate-[4deg]">2</div>
                                    </div>
                                    {/* Pedestal */}
                                    <div className="w-full h-24 md:h-32 bg-gradient-to-b from-slate-400/10 to-transparent border-t-2 border-slate-400/30 rounded-t-2xl backdrop-blur-sm -mt-4 pt-8 flex flex-col items-center">
                                        <div className="px-2 text-center">
                                            <div className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-tight truncate w-full mb-1">{podium[1].username}</div>
                                            <div className="text-xl md:text-2xl font-display font-black text-white leading-none">
                                                {podium[1].score}<span className="text-[8px] opacity-40 ml-0.5">/12</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 1st Place (Center) */}
                            {podium[0] && (
                                <div className="flex flex-col items-center group flex-1 max-w-[160px] relative z-20 animate-in fade-in slide-in-from-bottom-12 duration-1000">
                                    <div className="relative mb-0 z-30 transition-transform duration-700 group-hover:scale-115">
                                        {/* Crown logic preserved */}
                                        {viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && displayMatchday?.winners?.includes(podium[0].username) && (
                                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)] text-3xl">👑</div>
                                        )}

                                        <div className={`w-20 h-20 md:w-32 md:h-32 rounded-3xl border-2 p-1.5 bg-black/80 rotate-[0deg] overflow-hidden shadow-[0_0_50px_rgba(255,204,0,0.3)]
                                            ${viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && displayMatchday?.winners?.includes(podium[0].username)
                                                ? 'winner-card-glow border-yellow-400' 
                                                : 'border-brand-gold/40' 
                                            }`}>
                                            {podium[0].avatarUrl ? (
                                                <img src={podium[0].avatarUrl} alt={podium[0].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center font-black text-4xl 
                                                    ${viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && displayMatchday?.winners?.includes(podium[0].username)
                                                        ? 'text-yellow-400 bg-yellow-950/20'
                                                        : 'text-brand-gold/60 bg-brand-gold/5'
                                                    }`}>
                                                    {podium[0].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-xl text-black flex items-center justify-center font-black text-lg shadow-2xl border-2 border-white/20
                                            ${viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && displayMatchday?.winners?.includes(podium[0].username)
                                                ? 'bg-yellow-400'
                                                : 'bg-brand-gold'
                                            }`}>1</div>
                                    </div>
                                    {/* Pedestal - HIGHER */}
                                    <div className="w-full h-32 md:h-44 bg-gradient-to-b from-brand-gold/20 to-transparent border-t-2 border-brand-gold/40 rounded-t-3xl backdrop-blur-md -mt-6 pt-10 flex flex-col items-center">
                                        <div className="px-2 text-center">
                                            <div className={`text-xs md:text-sm font-black uppercase tracking-widest truncate w-full mb-1 
                                                ${viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && displayMatchday?.winners?.includes(podium[0].username)
                                                    ? 'text-yellow-400' : 'text-white'}`}>
                                                {podium[0].username}
                                            </div>
                                            <div className="text-3xl md:text-4xl font-display font-black text-white leading-none drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                                                {podium[0].score}<span className="text-xs opacity-40 ml-1">/12</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3rd Place (Right) */}
                            {podium[2] && (
                                <div className="flex flex-col items-center group flex-1 max-w-[140px] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                                    <div className="relative mb-0 z-10 transition-transform duration-500 group-hover:scale-110">
                                        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-2xl border-2 p-1 bg-black/60 rotate-[4deg] overflow-hidden shadow-[0_0_30px_rgba(180,83,9,0.2)] 
                                            ${displayMatchday?.status === 'ARCHIVED' && podium[2].score >= 10 ? 'super-jackpot-crown border-brand-diamond' : 'border-orange-700/40'}`}>
                                            {podium[2].avatarUrl ? (
                                                <img src={podium[2].avatarUrl} alt={podium[2].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-xl text-orange-700 bg-orange-950/30">
                                                    {podium[2].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 -left-2 w-6 h-6 rounded-lg bg-orange-700 text-white flex items-center justify-center font-black text-[10px] shadow-xl border border-white/10 rotate-[-4deg]">3</div>
                                    </div>
                                    {/* Pedestal */}
                                    <div className="w-full h-20 md:h-28 bg-gradient-to-b from-orange-700/10 to-transparent border-t-2 border-orange-700/30 rounded-t-2xl backdrop-blur-sm -mt-4 pt-8 flex flex-col items-center">
                                        <div className="px-2 text-center">
                                            <div className="text-[8px] md:text-[9px] font-black text-orange-400 uppercase tracking-tight truncate w-full mb-1">{podium[2].username}</div>
                                            <div className="text-lg md:text-xl font-display font-black text-white leading-none">
                                                {podium[2].score}<span className="text-[7px] opacity-40 ml-0.5">/12</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PREMIUM LIST VIEW */}
                    <div className="max-w-3xl mx-auto space-y-3 mt-4 relative">
                        {list.length === 0 && currentRankingData.length <= 3 ? (
                            <div className="text-center py-20 bg-white/5 rounded-[2.5rem] border border-dashed border-white/10">
                                <p className="text-gray-500 text-xs font-black uppercase tracking-[0.3em] italic">In attesa dei primi sfidanti...</p>
                            </div>
                        ) : (
                            list.map((user, idx) => {
                                const actualRank = idx + 4;
                                const delay = Math.min(idx * 50, 1000); // Stagger effect

                                return (
                                    <div
                                        key={`${user.username}-${idx}`}
                                        style={{ animationDelay: `${delay}ms` }}
                                        className="group flex items-center px-6 py-4 bg-white/[0.02] hover:bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/5 hover:border-brand-purple/30 transition-all duration-500 transform hover:-translate-y-1 animate-in fade-in slide-in-from-right-4 fill-mode-both"
                                    >
                                        {/* Rank Info */}
                                        <div className="w-12 flex flex-col items-center justify-center mr-4 border-r border-white/10 pr-4">
                                            <span className="text-[10px] font-mono font-black text-gray-500 uppercase leading-none mb-1">POS</span>
                                            <span className="text-lg font-display font-black text-white/80 group-hover:text-brand-purple transition-colors">#{actualRank}</span>
                                        </div>

                                        {/* Avatar \u0026 Name */}
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-12 h-12 rounded-xl border border-white/10 p-0.5 overflow-hidden bg-black/40 group-hover:border-brand-purple/50 transition-colors">
                                                    {user.avatarUrl ? (
                                                        <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center font-black text-sm text-brand-purple bg-brand-purple/10">
                                                            {user.username.charAt(0)}
                                                        </div>
                                                    )}
                                                </div>
                                                {user.level > 1 && (
                                                    <div className="absolute -top-2 -right-2 bg-brand-purple text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border border-white/20">
                                                        L{user.level}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-display font-black italic text-white uppercase tracking-tight text-lg leading-tight flex items-center gap-2">
                                                    {user.username}
                                                    {user.includeSuperJackpot && <Gem size={12} className="text-cyan-400 animate-pulse" />}
                                                </span>
                                                <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Sfidante Elite</span>
                                            </div>
                                        </div>

                                        {/* Score Section */}
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-display font-black text-white tabular-nums">
                                                        {user.score}
                                                    </span>
                                                    <span className="text-[10px] font-black text-gray-500 uppercase">{user.extra}</span>
                                                </div>
                                                
                                                {viewType === 'MATCHDAY' && displayMatchday?.status === 'ARCHIVED' && user.score >= 7 && (
                                                    <div className={`flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md border text-[7px] font-black uppercase tracking-widest
                                                        ${user.score >= 10 ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-brand-purple/10 text-brand-purple border-brand-purple/30'}`}>
                                                        <Gem size={8} /> {user.score >= 10 ? 'SUPERJACKPOT' : 'WINNER'}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="w-1.5 h-10 bg-white/5 rounded-full overflow-hidden">
                                                <div 
                                                    className="w-full bg-brand-purple/40 transition-all duration-1000"
                                                    style={{ height: `${(user.score / 12) * 100}%`, transitionDelay: `${delay + 300}ms` }}
                                                ></div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};
