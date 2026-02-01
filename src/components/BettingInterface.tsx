import React, { useState } from 'react';
import type { Matchday, Bet, User, ViewMode } from '../types';
import { gameService } from '../services/gameService';

interface BettingInterfaceProps {
    matchday: Matchday;
    userBet?: Bet;
    user: User | null;
    onBetPlaced: () => void;
    onViewChange: (view: ViewMode) => void;
}

export const BettingInterface: React.FC<BettingInterfaceProps> = ({ matchday, userBet, user, onBetPlaced, onViewChange }) => {
    const [predictions, setPredictions] = useState<string[]>(Array(12).fill(''));
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    const togglePrediction = (matchIndex: number, val: string) => {
        setPredictions(prev => {
            const copy = [...prev];
            copy[matchIndex] = val;
            return copy;
        });
    };

    const submitBet = async (isSuper: boolean) => {
        if (predictions.some(p => p === '')) {
            setMsg("Devi completare tutti i pronostici!");
            return;
        }
        setLoading(true);
        const res = await gameService.placeBet(predictions, isSuper);
        setMsg(res.message);
        setLoading(false);
        if (res.success) {
            onBetPlaced();
        }
    };

    return (
        <div className="space-y-6 md:space-y-12 animate-fade-in pb-20 bg-gradient-to-br from-[#2d1b4d] via-[#120a1f] to-black min-h-screen p-0 md:p-10 border border-white/5">
            {/* Active Bet Notification Pill */}
            {userBet && (
                <div className="flex justify-center px-4 md:px-0">
                    <button
                        onClick={() => onViewChange('SPY')}
                        className="glass-card card-bright-yellow !py-1.5 !px-4 flex items-center gap-2 rounded-full border-acid-glow/40 bg-acid-glow/10 hover:bg-acid-glow/20 transition-all group shadow-[0_0_20px_rgba(191,255,0,0.2)]"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-acid-glow"></span>
                        </span>
                        <span className="text-[10px] md:text-xs font-mono font-black text-acid-glow uppercase tracking-widest leading-none">
                            GIOCATA ATTIVA RILEVATA <span className="text-white/40 ml-1">|</span> <span className="text-white group-hover:text-acid-glow transition-colors ml-1">VEDI DETTAGLI</span>
                        </span>
                        <span className="text-xs group-hover:translate-x-1 transition-transform">➡️</span>
                    </button>
                </div>
            )}

            <div className="glass-panel !bg-black/40 !p-1 md:!p-12 border-0 md:border-2 border-white/10 shadow-[0_0_50px_rgba(157,0,255,0.15)]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 px-4 md:px-0 mt-6 md:mt-0">
                    <div className="bg-acid-glow px-6 py-2 md:py-3 skew-x-[-12deg] shadow-[0_0_30px_rgba(191,255,0,0.4)]">
                        <h3 className="text-2xl md:text-4xl font-display font-black italic tracking-tighter text-black skew-x-[12deg]">
                            ARENA <span className="text-black/60">1X2</span>
                        </h3>
                    </div>
                    <div className="flex items-center gap-4 bg-white/5 px-6 py-2 rounded-2xl border border-white/10 overflow-x-auto whitespace-nowrap">
                        <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">MONTEPREMI</span>
                        <span className="text-xl md:text-2xl font-mono font-black text-brand-gold">{matchday.currentPot} FTK</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 md:gap-3">
                    {matchday.matches.map((m, idx) => (
                        <div key={idx} className={`relative overflow-hidden p-6 md:p-6 rounded-none md:rounded-lg border-y md:border-2 transition-all duration-500 group ${idx >= 10 ? 'bg-brand-purple/20 border-brand-purple/40 hover:border-brand-purple' : 'bg-white/[0.03] border-white/5 md:border-white/10 hover:border-white/30'}`}>
                            <div className="absolute top-3 left-6 text-[#00a2ff] font-mono text-[9px] font-black tracking-widest drop-shadow-[0_0_8px_#00a2ff] opacity-80 uppercase">
                                MATCH_{idx + 1}
                            </div>

                            <div className="flex items-center justify-between gap-2 md:gap-12 mt-4 px-0 md:px-8">
                                <div className="flex-1 text-right">
                                    <h4 className={`text-[14px] md:text-xl font-display font-black italic uppercase tracking-tight leading-none ${idx >= 10 ? 'text-brand-purple' : 'text-white'}`}>
                                        {m.home}
                                    </h4>
                                </div>
                                <div className="flex flex-col items-center flex-shrink-0">
                                    <div className="w-5 md:w-10 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mb-1"></div>
                                    <span className="text-[9px] font-mono text-gray-500 font-bold tracking-tighter">VS</span>
                                    <div className="w-5 md:w-10 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent mt-1"></div>
                                </div>
                                <div className="flex-1 text-left">
                                    <h4 className={`text-[14px] md:text-xl font-display font-black italic uppercase tracking-tight leading-none ${idx >= 10 ? 'text-brand-purple' : 'text-white'}`}>
                                        {m.away}
                                    </h4>
                                </div>
                            </div>

                            <div className="flex justify-center gap-2 md:gap-6 mt-6">
                                {['1', 'X', '2'].map(sign => (
                                    <button
                                        key={sign}
                                        onClick={() => togglePrediction(idx, sign)}
                                        className={`w-full max-w-[125px] h-10 md:h-12 rounded-md text-sm md:text-xl font-mono font-black transition-all duration-300 border-2 ${predictions[idx] === sign
                                            ? 'bg-acid-glow text-black border-acid-glow shadow-[0_0_15px_#bfff00] scale-105'
                                            : 'bg-black/60 text-gray-400 border-white/5 hover:border-white/30 hover:text-white'
                                            }`}
                                    >
                                        {sign}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-8 p-6 md:p-10 border-t border-white/10 flex flex-col items-center gap-6 bg-black/40">
                    {msg && (
                        <div className={`text-center text-[10px] md:text-base font-mono font-black uppercase tracking-[0.2em] px-6 py-4 rounded-2xl border-2 animate-bounce ${msg.includes('Giocata') ? 'text-acid-glow border-acid-glow/40 bg-acid-glow/5' : 'text-red-500 border-red-500/40 bg-red-500/5'}`}>
                            {msg}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-3xl">
                        <button
                            onClick={() => submitBet(false)}
                            disabled={loading || (user?.tokens || 0) < 1}
                            className={`py-4 md:py-6 rounded-2xl text-lg md:text-xl font-display font-black italic tracking-tighter uppercase transition-all hover:scale-[0.98] active:scale-95 shadow-[0_0_20px_rgba(255,204,0,0.2)] relative overflow-hidden group ${loading || (user?.tokens || 0) < 1
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                                : 'bg-brand-gold text-black border-2 border-white/20'
                                }`}
                        >
                            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                            {loading ? '...' : 'MONTEPREMI 1FT'}
                        </button>

                        <button
                            onClick={() => submitBet(true)}
                            disabled={loading || (user?.tokens || 0) < 2}
                            className={`py-4 md:py-6 rounded-2xl text-lg md:text-xl font-display font-black italic tracking-tighter uppercase transition-all hover:scale-[0.98] active:scale-95 shadow-[0_0_30px_rgba(185,242,255,0.4)] relative overflow-hidden group ${loading || (user?.tokens || 0) < 2
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50'
                                : 'bg-gradient-to-r from-brand-diamond via-white to-brand-diamond text-black border-2 border-white/20'
                                }`}
                        >
                            <div className="absolute inset-0 bg-white/40 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none"></div>
                            {loading ? '...' : 'SUPERJACKPOT 2FT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
