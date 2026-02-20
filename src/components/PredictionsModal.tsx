import React from 'react';
import { X, Save, Loader2, Star } from 'lucide-react';
import type { Matchday } from '../types';

interface PredictionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    matchday: Matchday | null;
    myPicks: string[];
    onPickChange: (index: number, sign: string) => void;
    onSave: () => void;
    saving: boolean;
}

export const PredictionsModal: React.FC<PredictionsModalProps> = ({
    isOpen,
    onClose,
    matchday,
    myPicks,
    onPickChange,
    onSave,
    saving
}) => {
    if (!isOpen || !matchday) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4">
            <div className="absolute inset-0 bg-black/95 md:bg-black/90 backdrop-blur-xl" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-2xl bg-[#0a0a0c] md:border border-white/10 md:rounded-[2.5rem] h-full md:h-auto md:max-h-[90vh] flex flex-col p-6 md:p-10 animate-in slide-in-from-bottom duration-500">

                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="w-2 h-2 bg-[#5d8aa8] rounded-full animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-[#5d8aa8]">Input Pronostici</span>
                        </div>
                        <h3 className="text-2xl md:text-3xl font-black italic uppercase text-white tracking-tighter">
                            Round {matchday.id} <span className="text-gray-600 block md:inline text-sm md:text-2xl">— 10 Match</span>
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors"
                    >
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                {/* Match List */}
                <div className="overflow-y-auto pr-2 space-y-4 custom-scrollbar flex-1 pb-24 md:pb-4">
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
                                            <div className="flex flex-col items-center">
                                                <Star size={16} className="text-[#5d8aa8] animate-spin-slow mb-1" />
                                                <span className="text-[8px] font-black text-[#5d8aa8] uppercase">JOLLY</span>
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
                            </div>
                        </div>
                    ))}
                </div>

                {/* Fixed Footer for Save Button (Mobile Friendly) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/95 to-transparent pt-10 md:relative md:p-0 md:bg-none md:mt-8">
                    <button
                        onClick={onSave}
                        disabled={saving}
                        className="w-full py-5 bg-[#5d8aa8] hover:bg-[#6c9cb9] disabled:opacity-50 text-white font-black uppercase tracking-[0.2em] rounded-[1.5rem] shadow-[0_0_30px_rgba(93,138,168,0.3)] transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98]"
                    >
                        {saving ? (
                            <Loader2 className="animate-spin" size={20} />
                        ) : (
                            <Save size={20} className="group-hover:translate-y-[-2px] transition-transform" />
                        )}
                        <span>{saving ? 'Registrazione...' : 'Conferma Schedina'}</span>
                    </button>
                    {/* Progress Indicator */}
                    <div className="mt-4 flex justify-between gap-1 h-1 px-4">
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
