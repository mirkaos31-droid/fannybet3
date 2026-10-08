import React, { useState } from 'react';
import { Trophy, X, ChevronDown, ChevronUp, Loader2, ArrowLeft } from 'lucide-react';
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
    title?: string;
    showBackButton?: boolean;
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
    const isMe = p.user_id === currentUserId;
    const [imgError, setImgError] = useState(false);

    const fallbackAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(p.username || 'User')}`;
    const avatarSrc = imgError ? fallbackAvatar : (p.avatar_url || p.avatarUrl || fallbackAvatar);

    // Polygon for squarer cards with slanted lateral edges (parallelogram cut)
    const slantedClip = 'polygon(16px 0%, 100% 0%, calc(100% - 16px) 100%, 0% 100%)';

    return (
        <div className="flex flex-col group/row">
            {/* Outer wrapper provides the continuous electric-blue slanted border */}
            <div
                onClick={() => onExpand(p.user_id)}
                style={{ clipPath: slantedClip }}
                className={`p-[2px] transition-all duration-300 cursor-pointer select-none ${
                    isMe
                        ? 'bg-gradient-to-r from-[#00f0ff] via-[#38bdf8] to-[#00f0ff] shadow-[0_0_25px_rgba(0,240,255,0.7)] scale-[1.01]'
                        : 'bg-gradient-to-r from-[#00f0ff] via-[#0066ff] to-[#00d4ff] shadow-[0_0_15px_rgba(0,212,255,0.35)] hover:shadow-[0_0_25px_rgba(0,240,255,0.65)] hover:scale-[1.008]'
                }`}
            >
                {/* Inner Card Content */}
                <div
                    style={{ clipPath: slantedClip }}
                    className={`w-full bg-gradient-to-r px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4 transition-colors ${
                        isMe
                            ? 'from-[#0b162c] via-[#0e2246] to-[#0b162c]'
                            : 'from-[#070d18] via-[#0a1528] to-[#070d18] hover:from-[#0a172e] hover:via-[#0e2142] hover:to-[#0a172e]'
                    }`}
                >
                    {/* Left side: Rank + Profile Image + User Info */}
                    <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                        {/* Slanted Rank Badge */}
                        <div
                            className={`w-8 h-8 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center font-black text-xs sm:text-sm italic transform skew-x-[-12deg] shadow-lg ${
                                idx === 0
                                    ? 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-black shadow-[0_0_15px_rgba(250,204,21,0.6)] border border-yellow-200'
                                    : idx === 1
                                    ? 'bg-gradient-to-br from-slate-100 via-slate-300 to-slate-400 text-black shadow-[0_0_12px_rgba(226,232,240,0.5)] border border-white'
                                    : idx === 2
                                    ? 'bg-gradient-to-br from-amber-600 via-orange-600 to-amber-700 text-white shadow-[0_0_12px_rgba(217,119,6,0.5)] border border-amber-400'
                                    : 'bg-[#00172e] text-[#00f0ff] border border-[#00f0ff]/50 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                            }`}
                        >
                            <span className="skew-x-[12deg]">{idx + 1}</span>
                        </div>

                        {/* Profile Picture Frame (Squarer with electric blue border) */}
                        <div className="w-11 h-11 sm:w-13 sm:h-13 shrink-0 p-[2px] bg-gradient-to-br from-[#00f0ff] via-[#0066ff] to-[#00f0ff] shadow-[0_0_14px_rgba(0,212,255,0.55)] relative">
                            <div className="w-full h-full bg-[#050811] overflow-hidden">
                                <img
                                    src={avatarSrc}
                                    alt={p.username || 'User'}
                                    onError={() => setImgError(true)}
                                    className="w-full h-full object-cover"
                                />
                            </div>
                        </div>

                        {/* Username, Badges, and Schedina toggle */}
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-white font-black uppercase text-sm sm:text-base tracking-tight truncate drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                                    {p.username}
                                </span>
                                {isMe && (
                                    <span className="text-[8px] bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/70 px-1.5 py-0.5 font-black uppercase tracking-widest shadow-[0_0_8px_rgba(0,240,255,0.5)] shrink-0">
                                        TU
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-gray-400 group-hover/row:text-[#00f0ff] text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                                    {isExpanded ? <ChevronUp size={11} className="text-[#00f0ff]" /> : <ChevronDown size={11} className="text-[#00f0ff]" />}
                                    Vedi Schedina
                                </span>
                                <BonusBadges bonuses={p.active_bonuses || []} />
                            </div>
                        </div>
                    </div>

                    {/* Right side: Points display */}
                    <div className="flex flex-col items-end shrink-0 pl-2">
                        <span className="text-2xl sm:text-3xl font-black italic tracking-tighter text-[#00f0ff] drop-shadow-[0_0_12px_rgba(0,240,255,0.6)] leading-none">
                            {p.total_points}
                        </span>
                        {p.live_points !== undefined && p.live_points > 0 && (
                            <span className="text-[9px] font-black text-[#00f0ff] bg-[#00f0ff]/15 border border-[#00f0ff]/40 px-1.5 py-0.5 mt-1 tracking-wider shadow-[0_0_8px_rgba(0,240,255,0.4)] animate-pulse">
                                +{p.live_points} {matchday?.status === 'ARCHIVED' ? 'PT' : 'LIVE'}
                            </span>
                        )}
                        <span className="text-[8px] font-black uppercase text-[#00d4ff]/70 tracking-[0.25em] mt-0.5">
                            PUNTI
                        </span>
                    </div>
                </div>
            </div>

            {/* Expanded Predictions View (Cyber Squarer Panel) */}
            {isExpanded && (
                <div className="bg-[#070d18]/95 border-2 border-[#00d4ff]/40 shadow-[0_0_20px_rgba(0,212,255,0.25)] p-4 sm:p-5 mt-1.5 animate-in slide-in-from-top-2 duration-200">
                    {loadingPicks ? (
                        <div className="flex justify-center py-5">
                            <Loader2 size={24} className="text-[#00f0ff] animate-spin" />
                        </div>
                    ) : expandedPicks === null ? (
                        <div className="text-center py-4">
                            <span className="text-gray-400 text-[10px] uppercase font-black tracking-widest">
                                Schedina Non Giocata / Nascosta
                            </span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
                            {expandedPicks.map((pick, i) => {
                                const result = matchday?.results?.[i];
                                const hasResult = result !== null && result !== undefined && result !== '';
                                const isCorrect = hasResult && pick === result;

                                const baseStyles =
                                    pick === '1'
                                        ? 'bg-[#0066ff] text-white shadow-[0_0_8px_rgba(0,102,255,0.5)]'
                                        : pick === 'X'
                                        ? 'bg-[#475569] text-white'
                                        : pick === '2'
                                        ? 'bg-[#00f0ff] text-black font-black shadow-[0_0_10px_rgba(0,240,255,0.6)]'
                                        : 'bg-gray-800 text-transparent';

                                let resultStyles = '';
                                if (hasResult) {
                                    resultStyles = isCorrect
                                        ? 'border-2 border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.7)]'
                                        : 'border-2 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.7)]';
                                } else {
                                    resultStyles = 'border border-[#00d4ff]/30';
                                }

                                return (
                                    <div
                                        key={i}
                                        className="bg-[#0b1424] p-2.5 flex flex-col items-center justify-center border border-[#00d4ff]/20"
                                    >
                                        <span className="text-[8px] uppercase font-black text-gray-400 mb-1.5 truncate w-full text-center tracking-tighter">
                                            {matchday?.matches[i]?.home || `Match ${i + 1}`}
                                        </span>
                                        <div
                                            className={`w-9 h-9 flex items-center justify-center font-black transition-all duration-300 ${baseStyles} ${resultStyles}`}
                                        >
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
    title = "Classifica Generale",
    showBackButton = false
}) => {
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
    const [expandedPicks, setExpandedPicks] = useState<string[] | null>(null);
    const [loadingPicks, setLoadingPicks] = useState(false);

    if (!isOpen) return null;

    const handleExpandUser = async (userId: string) => {
        if (expandedUserId === userId) {
            setExpandedUserId(null);
            return;
        }

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose}></div>
            <div className="relative z-10 w-full max-w-4xl bg-[#060a14] border-2 border-[#00d4ff]/40 shadow-[0_0_60px_rgba(0,102,255,0.35),0_0_25px_rgba(0,240,255,0.2)] p-5 sm:p-8 md:p-10 animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col [will-change:transform] rounded-none sm:rounded-lg">
                {/* Header Action / Close */}
                <button
                    onClick={onClose}
                    aria-label={showBackButton ? 'Torna indietro' : 'Chiudi'}
                    className="absolute top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 min-w-[44px] min-h-[44px] flex items-center justify-center bg-[#00d4ff]/10 hover:bg-[#00d4ff]/25 active:bg-[#00d4ff]/40 border border-[#00d4ff]/40 transition-all rounded-xl group active:scale-95 z-20"
                >
                    {showBackButton ? (
                        <ArrowLeft size={20} className="text-[#00f0ff] group-hover:-translate-x-1 transition-transform" />
                    ) : (
                        <X size={20} className="text-[#00f0ff]" />
                    )}
                </button>

                {/* Modal Title */}
                <div className="flex items-center gap-3.5 mb-6 sm:mb-8 pb-4 border-b border-[#00d4ff]/20">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#00f0ff] to-[#0051ff] p-[2px] shadow-[0_0_15px_rgba(0,212,255,0.5)]">
                        <div className="w-full h-full bg-[#060a14] flex items-center justify-center">
                            <Trophy size={24} className="text-[#00f0ff] drop-shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
                        </div>
                    </div>
                    <div>
                        <h3 className="text-xl sm:text-3xl font-black italic uppercase text-white tracking-wider drop-shadow-[0_0_15px_rgba(0,240,255,0.4)]">
                            {title}
                        </h3>
                        <p className="text-[#00d4ff]/70 text-[9px] sm:text-[10px] font-black uppercase tracking-widest">
                            {participants.length} Partecipanti in Gara
                        </p>
                    </div>
                </div>

                {/* Participants List */}
                <div className="overflow-y-auto pr-1 sm:pr-2 space-y-3 custom-scrollbar">
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
