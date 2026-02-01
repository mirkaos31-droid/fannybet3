import React, { useEffect, useState } from 'react';
import type { Matchday, Bet } from '../types';
import { gameService } from '../services/gameService';

interface FanniesViewProps {
    matchday: Matchday;
}

export const FanniesView: React.FC<FanniesViewProps> = ({ matchday }) => {
    const [bets, setBets] = useState<Bet[]>([]);
    const [history, setHistory] = useState<Matchday[]>([]);
    const [viewMode, setViewMode] = useState<'CURRENT' | 'ARCHIVE'>('CURRENT');
    const [selectedHistoryMd, setSelectedHistoryMd] = useState<Matchday | null>(null);

    useEffect(() => {
        gameService.getAllBets().then(setBets);
        gameService.getArchivedMatchdays().then(setHistory);
    }, [matchday, viewMode]);

    // Determine which matchday to show (Current or Selected from History)
    const activeMatchday = viewMode === 'CURRENT' ? matchday : (selectedHistoryMd || matchday);
    // Filter bets for the active matchday
    const displayedBets = bets.filter(b => b.matchdayId === activeMatchday.id);

    const getAccuracy = (predictions: string[], results: (string | null)[]) => {
        let hits = 0;
        let total = 0;
        predictions.forEach((p, i) => {
            if (results[i]) {
                total++;
                if (p === results[i]) hits++;
            }
        });
        return total > 0 ? Math.round((hits / total) * 100) : 0;
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className="bg-acid-glow px-8 py-2 md:py-3 skew-x-[-12deg] shadow-[0_0_30px_rgba(191,255,0,0.4)] inline-block self-start">
                    <h3 className="text-2xl md:text-3xl font-display font-black italic tracking-tighter text-black skew-x-[12deg] uppercase">
                        I FANNIES
                    </h3>
                </div>

                {/* Toggle Archive */}
                <div className="flex bg-black/60 rounded-xl p-1.5 border border-white/5 shadow-2xl self-start md:self-center">
                    <button
                        onClick={() => { setViewMode('CURRENT'); setSelectedHistoryMd(null); }}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all uppercase ${viewMode === 'CURRENT' ? 'bg-brand-gold text-black shadow-lg shadow-brand-gold/20' : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        LIVE #{matchday.id}
                    </button>
                    <button
                        onClick={() => setViewMode('ARCHIVE')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all uppercase ${viewMode === 'ARCHIVE' ? 'bg-white/10 text-white shadow-lg' : 'text-gray-500 hover:text-white'
                            }`}
                    >
                        STORICO ({history.length})
                    </button>
                </div>
            </div>

            {viewMode === 'ARCHIVE' && (
                <div className="glass-panel mb-8 border-brand-gold/20">
                    <h4 className="text-[10px] font-mono font-black text-brand-gold mb-4 uppercase tracking-[0.3em] opacity-80">Seleziona Giornata Passata</h4>
                    <div className="flex gap-2 flex-wrap">
                        {history.length === 0 ? (
                            <div className="text-gray-500 text-sm italic font-mono uppercase">Nessuna giornata archiviata.</div>
                        ) : (
                            history.map(md => (
                                <button
                                    key={md.id}
                                    onClick={() => setSelectedHistoryMd(md)}
                                    className={`px-4 py-2 rounded-lg border-2 transition-all text-xs font-mono font-black ${selectedHistoryMd?.id === md.id
                                        ? 'bg-brand-gold text-black border-brand-gold shadow-[0_0_20px_rgba(255,204,0,0.3)]'
                                        : 'bg-black/30 text-gray-400 border-white/5 hover:border-white/20'
                                        }`}
                                >
                                    GIORNATA #{md.id}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {displayedBets.length === 0 ? (
                    <div className="col-span-full text-gray-500 text-center py-20 glass-panel border-dashed border-white/10 font-mono tracking-widest uppercase text-xs">
                        {viewMode === 'CURRENT'
                            ? "Nessuna scommessa per questa giornata. Sii il primo!"
                            : "Nessun dato per la giornata selezionata."}
                    </div>
                ) : (
                    displayedBets.map((bet) => {
                        const accuracy = getAccuracy(bet.predictions, activeMatchday.results);
                        return (
                            <div key={bet.id} className="glass-card !bg-black/40 border-2 border-brand-gold/20 hover:border-brand-gold/40 transition-all group overflow-hidden relative">
                                {/* Level Tag - Top Right Prominent */}
                                <div className="absolute top-0 right-0 bg-brand-gold px-4 py-1 skew-x-[-15deg] translate-x-2 -translate-y-1 shadow-[0_0_15px_rgba(255,204,0,0.3)] z-10">
                                    <div className="skew-x-[15deg] font-display font-black text-xs text-black uppercase tracking-tighter">
                                        LEVEL {bet.level || 1}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between mb-2 p-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-gold to-[#D4AF37] p-[1.5px] shadow-lg group-hover:scale-110 transition-transform">
                                            {bet.avatarUrl ? (
                                                <img src={bet.avatarUrl} alt={bet.username} className="w-full h-full object-cover rounded-lg" />
                                            ) : (
                                                <div className="w-full h-full bg-black rounded-lg flex items-center justify-center font-display font-black text-brand-gold italic text-xs">
                                                    {bet.username.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <div className="flex flex-col items-start leading-none">
                                                <span className="font-display font-black italic text-white uppercase tracking-tighter text-sm">{bet.username}</span>
                                                <span className="text-[8px] font-black text-brand-gold/80 uppercase whitespace-nowrap mt-0.5">acc. {accuracy}%</span>
                                            </div>
                                            <span className="text-[6px] font-mono text-gray-500 uppercase tracking-widest mt-0.5">
                                                {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-6 gap-1 md:gap-1 p-1 bg-black/20 rounded-lg border border-white/5 mx-auto max-w-[92%]">
                                    {bet.predictions.map((p, idx) => (
                                        <div key={idx} className="flex flex-col items-center">
                                            <span className="text-[5px] text-gray-600 font-mono font-bold mb-0.2 opacity-60">#{idx + 1}</span>
                                            <div className={`w-full h-6 md:h-7 rounded-none flex items-center justify-center font-mono font-black text-[9px] md:text-xs border transition-all ${activeMatchday.results[idx]
                                                ? (activeMatchday.results[idx] === p
                                                    ? 'bg-acid-glow text-black border-acid-glow shadow-[0_0_10px_rgba(191,255,0,0.3)]'
                                                    : 'bg-red-500/10 text-red-500 border-red-500/30 line-through opacity-50')
                                                : 'bg-white/5 text-brand-gold border-brand-gold/20'
                                                }`}>
                                                {p}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {bet.includeSuperJackpot && (
                                    <div className="mt-1.5 pt-1 border-t border-white/5 flex items-center justify-center gap-1.5">
                                        <span className="w-1 h-1 rounded-full bg-brand-gold animate-pulse"></span>
                                        <span className="text-[7px] font-mono font-black text-brand-gold uppercase tracking-[0.2em]">SUPERJACKPOT ACTIVE</span>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
