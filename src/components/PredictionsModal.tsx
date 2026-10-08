import { X, Save, Loader2, Star, ArrowLeft } from 'lucide-react';
import type { Matchday } from '../types';
import { useEffect } from 'react';

interface PredictionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    matchday: Matchday | null;
    myPicks: string[];
    secretMatchIndex?: number | null;
    onPickChange: (index: number, sign: string) => void;
    onSecretMatchChange?: (index: number | null) => void;
    onSave: () => void;
    saving: boolean;
    installmentWarning?: {
        requiredInstallment: number;
        fee: number;
        isPaid: boolean;
        onPay: () => void;
        isPaying: boolean;
    };
}

export const PredictionsModal: React.FC<PredictionsModalProps> = ({
    isOpen,
    onClose,
    matchday,
    myPicks,
    secretMatchIndex = null,
    onPickChange,
    onSecretMatchChange,
    onSave,
    saving,
    installmentWarning,
}) => {
    useEffect(() => {
        const handleVoice = (e: any) => {
            // BLOCCA SE DEADLINE SUPERATA
            if (matchday?.betsLocked) return;

            const val = e.detail.value.toString().toUpperCase();
            let sign = '';
            if (val.includes('1') || val.includes('UNO')) sign = '1';
            else if (val.includes('X') || val.includes('ICS') || val.includes('PAREGGIO')) sign = 'X';
            else if (val.includes('2') || val.includes('DUE')) sign = '2';

            if (sign) {
                // Trova la prima partita non ancora compilata
                const nextIdx = myPicks.findIndex(p => p === '');
                if (nextIdx !== -1) {
                    onPickChange(nextIdx, sign);
                }
            }
        };
        window.addEventListener('fanny-voice-input', handleVoice);
        return () => window.removeEventListener('fanny-voice-input', handleVoice);
    }, [matchday, myPicks, onPickChange]);

    if (!isOpen || !matchday) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
            <div className="absolute inset-0 bg-black/95 md:bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-2xl bg-[#0a0a0c] md:border border-white/10 md:rounded-[2.5rem] h-full md:h-auto md:max-h-[90vh] flex flex-col p-4 sm:p-6 md:p-10 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom duration-500">

                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8 shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                        {/* Mobile & Desktop Back Arrow */}
                        <button
                            onClick={onClose}
                            aria-label="Torna indietro"
                            className="p-2.5 sm:p-3 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-2xl transition-all flex items-center gap-1.5 group text-gray-300 hover:text-white shrink-0 min-w-[44px] min-h-[44px] justify-center active:scale-95"
                        >
                            <ArrowLeft size={20} className="text-[#5d8aa8] group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[11px] font-black uppercase tracking-wider hidden sm:inline">Indietro</span>
                        </button>
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 mb-0.5 sm:mb-1">
                                <span className="w-2 h-2 bg-[#5d8aa8] rounded-full animate-pulse"></span>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5d8aa8]">Input Pronostici</span>
                            </div>
                            <h3 className="text-xl sm:text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter truncate leading-tight">
                                Round {matchday.id} <span className="text-gray-600 hidden sm:inline text-sm md:text-2xl">— 10 Match</span>
                            </h3>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            aria-label="Chiudi"
                            className="p-2.5 sm:p-3 bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 rounded-2xl transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-95"
                        >
                            <X size={22} className="text-gray-400 hover:text-white" />
                        </button>
                    </div>
                </div>

                {/* Match List */}
                <div className="overflow-y-auto pr-2 space-y-4 custom-scrollbar flex-1 pb-32 sm:pb-36 md:pb-4">
                    {matchday.matches.slice(0, 10).map((match, idx) => (
                        <div
                            key={match.id}
                            className={`p-5 rounded-3xl border transition-all duration-300 ${matchday.jollyMatchIndex === idx
                                ? 'bg-[#5d8aa8]/10 border-[#5d8aa8]/30 shadow-[inset_0_0_20px_rgba(93,138,168,0.1)]'
                                : 'bg-white/[0.03] border-white/5 shadow-lg'
                                }`}
                        >
                            <div className="flex flex-col gap-4">
                                {/* Team Names - Optimized for Readability */}
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex-1 text-center">
                                        <span className="text-white font-black uppercase text-sm md:text-base block tracking-tight leading-tight">
                                            {match.home}
                                        </span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        {matchday.jollyMatchIndex === idx ? (
                                            <div className="flex flex-col items-center relative">
                                                {/* Backlit Glow Aura */}
                                                <div className="absolute inset-0 bg-[#bfff00]/20 blur-xl rounded-full animate-aura pointer-events-none"></div>

                                                <Star
                                                    size={20}
                                                    className="text-[#bfff00] fill-[#bfff00]/30 drop-shadow-[0_0_12px_rgba(191,255,0,0.9)] animate-pulse-slow relative z-10"
                                                />
                                                <span className="text-[8px] font-black text-[#bfff00] uppercase mt-1 tracking-widest drop-shadow-[0_0_5px_rgba(191,255,0,0.5)] relative z-10">
                                                    JOLLY
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-gray-700 font-black italic text-[10px]">VS</span>
                                        )}
                                    </div>
                                    <div className="flex-1 text-center">
                                        <span className="text-white font-black uppercase text-sm md:text-base block tracking-tight leading-tight">
                                            {match.away}
                                        </span>
                                    </div>
                                </div>

                                {/* Large Touch Buttons */}
                                <div className="grid grid-cols-3 gap-2 p-1.5 bg-black/60 rounded-2xl border border-white/5">
                                    {['1', 'X', '2'].map(sign => (
                                        <button
                                            key={sign}
                                            onClick={() => onPickChange(idx, sign)}
                                            className={`py-4 rounded-xl font-black text-lg transition-all transform active:scale-90 ${myPicks[idx] === sign
                                                ? 'bg-[#5d8aa8] text-white shadow-[0_0_15px_rgba(93,138,168,0.5)] scale-[1.02]'
                                                : 'text-gray-500 bg-white/5 hover:bg-white/10'
                                                }`}
                                        >
                                            {sign}
                                        </button>
                                    ))}
                                </div>

                                {/* Secret Match Selector */}
                                {onSecretMatchChange && (
                                    <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                        <button
                                            type="button"
                                            onClick={() => onSecretMatchChange(secretMatchIndex === idx ? null : idx)}
                                            className={`px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                                                secretMatchIndex === idx
                                                    ? 'bg-amber-400 text-black border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.6)] scale-105'
                                                    : 'bg-white/5 text-gray-400 border-white/10 hover:text-white hover:border-amber-400/50'
                                            }`}
                                        >
                                            <span>🎯 MATCH SEGRETO (2X)</span>
                                            {secretMatchIndex === idx && <span className="text-black font-extrabold">✓ ATTIVO</span>}
                                        </button>
                                        {secretMatchIndex === idx && (
                                            <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest animate-pulse">
                                                Punti raddoppiati se azzeccata!
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Fixed Footer for Save Button (Mobile Friendly & Thumb Accessible) */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 bg-gradient-to-t from-black via-black/95 to-transparent pt-8 sm:pt-10 pb-[max(1rem,env(safe-area-inset-bottom))] md:relative md:p-0 md:bg-none md:mt-8 shrink-0">
                    {installmentWarning && !installmentWarning.isPaid && (
                        <div className="mb-4 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
                            <div className="flex items-center gap-2 text-amber-400">
                                <span className="text-base">⚠️</span>
                                <span className="text-[10px] font-black uppercase tracking-wider">
                                    Rata {installmentWarning.requiredInstallment} richiesta ({installmentWarning.fee} FTK)
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={installmentWarning.onPay}
                                disabled={installmentWarning.isPaying}
                                className="w-full sm:w-auto px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center justify-center gap-2 active:scale-95"
                            >
                                {installmentWarning.isPaying ? (
                                    <Loader2 size={12} className="animate-spin" />
                                ) : null}
                                <span>Salda Rata {installmentWarning.requiredInstallment}</span>
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-2.5 sm:gap-3 w-full">
                        {/* Highly accessible thumb-reachable Back Button on mobile */}
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Torna indietro"
                            className="h-14 sm:h-[60px] px-4 sm:px-5 bg-white/10 hover:bg-white/15 active:bg-white/25 border border-white/15 rounded-[1.25rem] sm:rounded-[1.5rem] flex items-center justify-center gap-2 text-white font-black uppercase text-xs sm:text-sm tracking-wider transition-all active:scale-95 shrink-0 shadow-lg group"
                        >
                            <ArrowLeft size={20} className="text-[#5d8aa8] group-hover:-translate-x-1 transition-transform" />
                            <span className="hidden xs:inline">Indietro</span>
                        </button>

                        <button
                            onClick={onSave}
                            disabled={saving || (installmentWarning ? !installmentWarning.isPaid : false)}
                            className="flex-1 h-14 sm:h-[60px] bg-[#5d8aa8] hover:bg-[#6c9cb9] disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] rounded-[1.25rem] sm:rounded-[1.5rem] shadow-[0_0_30px_rgba(93,138,168,0.3)] transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98] text-xs sm:text-base px-3"
                        >
                            {saving ? (
                                <Loader2 className="animate-spin" size={20} />
                            ) : (
                                <Save size={20} className="group-hover:translate-y-[-2px] transition-transform" />
                            )}
                            <span className="truncate">{saving ? 'Registrazione...' : (installmentWarning && !installmentWarning.isPaid ? 'Salda Rata per Confermare' : 'Conferma Schedina')}</span>
                        </button>
                    </div>

                    {/* Progress Indicator */}
                    <div className="mt-3 sm:mt-4 flex justify-between gap-1 h-1 px-2 sm:px-4">
                        {myPicks.map((p, i) => (
                            <div
                                key={i}
                                className={`flex-1 rounded-full transition-all duration-500 ${p ? 'bg-[#bfff00]' : 'bg-white/10'}`}
                            ></div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
