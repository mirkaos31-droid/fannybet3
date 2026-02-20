import React, { useState, useEffect } from 'react';
import { Shield, Trophy, ArrowLeft, Loader2, Info, ClipboardCheck, ChevronRight } from 'lucide-react';
import { gameService } from '../services/gameService';
import type { FBLeague, FBLeagueParticipant, Matchday } from '../types';
import { toast } from 'sonner';
import { LeaderboardModal } from './LeaderboardModal';
import { PredictionsModal } from './PredictionsModal';
import { LeagueRulesModal } from './LeagueRulesModal';

interface LeagueDetailViewProps {
    leagueId: number;
    onBack: () => void;
}

export const LeagueDetailView: React.FC<LeagueDetailViewProps> = ({ leagueId, onBack }) => {
    const [data, setData] = useState<{
        league: FBLeague;
        participants: FBLeagueParticipant[];
    } | null>(null);
    const [matchday, setMatchday] = useState<Matchday | null>(null);
    const [myPicks, setMyPicks] = useState<string[]>(new Array(10).fill(''));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [user, setUser] = useState<any>(null);

    // Modal States
    const [activeModal, setActiveModal] = useState<'NONE' | 'LEADERBOARD' | 'PREDICTIONS' | 'RULES'>('NONE');

    useEffect(() => {
        loadLeagueData();
    }, [leagueId]);

    const loadLeagueData = async () => {
        try {
            setLoading(true);
            const [details, mdData, currentUser] = await Promise.all([
                gameService.getLeagueDetails(leagueId),
                gameService.getMatchday(),
                gameService.getCurrentUser()
            ]);

            setData(details);
            setMatchday(mdData);
            setUser(currentUser);

            if (currentUser && mdData) {
                const picks = await gameService.getMyPicks(leagueId, currentUser.id);
                const currentMdPick = picks.find(p => p.matchday_id === mdData.id);
                if (currentMdPick) {
                    setMyPicks(currentMdPick.predictions);
                }
            }
        } catch (error) {
            console.error('Error loading league details:', error);
            toast.error('Errore nel caricamento dei dati');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePicks = async () => {
        if (!matchday) return;
        if (myPicks.some(p => p === '')) {
            toast.error('Compila tutti i 10 pronostici!');
            return;
        }

        try {
            setSaving(true);
            const result = await gameService.submitPicks(leagueId, matchday.id, myPicks);
            if (result.success) {
                toast.success(result.message);
                setActiveModal('NONE');
                loadLeagueData(); // Refresh to see updated status
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error(error.message || 'Errore durante il salvataggio');
        } finally {
            setSaving(false);
        }
    };

    if (loading || !data) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-[#5d8aa8] mb-4" size={48} />
                <p className="text-gray-400 font-black uppercase tracking-widest text-xs">Analisi Dati Lega...</p>
            </div>
        );
    }

    const { league, participants } = data;
    const isParticipant = participants.some(p => p.user_id === user?.id);
    const bonusX = (league.scoring_rules as any)?.X || 1;

    // Helper for pick count
    const filledPicksCount = myPicks.filter(p => p !== '').length;

    return (
        <div className="animate-fade-in max-w-7xl mx-auto pb-20 px-4 mt-4">
            {/* Minimalist Navigation */}
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={onBack}
                    className="flex items-center gap-2 text-gray-500 hover:text-[#5d8aa8] transition-colors group"
                >
                    <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="font-black uppercase text-[10px] tracking-[0.2em] italic">Circuito Leghe</span>
                </button>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-[#5d8aa8]/10 border border-[#5d8aa8]/20 rounded-full">
                    <span className="text-[#5d8aa8] text-[9px] font-black uppercase tracking-widest">
                        Round {league.current_round + 1} / {league.duration_matchdays}
                    </span>
                </div>
            </div>

            {/* Compact Header Card */}
            <div className="glass-card card-lega-alieno p-8 border-none overflow-hidden relative rounded-[2rem] mb-8">
                <div className="absolute top-0 right-0 p-8 opacity-5 -mr-12 -mt-12">
                    <Shield size={180} />
                </div>
                <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-1 bg-[#5d8aa8] rounded-full"></div>
                        <span className="text-gray-500 font-black uppercase text-[8px] tracking-[0.3em]">Campionato Attivo</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black italic text-white uppercase tracking-tighter mb-4 leading-none">{league.name}</h2>

                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <span className="text-[#bfff00] font-black italic text-xl">{league.prize_pool} FTK</span>
                            <span className="text-gray-600 text-[8px] font-black uppercase tracking-widest">MONTEPREMI</span>
                        </div>
                        <div className="w-px h-6 bg-white/10"></div>
                        <div className="flex flex-col">
                            <span className="text-white font-black italic text-xl">{participants.length}</span>
                            <span className="text-gray-600 text-[8px] font-black uppercase tracking-widest">MEMBRI</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 1. HORIZONTAL RULES BAR (Thin, under header) */}
            <button
                onClick={() => setActiveModal('RULES')}
                className="w-full mb-4 group flex items-center justify-between px-6 py-3 bg-[#111113] hover:bg-[#1a2c38] border border-white/10 rounded-2xl transition-all duration-300"
            >
                <div className="flex items-center gap-3">
                    <Info size={16} className="text-[#5d8aa8]" />
                    <span className="text-white font-black italic uppercase text-xs tracking-wider">Regolamento della Lega</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-[8px] font-black uppercase tracking-widest group-hover:text-gray-400 transition-colors">Vedi Dettagli</span>
                    <ChevronRight size={14} className="text-gray-600 group-hover:text-white transition-colors" />
                </div>
            </button>

            {/* 2. MAIN ACTIONS GRID (2 Columns, Side-by-Side always) */}
            <div className="grid grid-cols-2 gap-3 md:gap-6">
                {/* LA SCHEDINA */}
                <button
                    onClick={() => setActiveModal('PREDICTIONS')}
                    className={`group relative h-36 md:h-44 border-2 rounded-[2.5rem] p-5 md:p-8 transition-all duration-300 overflow-hidden text-left ${filledPicksCount === 10
                        ? 'bg-[#111113] border-[#bfff00]/30 hover:border-[#bfff00]/60'
                        : 'bg-[#111113] border-white/5 hover:border-[#5d8aa8]/40'
                        }`}
                >
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <ClipboardCheck size={120} className="text-[#5d8aa8]" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className={`p-2.5 rounded-2xl transition-colors ${filledPicksCount === 10 ? 'bg-[#bfff00]/20' : 'bg-[#5d8aa8]/20'
                                }`}>
                                <ClipboardCheck size={20} className={filledPicksCount === 10 ? 'text-[#bfff00]' : 'text-[#5d8aa8]'} />
                            </div>
                            <div className="text-[10px] md:text-xs font-black text-white px-3 py-1 bg-black/60 rounded-full border border-white/10">
                                {filledPicksCount}/10
                            </div>
                        </div>
                        <div>
                            <h3 className="text-white font-black italic uppercase text-lg md:text-2xl leading-none mb-1">Schedina</h3>
                            <p className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest truncate">
                                {filledPicksCount === 10 ? 'Pronta!' : 'Inserisci segni'}
                            </p>
                        </div>
                    </div>
                </button>

                {/* CLASSIFICA */}
                <button
                    onClick={() => setActiveModal('LEADERBOARD')}
                    className="group relative h-36 md:h-44 bg-[#111113] hover:bg-[#1a2c38]/40 border-2 border-white/5 hover:border-[#5d8aa8]/40 rounded-[2.5rem] p-5 md:p-8 transition-all duration-300 overflow-hidden text-left"
                >
                    <div className="absolute right-[-10px] bottom-[-10px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <Trophy size={120} className="text-[#bfff00]" />
                    </div>
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                            <div className="p-2.5 bg-[#bfff00]/10 rounded-2xl group-hover:bg-[#bfff00]/20 transition-colors">
                                <Trophy size={20} className="text-[#bfff00]" />
                            </div>
                            <ChevronRight size={18} className="text-gray-600 group-hover:text-white transition-colors" />
                        </div>
                        <div>
                            <h3 className="text-white font-black italic uppercase text-lg md:text-2xl leading-none mb-1">Classifica</h3>
                            <p className="text-gray-600 text-[8px] md:text-[10px] font-black uppercase tracking-widest truncate">Vedi Distacchi</p>
                        </div>
                    </div>
                </button>
            </div>

            {/* MODALS */}

            {/* 1. LEADERBOARD MODAL */}
            <LeaderboardModal
                isOpen={activeModal === 'LEADERBOARD'}
                onClose={() => setActiveModal('NONE')}
                participants={participants}
                currentUserId={user?.id}
            />

            {/* 2. PREDICTIONS MODAL */}
            <PredictionsModal
                isOpen={activeModal === 'PREDICTIONS'}
                onClose={() => setActiveModal('NONE')}
                matchday={matchday}
                myPicks={myPicks}
                onPickChange={(idx, sign) => {
                    const newPicks = [...myPicks];
                    newPicks[idx] = sign;
                    setMyPicks(newPicks);
                }}
                onSave={handleSavePicks}
                saving={saving}
            />

            {/* 3. RULES MODAL */}
            <LeagueRulesModal
                isOpen={activeModal === 'RULES'}
                onClose={() => setActiveModal('NONE')}
                bonusX={bonusX}
            />

            {/* Footer Notice if not joined */}
            {!isParticipant && (
                <div className="mt-8 p-6 bg-[#5d8aa8]/10 border border-[#5d8aa8]/20 rounded-3xl text-center">
                    <p className="text-gray-400 font-black uppercase tracking-widest text-xs italic">
                        Devi essere iscritto per visualizzare i tuoi pronostici e scalare la classifica interstellare.
                    </p>
                </div>
            )}
        </div>
    );
};
