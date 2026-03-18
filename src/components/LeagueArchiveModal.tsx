import React from 'react';
import { X, Lock, ChevronRight } from 'lucide-react';

interface LeagueArchiveModalProps {
    isOpen: boolean;
    onClose: () => void;
    matchdays: { matchday_id: number; round_number: number }[];
    onSelectMatchday: (id: number, round: number) => void;
}

export const LeagueArchiveModal: React.FC<LeagueArchiveModalProps> = ({
    isOpen,
    onClose,
    matchdays,
    onSelectMatchday
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-2xl bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 md:p-10 animate-in fade-in zoom-in duration-300 max-h-[80vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <Lock size={24} className="text-[#5d8aa8]" />
                    <h3 className="text-2xl font-black italic uppercase text-white">Archivio Giornate</h3>
                </div>

                <div className="overflow-y-auto pr-2 custom-scrollbar">
                    {matchdays.length === 0 ? (
                        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
                            <Lock size={48} className="text-gray-700 mx-auto mb-4 opacity-20" />
                            <p className="text-gray-500 font-black uppercase text-xs tracking-widest">Nessuna giornata archiviata</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {matchdays.map((md) => (
                                <button
                                    key={md.matchday_id}
                                    onClick={() => onSelectMatchday(md.matchday_id, md.round_number)}
                                    className="group flex items-center justify-between p-5 bg-white/5 hover:bg-[#5d8aa8]/10 border border-white/5 hover:border-[#5d8aa8]/30 rounded-2xl transition-all duration-300 text-left"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-gray-500 font-black uppercase text-[10px] tracking-widest group-hover:text-white transition-colors">
                                            Giornata
                                        </span>
                                        <span className="text-white font-black italic text-2xl group-hover:translate-x-1 transition-transform">
                                            {md.round_number}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black uppercase text-[#5d8aa8] opacity-60 group-hover:opacity-100 transition-all">
                                            Vedi Report
                                        </span>
                                        <ChevronRight size={16} className="text-[#5d8aa8] group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <p className="mt-8 text-center text-gray-600 font-black uppercase text-[9px] tracking-[0.3em] italic">
                    I dati storici sono immutabili per garantire la trasparenza del gioco.
                </p>
            </div>
        </div>
    );
};
