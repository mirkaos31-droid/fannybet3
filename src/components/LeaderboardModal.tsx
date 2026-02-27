import React from 'react';
import { Trophy, X } from 'lucide-react';
import type { FBLeagueParticipant } from '../types';

interface LeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: FBLeagueParticipant[];
    currentUserId?: string;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
    isOpen,
    onClose,
    participants,
    currentUserId
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-lg bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 md:p-8 animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <Trophy size={24} className="text-[#bfff00]" />
                    <h3 className="text-2xl font-black italic uppercase text-white">Classifica</h3>
                </div>

                <div className="overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                    {participants.map((p, idx) => (
                        <div
                            key={p.user_id}
                            className={`flex items-center justify-between p-4 rounded-2xl transition-all ${p.user_id === currentUserId
                                ? 'bg-[#5d8aa8]/20 border border-[#5d8aa8]/40 shadow-[0_0_15px_rgba(93,138,168,0.1)]'
                                : 'bg-white/5 border border-white/5 hover:border-white/10'
                                }`}
                        >
                            <div className="flex items-center gap-4">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${idx === 0 ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' :
                                    idx === 1 ? 'bg-gray-300 text-black' :
                                        idx === 2 ? 'bg-amber-600 text-black' : 'bg-white/5 text-gray-500'
                                    }`}>
                                    {idx + 1}
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-white font-black uppercase text-sm tracking-tight">{p.username}</span>
                                    <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">RANKING ATTUALE</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={`${idx < 3 ? 'text-[#bfff00]' : 'text-gray-400'} font-black italic text-lg leading-none`}>
                                    {p.total_points}
                                </span>
                                {p.live_points !== undefined && p.live_points > 0 && (
                                    <span className="text-[9px] font-black text-[#bfff00] animate-pulse">
                                        +{p.live_points} LIVE
                                    </span>
                                )}
                                <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest mt-1">PUNTI</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
