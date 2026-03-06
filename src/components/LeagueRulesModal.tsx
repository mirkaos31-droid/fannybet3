import React from 'react';
import { Info, X, Star, Zap, Trophy, Award, Target } from 'lucide-react';

interface LeagueRulesModalProps {
    isOpen: boolean;
    onClose: () => void;
    bonusX: number;
}

export const LeagueRulesModal: React.FC<LeagueRulesModalProps> = ({ isOpen, onClose, bonusX }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 md:p-10 animate-in fade-in zoom-in duration-300">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <Info size={24} className="text-[#5d8aa8]" />
                    <h3 className="text-2xl font-black italic uppercase text-white">Regolamento Punti</h3>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        {/* Standard Point */}
                        <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:border-[#5d8aa8]/30 transition-all">
                            <Zap size={20} className="text-gray-500 mb-2 group-hover:text-white transition-colors" />
                            <span className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">Segno 1 o 2</span>
                            <span className="text-[#bfff00] font-black text-3xl italic">1 PT</span>
                        </div>

                        {/* Bonus X */}
                        <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:border-[#5d8aa8]/30 transition-all">
                            <Trophy size={20} className="text-gray-500 mb-2 group-hover:text-[#bfff00] transition-colors" />
                            <span className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">Pareggio (X)</span>
                            <div className="flex flex-col">
                                <span className="text-[#bfff00] font-black text-3xl italic">{bonusX} PT</span>
                                {bonusX > 1 && <span className="text-[8px] font-black text-[#bfff00]/60 uppercase tracking-widest">BONUS LEGA</span>}
                            </div>
                        </div>

                        {/* Jolly */}
                        <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:border-[#5d8aa8]/30 transition-all">
                            <Star size={20} className="text-[#5d8aa8] mb-2 animate-pulse" />
                            <span className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">Jolly ⭐</span>
                            <span className="text-[#5d8aa8] font-black text-3xl italic">X2</span>
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Punti Raddoppiati</span>
                        </div>

                        {/* Strike */}
                        <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:border-[#5d8aa8]/30 transition-all">
                            <Award size={20} className="text-orange-500 mb-2" />
                            <span className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">Strike 🔥</span>
                            <span className="text-orange-500 font-black text-3xl italic">+3 PT</span>
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">3 Corretti Filati</span>
                        </div>

                        {/* Underdog Bonus */}
                        <div className="p-5 bg-white/[0.03] rounded-3xl border border-white/5 flex flex-col items-center text-center group hover:border-[#bfff00]/30 transition-all">
                            <Target size={20} className="text-[#bfff00] mb-2" />
                            <span className="text-gray-500 text-[10px] font-black uppercase mb-1 tracking-widest">Underdog 🎯</span>
                            <span className="text-[#bfff00] font-black text-3xl italic">+2 PT</span>
                            <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Scelto dal &lt;15%</span>
                        </div>
                    </div>

                    <div className="p-6 bg-gradient-to-br from-[#bfff00]/10 to-[#bfff00]/5 rounded-[2rem] border border-[#bfff00]/20 text-center mt-4 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <Trophy size={64} className="text-[#bfff00]" />
                        </div>
                        <span className="block text-[#bfff00] text-sm font-black uppercase tracking-[0.3em] mb-1 italic">🌟 EN PLEIN 🌟</span>
                        <p className="text-gray-400 text-[10px] font-bold uppercase mb-2">Indovina tutti i 10 pronostici per</p>
                        <div className="text-white font-black text-3xl italic">+10 PT EXTRA</div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="mt-8 w-full py-5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-black uppercase tracking-widest rounded-2xl transition-all border border-white/5"
                >
                    Ho Capito
                </button>
            </div>
        </div>
    );
};
