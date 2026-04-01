import React, { useState } from 'react';
import { Trophy, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import type { FBLeagueParticipant, Matchday } from '../types';
import { gameService } from '../services/gameService';
import { BonusBadges } from './BonusBadges';

interface LeaderboardModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: FBLeagueParticipant[];
    currentUserId?: string;
    leagueId?: number;
    matchday?: Matchday | null;
    title?: string; // [NEW] Optional title for historical views
}

interface ParticipantRowProps {
    participant: FBLeagueParticipant;
    idx: number;
    currentUserId?: string;
    isExpanded: boolean;
    onExpand: (userId: string) => void;
    loadingPicks: boolean;
    expandedPicks: string[] | null;
    matchday?: Matchday | null;
}

const ParticipantRow: React.FC<ParticipantRowProps> = React.memo(({
    participant: p,
    idx,
    currentUserId,
    isExpanded,
    onExpand,
    loadingPicks,
    expandedPicks,
    matchday
}) => {
    return (
        <div className="flex flex-col">
            {/* Main Row */}
            <div
                onClick={() => onExpand(p.user_id)}
                className={`flex items-center justify-between px-6 md:px-10 py-4 rounded-xl transition-all cursor-pointer select-none ${p.user_id === currentUserId
                    ? 'bg-[#5d8aa8]/20 border border-[#5d8aa8]/40 shadow-[0_0_15px_rgba(93,138,168,0.1)]'
                    : 'bg-white/5 border border-white/5 hover:border-white/10'
                    } ${isExpanded ? 'rounded-b-none border-b-0' : ''}`}
            >
                <div className="flex items-center gap-4 hover:opacity-80 transition-opacity">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${idx === 0 ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' :
                        idx === 1 ? 'bg-gray-300 text-black' :
                            idx === 2 ? 'bg-amber-600 text-black' : 'bg-white/5 text-gray-500'
                        }`}>
                        {idx + 1}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-white font-black uppercase text-sm tracking-tight">{p.username}</span>
                        <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest flex items-center gap-1">
                            {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            Vedi Schedina
                        </span>
                        <BonusBadges bonuses={p.active_bonuses || []} />
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`${idx < 3 ? 'text-[#bfff00]' : 'text-gray-400'} font-black italic text-lg leading-none`}>
                        {p.total_points}
                    </span>
                    {p.live_points !== undefined && p.live_points > 0 && (
                        <span className={`text-[9px] font-black ${matchday?.status === 'ARCHIVED' ? 'text-gray-500' : 'text-[#bfff00] animate-pulse'}`}>
                            +{p.live_points} {matchday?.status === 'ARCHIVED' ? 'PT' : 'LIVE'}
                        </span>
                    )}
                    <span className="text-[8px] font-black uppercase text-gray-600 tracking-widest mt-1">PUNTI</span>
                </div>
            </div>

            {/* Expanded Predictions View */}
            {isExpanded && (
                <div className="bg-black/40 border border-white/5 border-t-0 p-4 rounded-b-2xl animate-in slide-in-from-top-2 duration-300">
                    {loadingPicks ? (
                        <div className="flex justify-center py-4">
                            <Loader2 size={24} className="text-[#5d8aa8] animate-spin" />
                        </div>
                    ) : expandedPicks === null ? (
                        <div className="text-center py-4">
                            <span className="text-gray-500 text-[10px] uppercase font-black tracking-widest">Schedina Non Giocata / Nascosta</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            {expandedPicks.map((pick, i) => {
                                const result = matchday?.results?.[i];
                                const hasResult = result !== null && result !== undefined && result !== '';
                                const isCorrect = hasResult && pick === result;

                                // Determine styles based on result
                                const baseStyles = pick === '1' ? 'bg-[#5d8aa8] text-white' :
                                    pick === 'X' ? 'bg-gray-600 text-white' :
                                        pick === '2' ? 'bg-[#bfff00] text-black' :
                                            'bg-gray-800 text-transparent';

                                let resultStyles = '';
                                if (hasResult) {
                                    resultStyles = isCorrect
                                        ? 'border-2 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.6)]'
                                        : 'border-2 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.6)]';
                                } else {
                                    resultStyles = 'border border-white/10';
                                }

                                return (
                                    <div key={i} className="bg-white/5 p-2 rounded-lg flex flex-col items-center justify-center border border-white/5">
                                        <span className="text-[8px] uppercase font-black text-gray-600 mb-1 truncate w-full text-center tracking-tighter">
                                            {matchday?.matches[i]?.home || `Match ${i + 1}`}
                                        </span>
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black transition-all duration-300 ${baseStyles} ${resultStyles}`}>
                                            {pick || '-'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
    isOpen,
    onClose,
    participants,
    currentUserId,
    leagueId,
    matchday,
    title = "Classifica"
}) => {
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [expandedPicks, setExpandedPicks] = useState<string[] | null>(null);
    const [loadingPicks, setLoadingPicks] = useState(false);

    if (!isOpen) return null;

    const handleExpandUser = async (userId: string) => {
        // Toggle off if already open
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            return;
        }

        // Must have context to fetch picks
        if (!leagueId || !matchday) return;

        setExpandedUserId(userId);
        setLoadingPicks(true);
        setExpandedPicks(null);

        try {
            const picks = await gameService.getUserPicks(leagueId, matchday.id, userId);
            setExpandedPicks(picks);
        } catch (error) {
            console.error('Error fetching user picks:', error);
            setExpandedPicks(null);
        } finally {
            setLoadingPicks(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-4xl bg-[#0a0a0c] border border-white/10 rounded-[2.5rem] p-6 md:p-10 animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col [will-change:transform]">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={20} className="text-gray-400" />
                </button>

                <div className="flex items-center gap-3 mb-8">
                    <Trophy size={24} className="text-[#bfff00]" />
                    <h3 className="text-2xl font-black italic uppercase text-white">{title}</h3>
                </div>

                <div className="overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {participants.map((p, idx) => (
                        <ParticipantRow
                            key={p.user_id}
                            participant={p}
                            idx={idx}
                            currentUserId={currentUserId}
                            isExpanded={expandedUserId === p.user_id}
                            onExpand={handleExpandUser}
                            loadingPicks={loadingPicks && expandedUserId === p.user_id}
                            expandedPicks={expandedUserId === p.user_id ? expandedPicks : null}
                            matchday={matchday}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
