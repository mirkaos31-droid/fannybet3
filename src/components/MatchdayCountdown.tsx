import React from 'react';
import type { Matchday } from '../types';
import { useCountdown } from '../hooks/useCountdown';

interface MatchdayCountdownProps {
    matchday: Matchday | null;
}

export const MatchdayCountdown: React.FC<MatchdayCountdownProps> = ({ matchday }) => {
    const isLocked = Boolean(matchday?.betsLocked || (matchday && matchday.status !== 'OPEN'));
    const { days, hours, minutes, seconds, isExpired, isUrgent } = useCountdown(matchday?.deadline, isLocked);

    // Se non c'è una deadline impostata, non mostriamo nulla
    if (!matchday?.deadline) return null;

    // Colori e stili dinamici in base allo stato
    const glowClass = isExpired
        ? 'border-white/10 shadow-[0_0_15px_rgba(0,0,0,0.8)]'
        : isUrgent
        ? 'border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.2)]'
        : 'border-cyan-400/35 shadow-[0_0_20px_rgba(0,243,255,0.15)]';

    const textGlow = isExpired
        ? 'text-gray-400'
        : isUrgent
        ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]'
        : 'text-[#00f3ff] drop-shadow-[0_0_8px_rgba(0,243,255,0.6)]';

    const boxBg = isExpired
        ? 'bg-black/60 border-white/5'
        : isUrgent
        ? 'bg-red-950/20 border-red-500/30'
        : 'bg-[#081326]/80 border-cyan-400/20';

    return (
        <div className={`relative w-full max-w-md sm:max-w-lg mx-auto rounded-xl sm:rounded-2xl py-2 px-2.5 sm:py-2.5 sm:px-4 bg-gradient-to-b from-[#091122]/90 via-[#050b14]/95 to-[#02050a]/95 border backdrop-blur-xl transition-all duration-500 ${glowClass}`}>
            {/* Header info bar - Centered, no left icon */}
            <div className="flex items-center justify-center gap-2 mb-1.5 sm:mb-2 text-center">
                <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.25em] text-gray-300">
                    {isExpired
                        ? 'Stato Pronostici'
                        : isUrgent
                        ? 'Scadenza Imminente'
                        : `Deadline Round ${matchday.id}`}
                </span>

                {isExpired ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-gray-800 text-gray-400 border border-white/10">
                        Chiuso
                    </span>
                ) : isUrgent ? (
                    <span className="px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
                        Meno di 2 ore
                    </span>
                ) : (
                    <span className="px-1.5 py-0.2 rounded-full text-[7.5px] sm:text-[8px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-400/30">
                        In Corso
                    </span>
                )}
            </div>

            {/* Countdown HUD Boxes - Compact height */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2.5 items-center">
                {/* GIORNI */}
                <div className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 rounded-lg sm:rounded-xl border transition-all ${boxBg}`}>
                    <span className={`font-orbitron font-black text-lg sm:text-2xl tabular-nums leading-none tracking-tight ${textGlow}`}>
                        {days}
                    </span>
                    <span className="text-[6.5px] sm:text-[8px] font-mono font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                        Giorni
                    </span>
                </div>

                {/* ORE */}
                <div className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 rounded-lg sm:rounded-xl border transition-all ${boxBg}`}>
                    <span className={`font-orbitron font-black text-lg sm:text-2xl tabular-nums leading-none tracking-tight ${textGlow}`}>
                        {hours}
                    </span>
                    <span className="text-[6.5px] sm:text-[8px] font-mono font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                        Ore
                    </span>
                </div>

                {/* MINUTI */}
                <div className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 rounded-lg sm:rounded-xl border transition-all ${boxBg}`}>
                    <span className={`font-orbitron font-black text-lg sm:text-2xl tabular-nums leading-none tracking-tight ${textGlow}`}>
                        {minutes}
                    </span>
                    <span className="text-[6.5px] sm:text-[8px] font-mono font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                        Minuti
                    </span>
                </div>

                {/* SECONDI */}
                <div className={`flex flex-col items-center justify-center py-1 sm:py-1.5 px-1 rounded-lg sm:rounded-xl border transition-all ${boxBg}`}>
                    <span className={`font-orbitron font-black text-lg sm:text-2xl tabular-nums leading-none tracking-tight ${textGlow}`}>
                        {seconds}
                    </span>
                    <span className="text-[6.5px] sm:text-[8px] font-mono font-bold uppercase tracking-widest text-gray-400 mt-0.5">
                        Secondi
                    </span>
                </div>
            </div>
        </div>
    );
};
