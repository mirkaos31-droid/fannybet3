import React, { useEffect, useState } from 'react';
import type { Matchday } from '../types';
import { gameService } from '../services/gameService';

interface LeaderboardViewProps {
    matchday: Matchday | null;
}

interface RankedUser {
    username: string;
    score: number;
    predictions: string[];
    timestamp: string;
    avatarUrl?: string;
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

                    const bets = await gameService.getAllBets();
                    const currentBets = bets.filter(b => b.matchdayId === targetMatchday!.id);

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
                            avatarUrl: bet.avatarUrl
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
        ? ranking.map(r => ({ username: r.username, score: r.score, avatarUrl: r.avatarUrl, extra: '/12' }))
        : globalRanking.map(r => ({ username: r.username, score: r.totalPoints, avatarUrl: r.avatarUrl, extra: ' PT' }));

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
                <div className="flex justify-center py-20">
                    <div className="w-10 h-10 border-4 border-brand-purple/20 border-t-brand-purple rounded-full animate-spin"></div>
                </div>
            ) : (
                <>
                    {/* MINI PODIO */}
                    {currentRankingData.length > 0 && (
                        <div className="flex justify-center items-end gap-2 md:gap-8 pt-8 pb-4 relative">
                            {/* 2nd Place (Left) */}
                            {podium[1] && (
                                <div className="flex flex-col items-center group scale-90 md:scale-95 translate-y-2">
                                    <div className="relative mb-3">
                                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-4 border-slate-400 p-1 bg-black/40 overflow-hidden shadow-[0_0_20px_rgba(148,163,184,0.3)] group-hover:scale-110 transition-transform duration-500">
                                            {podium[1].avatarUrl ? (
                                                <img src={podium[1].avatarUrl} alt={podium[1].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-slate-400 bg-slate-900">
                                                    {podium[1].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-400 text-black flex items-center justify-center font-black text-xs">2</div>
                                    </div>
                                    <span className="text-[10px] md:text-xs font-black text-slate-300 uppercase tracking-tighter truncate max-w-[80px]">{podium[1].username}</span>
                                    <span className="text-lg md:text-xl font-display font-black text-white">{podium[1].score}<span className="text-[10px] opacity-40">{podium[1].extra}</span></span>
                                </div>
                            )}

                            {/* 1st Place (Center) */}
                            {podium[0] && (
                                <div className="flex flex-col items-center group relative z-10 -translate-y-4">
                                    <div className="relative mb-4">
                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 animate-bounce">👑</div>
                                        <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-yellow-400 p-1.5 bg-black/40 overflow-hidden shadow-[0_0_40px_rgba(250,204,21,0.4)] group-hover:scale-110 transition-transform duration-500">
                                            {podium[0].avatarUrl ? (
                                                <img src={podium[0].avatarUrl} alt={podium[0].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-yellow-400 bg-yellow-950/20 text-2xl">
                                                    {podium[0].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-2 right-0 w-8 h-8 rounded-full bg-yellow-400 text-black flex items-center justify-center font-black text-sm shadow-lg">1</div>
                                    </div>
                                    <span className="text-xs md:text-sm font-black text-yellow-500 uppercase tracking-tighter truncate max-w-[120px]">{podium[0].username}</span>
                                    <span className="text-2xl md:text-3xl font-display font-black text-white">{podium[0].score}<span className="text-[10px] opacity-40">{podium[0].extra}</span></span>
                                </div>
                            )}

                            {/* 3rd Place (Right) */}
                            {podium[2] && (
                                <div className="flex flex-col items-center group scale-80 md:scale-90 translate-y-4">
                                    <div className="relative mb-2">
                                        <div className="w-14 h-14 md:w-16 md:h-16 rounded-full border-4 border-orange-700 p-1 bg-black/40 overflow-hidden shadow-[0_0_20px_rgba(194,65,12,0.3)] group-hover:scale-110 transition-transform duration-500">
                                            {podium[2].avatarUrl ? (
                                                <img src={podium[2].avatarUrl} alt={podium[2].username} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center font-black text-orange-700 bg-orange-950/20">
                                                    {podium[2].username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-orange-700 text-white flex items-center justify-center font-black text-[10px]">3</div>
                                    </div>
                                    <span className="text-[9px] md:text-[11px] font-black text-orange-900 uppercase tracking-tighter truncate max-w-[70px]">{podium[2].username}</span>
                                    <span className="text-base md:text-lg font-display font-black text-white">{podium[2].score}<span className="text-[10px] opacity-40">{podium[2].extra}</span></span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* REST OF THE LIST - Thinner Cards with Purple Glow */}
                    <div className="max-w-2xl mx-auto space-y-2 mt-8">
                        {list.length === 0 && currentRankingData.length <= 3 ? (
                            <div className="text-center py-10">
                                {currentRankingData.length === 0 && (
                                    <div className="text-gray-500 text-sm italic font-mono uppercase tracking-[0.2em]">Ancora nessuna giocata valida.</div>
                                )}
                            </div>
                        ) : (
                            list.map((user, idx) => {
                                const actualRank = idx + 4;
                                return (
                                    <div
                                        key={user.username}
                                        className="group flex items-center px-4 py-2 bg-black/40 backdrop-blur-md rounded-lg border border-brand-purple/20 hover:border-brand-purple transition-all duration-300 shadow-[0_0_15px_rgba(157,0,255,0.05)] hover:shadow-[0_0_20px_rgba(157,0,255,0.15)] transform hover:-translate-y-0.5"
                                    >
                                        <div className="w-6 font-mono font-black text-[10px] text-gray-600 mr-4">
                                            #{actualRank}
                                        </div>

                                        <div className="flex-1 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full border border-brand-purple/30 p-[1px] overflow-hidden">
                                                {user.avatarUrl ? (
                                                    <img src={user.avatarUrl} alt={user.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center font-black text-[8px] text-brand-purple bg-brand-purple/10 uppercase">
                                                        {user.username.charAt(0)}
                                                    </div>
                                                )}
                                            </div>
                                            <span className="font-display font-black italic text-gray-200 uppercase tracking-tighter text-sm">
                                                {user.username}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col items-end">
                                                <span className="text-lg font-display font-black text-white leading-none">
                                                    {user.score}<span className="text-[8px] text-gray-600 font-sans font-black">{user.extra}</span>
                                                </span>
                                                {viewType === 'MATCHDAY' && user.score >= 7 && (
                                                    <span className="text-[6px] font-black text-brand-purple uppercase tracking-widest mt-0.5 animate-pulse">
                                                        ZONA PREMIO
                                                    </span>
                                                )}
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
